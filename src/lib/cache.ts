/**
 * Utilitário de Cache para Redundância de Dados e Otimização de Performance
 */
class DataCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private defaultTTL: number = 15000; // 15 segundos por padrão

  /**
   * Obtém dados do cache ou executa a função para buscar novos dados
   * @param key Chave única para o cache
   * @param fetcher Função que retorna uma Promise com os dados
   * @param ttl Tempo de vida do cache em milissegundos
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && now - cached.timestamp < ttl) {
      console.log(`[CACHE] Usando dados redundantes para: ${key} (Restante: ${Math.round((ttl - (now - cached.timestamp)) / 1000)}s)`);
      return cached.data as T;
    }

    console.log(`[DEBUG] Cache expirado ou inexistente para: ${key}. Buscando novos dados...`);
    const startTime = performance.now();
    
    try {
      const data = await fetcher();
      const endTime = performance.now();
      console.log(`[DEBUG] Busca para ${key} concluída em ${Math.round(endTime - startTime)}ms`);
      
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`[DEBUG] Erro ao buscar dados para ${key}:`, error);
      // Se houver erro na busca, mas tivermos dados antigos, retornamos os antigos como redundância crítica
      if (cached) {
        console.warn(`[CACHE] Retornando dados antigos por falha na rede (Redundância Crítica) para: ${key}`);
        return cached.data as T;
      }
      throw error;
    }
  }

  /**
   * Padrão Stale-While-Revalidate (SWR)
   * Retorna o cache IMEDIATAMENTE e executa a atualização em segundo plano
   * @param key Chave única para o cache
   * @param fetcher Função que retorna uma Promise com os dados
   * @param onUpdate Callback chamado quando os dados novos chegam
   * @param ttl Tempo de vida do cache (padrão 30s)
   */
  async swr<T>(key: string, fetcher: () => Promise<T>, onUpdate: (data: T) => void, ttl: number = 30000): Promise<void> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // 1. Se tem cache, envia para o UI imediatamente
    if (cached) {
      console.log(`[SWR] Enviando dados em cache para: ${key}`);
      onUpdate(cached.data as T);
      
      // Se o cache ainda é muito novo (menos de 5s), não precisa nem revalidar agora
      if (now - cached.timestamp < 5000) return;
    }

    // 2. Busca dados novos em segundo plano
    try {
      console.log(`[SWR] Revalidando dados para: ${key}...`);
      const freshData = await fetcher();
      this.cache.set(key, { data: freshData, timestamp: now });
      onUpdate(freshData);
      console.log(`[SWR] Dados revalidados com sucesso para: ${key}`);
    } catch (error) {
      console.error(`[SWR] Falha ao revalidar ${key}:`, error);
      // Se falhar e não tivermos cache nenhum, repassa o erro
      if (!cached) throw error;
    }
  }

  /**
   * Armazena dados manualmente no cache (útil para prefetch)
   */
  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Limpa uma chave específica do cache
   */
  invalidate(key: string) {
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    this.cache.clear();
  }
}

export const dataCache = new DataCache();
