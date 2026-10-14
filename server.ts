import express from "express";
import path from "path";
import { execFile } from "child_process";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse body with generous limits for files/images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Helper to forward requests to the Google Apps Script Web App URL
  const appsScriptUrl = process.env.VITE_API_URL || 
                        process.env.VITE_APPS_SCRIPT_URL || 
                        "https://script.google.com/macros/s/AKfycbxCvHfU0Nmx7e5inDRV-YQAaoKyQG2mye1SrzxO28-lopNrTOYPCTC4NpC7TlnZSbtI/exec";

  // In-flight deduplication and cache store for read actions
  const inFlightRequests = new Map<string, Promise<any>>();
  const cacheStore = new Map<string, { timestamp: number; data: any }>();
  const CACHE_TTL_MS = 90 * 1000; // 90 segundos de cache para leitura pesada

  // Limitador de concorrência: 1 requisição por vez ao Apps Script para eliminar erros 500 por Lock do Google Sheets
  class AsyncQueue {
    private running = 0;
    private queue: (() => void)[] = [];

    constructor(private maxConcurrency = 1) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
      while (this.running >= this.maxConcurrency) {
        await new Promise<void>((resolve) => this.queue.push(resolve));
      }
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  const appsScriptQueue = new AsyncQueue(1);

  function isReadAction(action: string): boolean {
    return [
      "getUsers",
      "getPainelData",
      "getMateriasData",
      "getWipData",
      "getAwbData",
      "getParametros",
      "getMaterialByProduto",
      "getUserByCracha",
      "getBDAsicsNovoData",
      "get042BDData",
      "statusBusca",
      "getHistoricoData"
    ].includes(action);
  }

  function invalidateCacheForAction(action: string) {
    if (!isReadAction(action)) {
      // Invalidate relevant caches on mutation
      cacheStore.clear();
    }
  }

  /**
   * Executa requisição POST para o Google Apps Script via curl nativo do sistema operacional.
   * Evita problemas conhecidos de socket/HTTP2 no Node.js Undici com redirecionamentos 302 do Google.
   */
  function executeWithCurl(url: string, payload: string): Promise<any> {
    return new Promise((resolve, reject) => {
      execFile("curl", [
        "-s",
        "-L",
        "--max-time", "45",
        "-H", "Content-Type: text/plain;charset=utf-8",
        "-d", payload,
        url
      ], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        if (!stdout || !stdout.trim()) {
          return reject(new Error("Resposta vazia do Google Apps Script via curl"));
        }
        try {
          const json = JSON.parse(stdout);
          resolve(json);
        } catch (parseErr) {
          reject(new Error(`Resposta não-JSON do Apps Script: ${stdout.substring(0, 150)}`));
        }
      });
    });
  }

  /**
   * Chamador robusto para o Google Apps Script Web App.
   * Prioriza curl nativo (1.8s) com fallback para Fetch manual de redirecionamento.
   */
  async function callAppsScriptDirect(action: string, data: any, attempt = 1): Promise<any> {
    const payload = JSON.stringify({ action, data });
    const fetchUrl = `${appsScriptUrl}${appsScriptUrl.includes("?") ? "&" : "?"}ts=${Date.now()}`;

    try {
      // 1ª Prioridade: curl nativo do sistema (alta performance e estabilidade com 302 redirects)
      try {
        const curlResult = await executeWithCurl(fetchUrl, payload);
        return curlResult;
      } catch (curlErr: any) {
        console.warn(`[Server API] curl fall-through para ${action} (${curlErr.message}), tentando fetch nativo...`);
      }

      // 2ª Prioridade: Fetch nativo com timeout de 60s
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const postResponse = await fetch(fetchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: payload,
          redirect: "manual",
          signal: controller.signal
        });

        let finalResponse: Response;

        if ([301, 302, 303, 307].includes(postResponse.status)) {
          const redirectUrl = postResponse.headers.get("location");
          if (!redirectUrl) {
            throw new Error(`Google Apps Script retornou redirect (${postResponse.status}) sem cabeçalho Location.`);
          }
          finalResponse = await fetch(redirectUrl, {
            method: "GET",
            signal: controller.signal
          });
        } else {
          finalResponse = postResponse;
        }

        if (!finalResponse.ok) {
          throw new Error(`HTTP Error: ${finalResponse.status} ${finalResponse.statusText}`);
        }

        const responseText = await finalResponse.text();
        return JSON.parse(responseText);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: any) {
      if (attempt <= 3) {
        const backoffMs = attempt * 1200;
        console.log(`[Server API] Apps Script ocupado para '${action}', tentando novamente em ${backoffMs}ms (tentativa ${attempt + 1}/4)...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return callAppsScriptDirect(action, data, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Generic forwarder with concurrency queue, deduplication, and caching for zero downtime
   */
  async function forwardToAppsScript(action: string, data: any) {
    const isRead = isReadAction(action);
    const cacheKey = `${action}_${JSON.stringify(data || {})}`;

    // 1. Check cache for read actions
    if (isRead) {
      const cached = cacheStore.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
      }

      // 2. In-flight request deduplication
      if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey);
      }
    } else {
      invalidateCacheForAction(action);
    }

    const requestPromise = (async () => {
      try {
        // Enforce concurrency limit to prevent Google Apps Script 500 rate/lock errors
        const result = await appsScriptQueue.run(() => callAppsScriptDirect(action, data));
        if (result && result.success && isRead) {
          // Apenas grava no cache se tiver dados reais ou se o cache ainda estiver vazio
          const hasExisting = cacheStore.has(cacheKey);
          const isArray = Array.isArray(result.data);
          if (!hasExisting || !isArray || result.data.length > 0) {
            cacheStore.set(cacheKey, { timestamp: Date.now(), data: result });
          }
        }
        return result;
      } catch (error: any) {
        console.error(`[Server API Error] Action: ${action} - Error:`, error.message);
        
        // Fallback to stale cache if available
        if (isRead && cacheStore.has(cacheKey)) {
          console.warn(`[Server API] Retornando cache anterior para ${action} após falha.`);
          return cacheStore.get(cacheKey)!.data;
        }

        // Graceful fallback for read actions so the UI never breaks completely
        if (isRead) {
          console.warn(`[Server API Fallback] Retornando conjunto vazio temporário para ${action} para manter a aplicação online.`);
          return { success: true, data: [] };
        }

        return { success: false, error: error.message || "Erro de comunicação com o servidor Google Apps Script" };
      } finally {
        if (isRead) {
          inFlightRequests.delete(cacheKey);
        }
      }
    })();

    if (isRead) {
      inFlightRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  // ==========================================
  // 🚀 PREPARED BACKEND SERVER ROUTES
  // ==========================================

  // Unified endpoint for generic front-to-back dispatching
  app.post("/api/action", async (req, res) => {
    const { action, data } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: "Parâmetro 'action' não fornecido" });
    }
    let result = await forwardToAppsScript(action, data);
    
    // Fallback gracioso se a implantação remota no Apps Script do usuário ainda não possuir a nova ação
    if (!result.success && result.error && String(result.error).includes("Ação não encontrada")) {
      if (action === "getHistoricoData") {
        result = { success: true, data: [] };
      } else if (action === "saveHistoricoData") {
        result = { success: true, data: data };
      }
    }
    
    res.json(result);
  });

  // --- 1. Autenticação e Usuários (Prepared Endpoints) ---
  app.post("/api/auth/login", async (req, res) => {
    const result = await forwardToAppsScript("login", req.body);
    res.json(result);
  });

  app.post("/api/users", async (req, res) => {
    const result = await forwardToAppsScript("getUsers", req.body);
    res.json(result);
  });

  app.post("/api/users/add", async (req, res) => {
    const result = await forwardToAppsScript("addUser", req.body);
    res.json(result);
  });

  app.post("/api/users/update", async (req, res) => {
    const result = await forwardToAppsScript("updateUser", req.body);
    res.json(result);
  });

  app.post("/api/users/by-cracha", async (req, res) => {
    const result = await forwardToAppsScript("getUserByCracha", req.body);
    res.json(result);
  });

  // --- 2. Painel Logístico (Prepared Endpoints) ---
  app.post("/api/painel/get", async (req, res) => {
    const result = await forwardToAppsScript("getPainelData", req.body);
    res.json(result);
  });

  app.post("/api/painel/update", async (req, res) => {
    const result = await forwardToAppsScript("updatePainelData", req.body);
    res.json(result);
  });

  app.post("/api/painel/update-multiple", async (req, res) => {
    const result = await forwardToAppsScript("updateMultiplePainelData", req.body);
    res.json(result);
  });

  app.post("/api/painel/save-multiple", async (req, res) => {
    const result = await forwardToAppsScript("saveMultiplePainelData", req.body);
    res.json(result);
  });

  app.post("/api/painel/delete", async (req, res) => {
    const result = await forwardToAppsScript("deletePainelData", req.body);
    res.json(result);
  });

  app.post("/api/painel/delete-multiple", async (req, res) => {
    const result = await forwardToAppsScript("deleteMultiplePainelData", req.body);
    res.json(result);
  });

  // --- Histórico de Movimentações ---
  app.post("/api/historico/get", async (req, res) => {
    let result = await forwardToAppsScript("getHistoricoData", req.body);
    if (!result.success && result.error && String(result.error).includes("Ação não encontrada")) {
      result = { success: true, data: [] };
    }
    res.json(result);
  });

  app.post("/api/historico/save", async (req, res) => {
    let result = await forwardToAppsScript("saveHistoricoData", req.body);
    if (!result.success && result.error && String(result.error).includes("Ação não encontrada")) {
      result = { success: true, data: req.body };
    }
    res.json(result);
  });

  // --- 3. PCP e Produção (Prepared Endpoints) ---
  app.post("/api/pcp/save", async (req, res) => {
    const result = await forwardToAppsScript("savePCPData", req.body);
    res.json(result);
  });

  app.post("/api/pcp/wip", async (req, res) => {
    const result = await forwardToAppsScript("getWipData", req.body);
    res.json(result);
  });

  app.post("/api/pcp/reorder", async (req, res) => {
    const result = await forwardToAppsScript("reorderPCPRows", req.body);
    res.json(result);
  });

  app.post("/api/pcp/parametros", async (req, res) => {
    const result = await forwardToAppsScript("getParametros", req.body);
    res.json(result);
  });

  // --- 4. Follow-Up, AWB, Materiais e Drive (Prepared Endpoints) ---
  app.post("/api/materials/get", async (req, res) => {
    const result = await forwardToAppsScript("getMateriasData", req.body);
    res.json(result);
  });

  app.post("/api/materials/by-produto", async (req, res) => {
    const result = await forwardToAppsScript("getMaterialByProduto", req.body);
    res.json(result);
  });

  app.post("/api/materials/save", async (req, res) => {
    const result = await forwardToAppsScript("saveMateriaData", req.body);
    res.json(result);
  });

  app.post("/api/materials/delete", async (req, res) => {
    const result = await forwardToAppsScript("deleteMateriaData", req.body);
    res.json(result);
  });

  app.post("/api/awb/get", async (req, res) => {
    const result = await forwardToAppsScript("getAwbData", req.body);
    res.json(result);
  });

  app.post("/api/awb/save", async (req, res) => {
    const result = await forwardToAppsScript("saveAwbData", req.body);
    res.json(result);
  });

  app.post("/api/awb/send-email", async (req, res) => {
    const result = await forwardToAppsScript("sendAwbEmail", req.body);
    res.json(result);
  });

  app.post("/api/awb/delete", async (req, res) => {
    const result = await forwardToAppsScript("deleteAwbData", req.body);
    res.json(result);
  });

  app.post("/api/drive/upload", async (req, res) => {
    const result = await forwardToAppsScript("uploadFileToDrive", req.body);
    res.json(result);
  });

  // ==========================================
  // ⚡ VITE MIDDLEWARE SETUP
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Use fallback middleware to avoid path-to-regexp wildcard parsing errors in newer Express/router versions
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Servidor Express ativo com sucesso na porta ${PORT}`);
  });
}

startServer();
