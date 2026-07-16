export const api = {
  /**
   * Função genérica para chamar o backend no Google Apps Script
   * @param action Nome da ação a ser executada no backend (ex: 'login', 'getOrders')
   * @param data Dados a serem enviados para a ação (opcional)
   */
  post: async (action: string, data: any = {}) => {
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
        throw new Error(`Erro na requisição HTTP: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro desconhecido retornado pela API do Google Apps Script');
      }
      
      return result.data;
    } catch (error: any) {
      console.error(`[API] Falha de comunicação na ação [${action}]:`, error);
      throw error;
    }
  }
};
