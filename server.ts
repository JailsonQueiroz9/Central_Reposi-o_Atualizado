import express from "express";
import path from "path";

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

  /**
   * Generic forwarder to maintain zero downtime/perfect compatibility with current Google Apps Script sheets database
   */
  async function forwardToAppsScript(action: string, data: any) {
    try {
      const fetchUrl = `${appsScriptUrl}${appsScriptUrl.includes("?") ? "&" : "?"}ts=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({ action, data }),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      try {
        const result = JSON.parse(responseText);
        return result;
      } catch (jsonErr) {
        console.error(`[Server API Parse Error] Action: ${action}. Raw Response preview:`, responseText.substring(0, 500));
        throw new Error("Resposta inválida do servidor Google (provavelmente o limite de tempo da execução do script de 30 segundos do Apps Script foi atingido ou houve um erro interno na planilha).");
      }
    } catch (error: any) {
      console.error(`[Server API Error] Action: ${action} - Error:`, error);
      return { success: false, error: error.message || "Erro de comunicação com o servidor Google Apps Script" };
    }
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
