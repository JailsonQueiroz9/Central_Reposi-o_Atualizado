import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  User, 
  Clock, 
  FileText, 
  CheckCircle2, 
  PackageCheck, 
  Box, 
  Filter, 
  Download, 
  RefreshCw, 
  ArrowRight, 
  Calendar, 
  Layers, 
  ScanLine, 
  AlertCircle,
  X,
  ChevronRight
} from 'lucide-react';
import { buscarHistorico, HistoricoItem } from '@/lib/historico';

export default function Historico({ currentUser }: { currentUser?: any }) {
  const [historicoList, setHistoricoList] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<'TODAS' | 'SEPARACAO' | 'ENTREGA'>('TODAS');
  const [periodFilter, setPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');
  const [selectedItem, setSelectedItem] = useState<HistoricoItem | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await buscarHistorico(forceRefresh);
      setHistoricoList(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh silencioso a cada 15s
    const interval = setInterval(() => {
      buscarHistorico(false).then(setHistoricoList).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Normalização e busca
  const filteredList = useMemo(() => {
    return historicoList.filter(item => {
      // 1. Filtro de Texto
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchOrdem = String(item.Ordem || '').toLowerCase().includes(term);
        const matchOrdRep = String(item.Ord_Rep || '').toLowerCase().includes(term);
        const matchReq = String(item.N_Req || item['N°_Req'] || '').toLowerCase().includes(term);
        const matchProduto = String(item.Produto || '').toLowerCase().includes(term);
        const matchDesc = String(item.Descricao || '').toLowerCase().includes(term);
        const matchUser = String(item.Usuario_Nome || '').toLowerCase().includes(term);
        const matchCracha = String(item.Usuario_Cracha || '').toLowerCase().includes(term);
        const matchDest = String(item.Destinatario_Nome || '').toLowerCase().includes(term);
        const matchAcao = String(item.Acao || '').toLowerCase().includes(term);

        if (!(matchOrdem || matchOrdRep || matchReq || matchProduto || matchDesc || matchUser || matchCracha || matchDest || matchAcao)) {
          return false;
        }
      }

      // 2. Filtro de Ação
      if (actionFilter !== 'TODAS') {
        const acao = String(item.Acao || '').toUpperCase();
        if (actionFilter === 'SEPARACAO' && !acao.includes('SEPARAÇÃO') && !acao.includes('SEPARACAO')) {
          return false;
        }
        if (actionFilter === 'ENTREGA' && !acao.includes('ENTREGA')) {
          return false;
        }
      }

      // 3. Filtro de Período
      if (periodFilter !== 'TODOS') {
        const itemTs = parseDateStrToTimestamp(item.Data_Hora);
        const now = new Date();

        if (periodFilter === 'HOJE') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (itemTs < startOfDay) return false;
        } else if (periodFilter === '7DIAS') {
          const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
          if (itemTs < sevenDaysAgo) return false;
        } else if (periodFilter === '30DIAS') {
          const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
          if (itemTs < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [historicoList, searchTerm, actionFilter, periodFilter]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let totalSeparacao = 0;
    let totalEntrega = 0;
    let totalHoje = 0;

    historicoList.forEach(item => {
      const acao = String(item.Acao || '').toUpperCase();
      if (acao.includes('SEPARAÇÃO') || acao.includes('SEPARACAO')) {
        totalSeparacao++;
      } else if (acao.includes('ENTREGA')) {
        totalEntrega++;
      }

      const ts = parseDateStrToTimestamp(item.Data_Hora);
      if (ts >= startOfDay) {
        totalHoje++;
      }
    });

    return {
      total: historicoList.length,
      separacao: totalSeparacao,
      entrega: totalEntrega,
      hoje: totalHoje
    };
  }, [historicoList]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;

    const headers = ['Data_Hora', 'Acao', 'Usuario_Nome', 'Usuario_Cracha', 'Ordem', 'Ord_Rep', 'N_Req', 'Produto', 'Descricao', 'Qtd', 'Medida', 'TAM', 'Destinatario_Nome', 'Destinatario_Setor', 'Status_Anterior', 'Status_Novo'];
    
    const rows = filteredList.map(item => [
      `"${item.Data_Hora || ''}"`,
      `"${item.Acao || ''}"`,
      `"${item.Usuario_Nome || ''}"`,
      `"${item.Usuario_Cracha || ''}"`,
      `"${item.Ordem || ''}"`,
      `"${item.Ord_Rep || ''}"`,
      `"${item.N_Req || ''}"`,
      `"${(item.Produto || '').replace(/"/g, '""')}"`,
      `"${(item.Descricao || '').replace(/"/g, '""')}"`,
      `"${item.Qtd || ''}"`,
      `"${item.Medida || ''}"`,
      `"${item.TAM || ''}"`,
      `"${(item.Destinatario_Nome || '').replace(/"/g, '""')}"`,
      `"${(item.Destinatario_Setor || '').replace(/"/g, '""')}"`,
      `"${item.Status_Anterior || ''}"`,
      `"${item.Status_Novo || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historico_movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 h-full bg-gray-50 overflow-y-auto custom-scrollbar flex flex-col gap-6">
      <div className="max-w-[1800px] mx-auto w-full space-y-6">

        {/* Top Header */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-800 text-white rounded-xl shadow-md">
              <History size={28} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-wide">Histórico de Movimentações</h1>
              <p className="text-sm text-gray-500 font-medium font-sans">
                Registro consolidado de confirmação de separações e registros de entregas
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/60 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total</span>
              <p className="text-xl font-bold text-slate-800 font-mono mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800">Separações</span>
              <p className="text-xl font-bold text-emerald-900 font-mono mt-0.5">{stats.separacao}</p>
            </div>
            <div className="bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800">Entregas</span>
              <p className="text-xl font-bold text-indigo-900 font-mono mt-0.5">{stats.entrega}</p>
            </div>
            <div className="bg-orange-50 px-4 py-2.5 rounded-xl border border-orange-100 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-orange-800">Hoje</span>
              <p className="text-xl font-bold text-orange-900 font-mono mt-0.5">{stats.hoje}</p>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="Pesquisar por Ordem, Ord_Rep, Req, Produto, Usuário, Destinatário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-slate-800 text-sm bg-gray-50/50 text-gray-800 font-medium"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Action Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setActionFilter('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                actionFilter === 'TODAS' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todas Ações
            </button>
            <button
              onClick={() => setActionFilter('SEPARACAO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                actionFilter === 'SEPARACAO' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Box size={14} />
              Separação
            </button>
            <button
              onClick={() => setActionFilter('ENTREGA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                actionFilter === 'ENTREGA' ? 'bg-[#483D8B] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PackageCheck size={14} />
              Entrega
            </button>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setPeriodFilter('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodFilter === 'TODOS' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todo Período
            </button>
            <button
              onClick={() => setPeriodFilter('HOJE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodFilter === 'HOJE' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodFilter('7DIAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodFilter === '7DIAS' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Últimos 7 dias
            </button>
          </div>

          {/* Buttons: Refresh and Export */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="p-2.5 border border-gray-200 hover:border-slate-800 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="Atualizar Histórico"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-slate-800' : 'text-gray-600'} />
              <span className="hidden sm:inline text-xs font-bold">Atualizar</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredList.length === 0}
              className="p-2.5 border border-emerald-200 hover:bg-emerald-50 rounded-xl text-xs font-bold text-emerald-800 bg-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              title="Exportar dados para CSV"
            >
              <Download size={18} className="text-emerald-700" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>

        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-500" />
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                Registros de Movimentação ({filteredList.length})
              </h2>
            </div>
            {searchTerm && (
              <span className="text-xs text-gray-500 font-medium">
                Filtrado por: <strong className="text-slate-800">&quot;{searchTerm}&quot;</strong>
              </span>
            )}
          </div>

          {loading && historicoList.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <RefreshCw size={32} className="animate-spin text-slate-800" />
              <p className="text-sm font-medium text-gray-500">Carregando histórico de movimentações...</p>
            </div>
          ) : filteredList.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <th className="p-3.5 pl-4">Data / Hora</th>
                    <th className="p-3.5">Ação Realizada</th>
                    <th className="p-3.5">Usuário (Responsável)</th>
                    <th className="p-3.5">Ord_Rep / Ordem</th>
                    <th className="p-3.5">N°_Req</th>
                    <th className="p-3.5">Produto & Descrição</th>
                    <th className="p-3.5 text-center">Qtd / Med.</th>
                    <th className="p-3.5">Destinatário</th>
                    <th className="p-3.5 pr-4">Transição de Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredList.map((item, index) => {
                    const acaoUpper = String(item.Acao || '').toUpperCase();
                    const isSeparacao = acaoUpper.includes('SEPARAÇÃO') || acaoUpper.includes('SEPARACAO');
                    const isEntrega = acaoUpper.includes('ENTREGA');

                    return (
                      <tr 
                        key={item.id || index}
                        onClick={() => setSelectedItem(item)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Data / Hora */}
                        <td className="p-3.5 pl-4 font-mono text-gray-700 whitespace-nowrap">
                          {item.Data_Hora || '-'}
                        </td>

                        {/* Ação Realizada */}
                        <td className="p-3.5 whitespace-nowrap">
                          {isSeparacao ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Box size={12} />
                              {item.Acao}
                            </span>
                          ) : isEntrega ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-900 border border-indigo-200">
                              <PackageCheck size={12} />
                              {item.Acao}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-gray-100 text-gray-800 border border-gray-200">
                              <Clock size={12} />
                              {item.Acao}
                            </span>
                          )}
                        </td>

                        {/* Usuário Responsável */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800 flex items-center gap-1">
                              <User size={12} className="text-gray-400" />
                              {item.Usuario_Nome || 'Usuário'}
                            </span>
                            {item.Usuario_Cracha && item.Usuario_Cracha !== '-' && (
                              <span className="text-[10px] text-gray-400 font-mono pl-4">
                                Crachá: {item.Usuario_Cracha}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ord_Rep / Ordem */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex flex-col font-mono">
                            <span className="font-bold text-slate-800">{item.Ord_Rep || '-'}</span>
                            <span className="text-[10px] text-gray-400">Ord: {item.Ordem || '-'}</span>
                          </div>
                        </td>

                        {/* N°_Req */}
                        <td className="p-3.5 font-mono text-gray-700 whitespace-nowrap">
                          {item.N_Req || item['N°_Req'] || '-'}
                        </td>

                        {/* Produto & Descrição */}
                        <td className="p-3.5 max-w-[280px]">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-800">{item.Produto || '-'}</span>
                            <span className="text-[11px] text-gray-500 truncate" title={item.Descricao}>
                              {item.Descricao || '-'}
                            </span>
                          </div>
                        </td>

                        {/* Quantidade e Medida */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 font-mono text-sm">
                            {item.Qtd || item['Qtd.'] || '-'}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 ml-1">
                            {item.Medida || ''}
                          </span>
                          {item.TAM && item.TAM !== '-' && (
                            <span className="block text-[10px] text-gray-400">Tam: {item.TAM}</span>
                          )}
                        </td>

                        {/* Destinatário */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800">{item.Destinatario_Nome || '-'}</span>
                            <span className="text-[10px] text-gray-400">{item.Destinatario_Setor || '-'}</span>
                          </div>
                        </td>

                        {/* Transição de Status */}
                        <td className="p-3.5 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                            <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {item.Status_Anterior || 'Aguardando'}
                            </span>
                            <ArrowRight size={12} className="text-gray-400 shrink-0" />
                            <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-100">
                              {item.Status_Novo || 'Atualizado'}
                            </span>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-gray-50/50">
              <FileText size={40} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700">Nenhum registro de histórico encontrado</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                {searchTerm || actionFilter !== 'TODAS' || periodFilter !== 'TODOS'
                  ? 'Tente ajustar os filtros de busca ou período acima para visualizar outros registros.'
                  : 'À medida que os usuários confirmarem separações ou registrarem entregas, os dados serão automaticamente salvos e exibidos nesta aba.'}
              </p>
            </div>
          )}

        </div>

        {/* Detail Modal */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-in fade-in zoom-in-95 duration-150">
              
              <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <History className="text-orange-400" size={22} />
                  <div>
                    <h3 className="text-base font-bold">Detalhes da Movimentação</h3>
                    <p className="text-xs text-gray-400 font-mono">{selectedItem.Data_Hora}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm text-gray-700 max-h-[80vh] overflow-y-auto custom-scrollbar">
                
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ação</span>
                    <span className="font-extrabold text-slate-800 text-sm">{selectedItem.Acao}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Responsável</span>
                    <span className="font-bold text-slate-800">{selectedItem.Usuario_Nome}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Ord_Rep</span>
                    <span className="font-mono font-bold text-gray-800 text-base">{selectedItem.Ord_Rep || '-'}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Ordem</span>
                    <span className="font-mono font-bold text-gray-800 text-base">{selectedItem.Ordem || '-'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 uppercase font-bold text-[10px]">Produto</span>
                    <span className="font-mono font-bold text-gray-800">{selectedItem.Produto}</span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium">{selectedItem.Descricao || '-'}</p>
                  <div className="pt-2 flex justify-between items-center text-xs border-t border-gray-200/60 mt-2">
                    <span className="text-gray-500 font-medium">Quantidade:</span>
                    <span className="font-extrabold text-slate-900 font-mono text-sm">
                      {selectedItem.Qtd} {selectedItem.Medida}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Destinatário</span>
                  <p className="font-bold text-gray-800 text-sm">{selectedItem.Destinatario_Nome || '-'}</p>
                  <p className="text-xs text-gray-500">{selectedItem.Destinatario_Setor || '-'}</p>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Status Anterior</span>
                    <span className="font-semibold text-gray-700">{selectedItem.Status_Anterior || '-'}</span>
                  </div>
                  <ArrowRight size={16} className="text-emerald-600" />
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Status Atualizado</span>
                    <span className="font-bold text-emerald-900">{selectedItem.Status_Novo || '-'}</span>
                  </div>
                </div>

              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

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
