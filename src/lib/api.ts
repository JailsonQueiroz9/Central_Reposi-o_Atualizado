export const api = {
  /**
   * Função genérica para chamar o backend.
   * Se o servidor Express estiver ativo, ele servirá de proxy/ponte para a API de forma segura.
   * Caso contrário, faz fallback direto para o Google Apps Script.
   * @param action Nome da ação a ser executada no backend (ex: 'login', 'getOrders')
   * @param data Dados a serem enviados para a ação (opcional)
   */
  post: async (action: string, data: any = {}) => {
    // 1. Tentar usar o servidor Express local como proxy (evita CORS e melhora a segurança)
    try {
      const response = await fetch("/api/action", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result && typeof result === 'object' && 'success' in result) {
            if (!result.success) {
              throw new Error(result.error || 'Erro retornado pela rota do servidor.');
            }
            return result.data;
          }
        } else {
          throw new Error("A resposta não é um JSON válido (provavelmente é o index.html retornado pelo roteamento SPA).");
        }
      }
    } catch (proxyError: any) {
      console.warn(`[API Proxy] Servidor local indisponível ou erro na ação [${action}]: ${proxyError.message}. Fazendo fallback automático.`);
    }

    // 2. FALLBACK DIRETO (caso o servidor Express local não esteja ativo ou retorne erro)
    const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzvlGDsADQm3iKpb5u3VYQPY4aznvNN7NS_Xc-45nasmPLqjLVtg6OZO-N0t1NK5v4Zfg/exec";
    
    const isInvalidUrl = !url || url.includes('TODO') || url.includes('YOUR_') || url.trim() === '';

    if (isInvalidUrl) {
      throw new Error(`[API] URL do Google Apps Script não configurada ou inválida no ambiente: ${url}`);
    }

    try {
      // Adicionamos um identificador único para evitar cache de navegador indesejado
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`;
      
      // Usamos text/plain para evitar requisições de preflight (CORS) no Apps Script
      // Adicionamos redirect: 'follow' que é essencial para chamadas ao Google Apps Script
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, data }),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição HTTP direta: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro desconhecido retornado pelo Apps Script');
      }
      
      return result.data;
    } catch (error: any) {
      console.error(`[API Direct Fallback] Falha de comunicação direta na ação [${action}]:`, error);
      throw error;
    }
  }
};

