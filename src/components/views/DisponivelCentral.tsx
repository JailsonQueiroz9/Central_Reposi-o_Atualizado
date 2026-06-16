'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  User, 
  Clock, 
  FileText, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  MapPin, 
  Package, 
  Coins, 
  Send 
} from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

export default function DisponivelCentral() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchItems = async (silent = false, force = false) => {
    if (force) {
      dataCache.invalidate('painelData');
    }
    if (!silent) setLoading(true);
    try {
      const data = await dataCache.get('painelData', () => api.post('getPainelData'), 20000) || [];
      // Filtrar apenas o que está "Disponível na Central"
      const disp = data.filter((m: any) => {
        const status = String(m['Status'] || '').trim().toUpperCase();
        return status === 'DISPONÍVEL NA CENTRAL' || status === 'DISPONIVEL NA CENTRAL';
      });
      setMateriais(disp);
      
      // Auto-re-selecionar se o item ainda existir na lista de pendentes ou limpar se não existir
      if (selectedItem) {
        const stillExists = disp.find((item: any) => item.id === selectedItem.id);
        if (stillExists) {
          setSelectedItem(stillExists);
        } else {
          setSelectedItem(null);
        }
      } else if (disp.length > 0) {
        setSelectedItem(disp[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar itens disponíveis na central:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Busca rápida (filtro local)
  const filteredItems = useMemo(() => {
    return materiais.filter(item => {
      const term = searchTerm.toLowerCase();
      if (!term.trim()) return true;

      return (
        String(item['Ordem'] || '').toLowerCase().includes(term) ||
        String(item['Ord_Rep'] || '').toLowerCase().includes(term) ||
        String(item['N°_Req'] || '').toLowerCase().includes(term) ||
        String(item['Produtos'] || '').toLowerCase().includes(term) ||
        String(item['Descrição'] || '').toLowerCase().includes(term) ||
        String(item['destinatario_nome'] || item['Nome'] || '').toLowerCase().includes(term) ||
        String(item['destinatario_cracha'] || '').toLowerCase().includes(term) ||
        String(item['destinatario_setor'] || item['Setor'] || '').toLowerCase().includes(term)
      );
    });
  }, [materiais, searchTerm]);

  // Se o item selecionado saiu do filtro, ajustar seleção
  useEffect(() => {
    if (selectedItem && !filteredItems.find(item => item.id === selectedItem.id)) {
      if (filteredItems.length > 0) {
        setSelectedItem(filteredItems[0]);
      } else {
        setSelectedItem(null);
      }
    } else if (!selectedItem && filteredItems.length > 0) {
      setSelectedItem(filteredItems[0]);
    }
  }, [filteredItems, selectedItem]);

  // Totalizar quantidades prontas para entrega
  const metrics = useMemo(() => {
    const totalQtd = filteredItems.reduce((sum, item) => {
      const valStr = String(item['Qtd.'] || '0').replace(',', '.').trim();
      const val = parseFloat(valStr);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    return {
      count: filteredItems.length,
      totalQtd
    };
  }, [filteredItems]);

  const handlePagar = async () => {
    if (!selectedItem) return;

    setActionLoading(true);
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      const updateData = {
        id: selectedItem.id,
        Status: 'ENTREGUE',
        Data_Entrega: formattedDate,
        Data_Ent_Central: formattedDate,
        entrega_status: 'ENTREGUE'
      };

      await api.post('updatePainelData', updateData);
      dataCache.invalidate('painelData');
      
      setMessage({ type: 'success', text: `Material entregue com sucesso! Status atualizado para "ENTREGUE".` });
      
      // Atualiza a lista buscando os novos dados atualizados do servidor
      await fetchItems();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao pagar ao destinatário:', error);
      setMessage({ type: 'error', text: 'Erro ao registrar entrega. Tente novamente.' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    // Se já estiver formatada (ex: dd/mm/aaaa) retorna
    if (dateStr.includes('/') && dateStr.includes(':')) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="p-4 md:p-8 h-full bg-gray-50 overflow-y-auto custom-scrollbar flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Top Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg">
              <ClipboardList size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Disponível na Central</h1>
              <p className="text-sm text-gray-500 font-medium font-sans">Controle de materiais separados prontos para pagamento/entrega ao destinatário</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800">Itens Prontos</span>
              <p className="text-2xl font-bold text-emerald-900 font-mono mt-0.5">{metrics.count}</p>
            </div>
            <div className="bg-indigo-50 px-5 py-3 rounded-xl border border-indigo-100 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800">Qtd Separada</span>
              <p className="text-2xl font-bold text-indigo-900 font-mono mt-0.5">
                {metrics.totalQtd.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
              </p>
            </div>
          </div>
        </div>

        {/* Search controls */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-150 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Pesquise Ordem, Ord_Rep, Req, Produto, Destinatário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600 text-sm bg-gray-50/50"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <button 
            onClick={() => fetchItems(false, true)}
            className="px-4 py-2.5 border border-gray-200 hover:border-emerald-600 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50/50 transition-colors shrink-0 flex items-center gap-2"
          >
            Atualizar Lista
          </button>
        </div>

        {/* Content Split: List & Selected Card details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Table / List column */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Lista de Separados para Entrega</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[350px] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Selecionar</th>
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Ord_Rep</th>
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Destinatário</th>
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Produto</th>
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Qtd.</th>
                    <th className="p-4 bg-gray-50 border-b border-gray-100 sticky top-0 z-10 text-left">Und.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400 font-sans">
                        <Loader2 className="animate-spin inline-block mr-2 text-emerald-600" size={20} />
                        Buscando dados na central...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-gray-400 italic font-sans">
                        Nenhum material pendente em &quot;Disponível na Central&quot;.
                      </td>
                    </tr>
                  ) : filteredItems.map((item) => (
                    <tr 
                      key={item.id}
                      className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${selectedItem?.id === item.id ? 'bg-emerald-50/60' : ''}`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="p-4">
                        <input 
                          type="radio" 
                          checked={selectedItem?.id === item.id}
                          onChange={() => setSelectedItem(item)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-800 font-mono">{item['Ord_Rep']}</td>
                      <td className="p-4 text-sm text-gray-750">
                        <div className="font-semibold text-gray-800">
                          {item['destinatario_nome'] || item['Nome'] || '-'}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {item['destinatario_cracha'] || '-'}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate" title={item['Descrição']}>{item['Produtos']}</td>
                      <td className="p-4 text-sm font-bold text-gray-800 font-mono">{item['Qtd.']}</td>
                      <td className="p-4 text-sm text-gray-500 font-medium">{item['Medida'] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right side Detalhes panel & Action */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Main Info Card */}
            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-800 p-4 text-white flex items-center gap-2">
                <Package size={20} className="text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Detalhes do Destinatário</h3>
              </div>

              {selectedItem ? (
                <div className="p-6 space-y-5">
                  {/* Destinatario Info Box */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                      {String(selectedItem['destinatario_nome'] || selectedItem['Nome'] || 'D').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Destinatário</p>
                      <h4 className="text-base font-bold text-gray-800 truncate" title={selectedItem['destinatario_nome'] || selectedItem['Nome']}>
                        {selectedItem['destinatario_nome'] || selectedItem['Nome'] || '-'}
                      </h4>
                      <p className="text-xs text-gray-500 font-mono">Crachá: {selectedItem['destinatario_cracha'] || '-'}</p>
                    </div>
                  </div>

                  {/* Two column metrics layout */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Setor</span>
                      <p className="text-xs font-semibold text-gray-700 truncate">{selectedItem['destinatario_setor'] || selectedItem['Setor'] || '-'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Turno</span>
                      <p className="text-xs font-semibold text-gray-700 truncate">{selectedItem['destinatario_turno'] || selectedItem['Turno'] || '-'}</p>
                    </div>
                  </div>

                  {/* Table details itemized layout */}
                  <div className="border-t border-gray-100 pt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Ordem:</span>
                      <span className="font-mono text-gray-800 font-bold">{selectedItem['Ordem'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Ord_Rep:</span>
                      <span className="font-mono text-gray-800 font-bold">{selectedItem['Ord_Rep'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">N°_Req:</span>
                      <span className="font-mono text-gray-800 font-semibold">{selectedItem['N°_Req'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Marca:</span>
                      <span className="font-sans text-gray-800 font-medium">{selectedItem['Marca'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Produto / Qtd:</span>
                      <span className="font-sans text-gray-800 font-bold">{selectedItem['Produtos']} ({selectedItem['Qtd.']} {selectedItem['Medida']})</span>
                    </div>
                    <div className="text-xs bg-slate-50 p-3 rounded-lg text-gray-600 border border-slate-100 leading-relaxed font-sans">
                      <span className="font-bold block text-slate-500 uppercase text-[9px] mb-1">Descrição:</span>
                      {selectedItem['Descrição'] || 'Nenhuma descrição fornecida.'}
                    </div>
                    {selectedItem['Observação'] && (
                      <div className="text-xs bg-orange-50/50 p-3 rounded-lg text-orange-850 border border-orange-100 leading-relaxed font-sans">
                        <span className="font-bold block text-orange-600 uppercase text-[9px] mb-1">Observação:</span>
                        {selectedItem['Observação']}
                      </div>
                    )}
                  </div>

                  {/* Feedback feedback */}
                  {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 text-xs ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                      {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span className="font-medium">{message.text}</span>
                    </div>
                  )}

                  {/* Action Pagar Destinatário */}
                  <button
                    onClick={handlePagar}
                    disabled={actionLoading}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="animate-spin inline-block" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                    <span>PAGAR AO DESTINATÁRIO</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 italic text-sm font-sans">
                  Selecione um item da lista para verificar os detalhes e pagar.
                </div>
              )}
            </div>
            
          </div>

        </div>

      </div>
    </div>
  );
}
