import { api } from './api';
import { dataCache } from './cache';

export interface HistoricoItem {
  id?: string;
  Data_Hora: string;
  Acao: string;
  Usuario_Nome: string;
  Usuario_Cracha: string;
  Ordem: string;
  Ord_Rep: string;
  N_Req: string;
  Produto: string;
  Descricao: string;
  Qtd: string | number;
  Medida: string;
  TAM: string;
  Destinatario_Nome: string;
  Destinatario_Setor: string;
  Status_Anterior: string;
  Status_Novo: string;
  [key: string]: any;
}

const LOCAL_STORAGE_KEY = 'pcp_historico_local';

export const registrarHistorico = async (entry: Partial<HistoricoItem>, currentUser?: any) => {
  try {
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const item: HistoricoItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      Data_Hora: entry.Data_Hora || formattedDate,
      Acao: entry.Acao || 'MOVIMENTAÇÃO',
      Usuario_Nome: currentUser?.nome || currentUser?.['NOME'] || currentUser?.email || entry.Usuario_Nome || 'Usuário',
      Usuario_Cracha: currentUser?.cracha || currentUser?.['CRACHÁ'] || currentUser?.['CRACHA'] || entry.Usuario_Cracha || '-',
      Ordem: entry.Ordem || '-',
      Ord_Rep: entry.Ord_Rep || '-',
      N_Req: entry.N_Req || entry['N°_Req'] || entry.nReq || '-',
      Produto: entry.Produto || entry.Produtos || '-',
      Descricao: entry.Descricao || entry['Descrição'] || entry.descricao || '-',
      Qtd: entry.Qtd || entry['Qtd.'] || entry.quantidade || '-',
      Medida: entry.Medida || '-',
      TAM: entry.TAM || entry['TAM.'] || '-',
      Destinatario_Nome: entry.Destinatario_Nome || entry.destinatario_nome || entry.entrega_nome || entry.Nome || '-',
      Destinatario_Setor: entry.Destinatario_Setor || entry.destinatario_setor || entry.Setor || '-',
      Status_Anterior: entry.Status_Anterior || '-',
      Status_Novo: entry.Status_Novo || '-'
    };

    // 1. Salvar no localStorage local para garantia de renderização imediata
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: HistoricoItem[] = stored ? JSON.parse(stored) : [];
      list.unshift(item);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 500)));
    } catch (err) {
      console.warn('Erro ao salvar no localStorage do histórico:', err);
    }

    // 2. Invalidar cache
    dataCache.invalidate('historicoData');

    // 3. Enviar para a API/banco de dados (Aba Histórico)
    await api.post('saveHistoricoData', item);
    return item;
  } catch (error) {
    console.error('Erro ao registrar histórico no servidor:', error);
    return null;
  }
};

export const buscarHistorico = async (forceRefresh = false): Promise<HistoricoItem[]> => {
  if (forceRefresh) {
    dataCache.invalidate('historicoData');
  }

  let serverList: HistoricoItem[] = [];
  try {
    const data = await dataCache.get('historicoData', () => api.post('getHistoricoData'), 10000);
    if (Array.isArray(data)) {
      serverList = data;
    }
  } catch (error) {
    console.warn('Erro ao buscar histórico do servidor, usando fallback local:', error);
  }

  // Buscar itens locais
  let localList: HistoricoItem[] = [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) localList = JSON.parse(stored);
  } catch (e) {}

  // Mesclar dados sem duplicatas
  const map = new Map<string, HistoricoItem>();

  // Adiciona do servidor primeiro
  serverList.forEach((i, index) => {
    const key = i.id || `${i.Data_Hora}_${i.Ordem}_${i.Acao}_${index}`;
    map.set(key, i);
  });

  // Adiciona do local
  localList.forEach((i, index) => {
    const key = i.id || `${i.Data_Hora}_${i.Ordem}_${i.Acao}_${index}`;
    if (!map.has(key)) {
      map.set(key, i);
    }
  });

  const merged = Array.from(map.values());

  // Ordena por data/hora mais recente
  return merged.sort((a, b) => {
    const dateA = parseDateStrToTimestamp(a.Data_Hora);
    const dateB = parseDateStrToTimestamp(b.Data_Hora);
    return dateB - dateA;
  });
};

function parseDateStrToTimestamp(str: string): number {
  if (!str) return 0;
  try {
    if (str.includes('/')) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);

      let hours = 0, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
      }
      return new Date(year, month, day, hours, minutes, seconds).getTime();
    }
    return new Date(str).getTime() || 0;
  } catch (e) {
    return 0;
  }
}
