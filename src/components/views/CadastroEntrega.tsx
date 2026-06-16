'use client';
import React, { useState, useEffect } from 'react';
import { PackageCheck, Search, User, Clock, Briefcase, FileText, Activity, CheckCircle2, AlertCircle, Box, ScanLine } from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

export default function CadastroEntrega() {
  const [loading, setLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'m2' | 'aviamentos'>('m2');

  // Filtra itens M²
  const m2Items = React.useMemo(() => {
    return pendingItems.filter(item => 
      String(item['Medida'] || '').toUpperCase().trim() === 'M²'
    );
  }, [pendingItems]);

  // Filtra itens Aviamento (PAR, UND, KG, M, MIL)
  const aviamentoItems = React.useMemo(() => {
    return pendingItems.filter(item => 
      ['PAR', 'UND', 'KG', 'M', 'MIL'].includes(String(item['Medida'] || '').toUpperCase().trim())
    );
  }, [pendingItems]);

  const displayedItems = activeTab === 'm2' ? m2Items : aviamentoItems;

  const fetchItems = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const painelData = await dataCache.get('painelData', () => api.post('getPainelData'), 10000) || [];
      // Filtra por status que sejam MPOK ou que já estejam em separação ('SEPARACAO M²', 'SEPARACAO AVIAMENTOS', etc)
      const items = painelData.filter((r: any) => {
        const uStatus = String(r['Status'] || '').trim().toUpperCase();
        return uStatus === 'MPOK' || uStatus.includes('SEPARACAO') || uStatus.includes('SEPARAÇÃO');
      });
      setPendingItems(items);
    } catch (error) {
      console.error('Erro ao buscar dados de entrega:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // Refresh automático de segundo plano rápido (silencioso) a cada 10 segundos
    const interval = setInterval(() => {
      fetchItems(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Ajusta automaticamente a seleção do item quando mudar de aba ou quando a lista carregar
  useEffect(() => {
    if (displayedItems.length > 0) {
      const stillInList = displayedItems.find(i => i.id === selectedItem?.id);
      if (!stillInList) {
        setSelectedItem(displayedItems[0]);
      }
    } else {
      setSelectedItem(null);
    }
  }, [activeTab, pendingItems, displayedItems]);

  const handleEntrega = async () => {
    if (!selectedItem) return;

    setLoading(true);
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      const updateData = {
        id: selectedItem.id,
        Status: 'ENTREGUE',
        Data_Entrega: formattedDate,
        entrega_status: 'ENTREGUE'
      };

      await api.post('updatePainelData', updateData);
      dataCache.invalidate('painelData');
      
      setMessage({ type: 'success', text: 'Entrega realizada com sucesso!' });
      
      // Remove o item da lista local
      const updatedItems = pendingItems.filter(item => item.id !== selectedItem.id);
      setPendingItems(updatedItems);
      if (updatedItems.length > 0) {
        setSelectedItem(updatedItems[0]);
      } else {
        setSelectedItem(null);
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao realizar entrega:', error);
      setMessage({ type: 'error', text: 'Erro ao realizar entrega. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSeparacao = async () => {
    if (!selectedItem) return;

    setLoading(true);
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      const medida = String(selectedItem['Medida'] || '').toUpperCase().trim();
      
      const updateData: any = {
        id: selectedItem.id,
        Status: 'Disponível na Central'
      };

      if (medida === 'M²' || medida === 'M') {
        updateData['Data_Ent_Almox.'] = formattedDate;
      } else if (['PAR', 'UND', 'KG', 'MIL'].includes(medida)) {
        updateData['Data_Ent_Avi'] = formattedDate;
      } else {
        // Fallback robust: update Data_Ent_Almox.
        updateData['Data_Ent_Almox.'] = formattedDate;
      }

      await api.post('updatePainelData', updateData);
      dataCache.invalidate('painelData');
      
      setMessage({ type: 'success', text: `Separação confirmada! Status atualizado para "Disponível na Central".` });
      
      // Remove o item da lista local ou atualiza
      const updatedItems = pendingItems.filter(item => item.id !== selectedItem.id);
      setPendingItems(updatedItems);
      if (updatedItems.length > 0) {
        setSelectedItem(updatedItems[0]);
      } else {
        setSelectedItem(null);
      }

      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      console.error('Erro ao realizar separação:', error);
      setMessage({ type: 'error', text: 'Erro ao registrar separação. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 w-full min-h-full bg-gray-50 flex flex-col items-center overflow-y-auto custom-scrollbar pb-24">
      <div className="w-full max-w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mt-4">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 text-white flex items-center gap-3">
          <PackageCheck size={32} className="text-orange-400" />
          <h1 className="text-2xl font-bold tracking-wide">Cadastro Entrega</h1>
        </div>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          
          {/* Main Input Area */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* Botão Atualizar Lista */}
            <div className="md:col-span-1 bg-gray-50/50 rounded-xl p-6 flex flex-col justify-center items-center border border-gray-100 shadow-sm min-h-[140px]">
              <button 
                onClick={() => fetchItems()}
                disabled={loading}
                className="px-8 py-3 bg-white border border-gray-200 rounded-full text-[#1b437e] hover:text-blue-800 text-sm font-semibold tracking-wide shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer transform active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1b437e]"></div>
                ) : (
                  <svg className="w-4 h-4 text-[#1b437e]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 16H18m0 0l2 2m-2-2l-2 2" />
                  </svg>
                )}
                Atualizar Lista
              </button>
            </div>

            {/* Info Grid */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <User size={14} /> Nome
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem] break-words">
                  {selectedItem?.destinatario_nome || selectedItem?.entrega_nome || selectedItem?.Nome || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <Clock size={14} /> Turno
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem]">
                  {selectedItem?.destinatario_turno || selectedItem?.entrega_turno || selectedItem?.Turno || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <Search size={14} /> Desc. Cel
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem] break-words">
                  {selectedItem?.destinatario_descCel || selectedItem?.entrega_descCel || selectedItem?.['Desc.Cel'] || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <Briefcase size={14} /> Função
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem] break-words">
                  {selectedItem?.destinatario_funcao || selectedItem?.entrega_funcao || selectedItem?.['Função'] || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <PackageCheck size={14} /> Ordem
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem]">
                  {selectedItem?.Ordem || selectedItem?.ordem || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <ScanLine size={14} /> Ord_Rep
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem]">
                  {selectedItem?.Ord_Rep || selectedItem?.ordRep || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <FileText size={14} /> N°_Req
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem]">
                  {selectedItem?.['N°_Req'] || selectedItem?.nReq || '-'}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <Activity size={14} /> Marca
                </div>
                <div className="text-base font-medium text-gray-800 min-h-[1.5rem]">
                  {selectedItem?.Marca || selectedItem?.marca || '-'}
                </div>
              </div>

            </div>
          </div>

          {/* Sub-screens Selector (Tabs) */}
          <div className="flex border-b border-gray-200 font-sans mt-4">
            <button
              onClick={() => setActiveTab('m2')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'm2'
                  ? 'border-emerald-600 text-emerald-800 bg-emerald-50/20'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
            >
              <Box size={18} className={activeTab === 'm2' ? "text-emerald-600" : "text-gray-400"} />
              <span>Itens Pendentes para Entrega M² (M²)</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'm2' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {m2Items.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('aviamentos')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'aviamentos'
                  ? 'border-indigo-600 text-[#483D8B] bg-indigo-50/10'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
              }`}
            >
              <PackageCheck size={18} className={activeTab === 'aviamentos' ? "text-indigo-600" : "text-gray-400"} />
              <span>Itens Pendentes para Entrega Aviamento (PAR, UND, KG, M, MIL)</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'aviamentos' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {aviamentoItems.length}
              </span>
            </button>
          </div>

          {/* Pending Items Section */}
          <div className="mt-4">
            <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-slate-800" />
              {activeTab === 'm2' ? 'Itens Pendentes para Entrega M²' : 'Itens Pendentes para Entrega Aviamento'}
            </h2>
            {displayedItems.length > 0 ? (
              <div className="overflow-x-auto overflow-y-auto max-h-[350px] custom-scrollbar rounded-xl border border-gray-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-gray-600 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Selecionar</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Ord_Rep</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Produto</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Descrição</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Qtd.</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">Und. Med.</th>
                      <th className="p-4 font-bold border-b border-gray-200 bg-gray-50 sticky top-0 z-10">TAM.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedItem?.id === item.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="p-4">
                          <input 
                            type="radio" 
                            checked={selectedItem?.id === item.id} 
                            onChange={() => setSelectedItem(item)}
                            className="w-4 h-4 text-blue-600"
                          />
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-800">{item.Ord_Rep}</td>
                        <td className="p-4 text-sm text-gray-600">{item.Produtos}</td>
                        <td className="p-4 text-sm text-gray-600">{item['Descrição']}</td>
                        <td className="p-4 text-sm text-gray-600 font-bold">{item['Qtd.']}</td>
                        <td className="p-4 text-sm text-gray-600 font-semibold text-emerald-700">{item['Medida'] || '-'}</td>
                        <td className="p-4 text-sm text-gray-600">{item['TAM.']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <FileText className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="font-medium text-lg">Nenhum item pendente para entrega nesta categoria</p>
                <p className="text-sm text-gray-400 mt-1 flex justify-center items-center gap-1">Clique em <strong className="text-[#1b437e]">&quot;Atualizar Lista&quot;</strong> para buscar dados atualizados.</p>
              </div>
            )}
          </div>

          {/* Message Feedback */}
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6 pb-2 border-t border-gray-100">
            {activeTab === 'm2' ? (
              /* Button for Separação */
              <button 
                onClick={handleSeparacao}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl font-bold text-base sm:text-lg tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto justify-center"
                disabled={!selectedItem || loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Box size={22} className="shrink-0" />
                )}
                <span>{loading ? 'PROCESSANDO...' : 'CONFIRMAR SEPARAÇÃO'}</span>
              </button>
            ) : (
              /* Button for Entrega */
              <button 
                onClick={handleEntrega}
                className="bg-[#483D8B] hover:bg-[#3b3175] text-white px-8 py-3.5 rounded-xl font-bold text-base sm:text-lg tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto justify-center"
                disabled={!selectedItem || loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <PackageCheck size={22} className="shrink-0" />
                )}
                <span>{loading ? 'PROCESSANDO...' : 'REGISTRAR ENTREGA'}</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
