'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Search, 
  ScanLine, 
  User, 
  Clock, 
  Briefcase, 
  FileText, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  ArrowRight, 
  Trash2, 
  Edit3, 
  Save,
  Layers,
  Scissors,
  Box,
  Plus,
  RefreshCcw
} from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import { motion, AnimatePresence } from 'motion/react';

type Mode = 'entrada' | 'separacao';
type SeparacaoType = 'M²' | 'Aviamentos';

export default function CadastroAlmx() {
  const [mode, setMode] = useState<Mode>('entrada');
  const [separacaoType, setSeparacaoType] = useState<SeparacaoType>('M²');
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const handleSearch = async (val: string) => {
    setBarcode(val);
    if (!val || val.length < 3) {
      setPendingItems([]);
      setSelectedItem(null);
      return;
    }

    setLoading(true);
    try {
      const painelData = await dataCache.get('painelData', () => api.post('getPainelData'), 10000) || [];
      
      // Busca por Ordem, Ord_Rep ou Crachá Destinatário
      const items = painelData.filter((r: any) => {
        const searchVal = String(val).toUpperCase();
        const matchesOrdem = String(r['Ordem'] || '').toUpperCase().includes(searchVal);
        const matchesOrdRep = String(r['Ord_Rep'] || '').toUpperCase().includes(searchVal);
        const matchesCracha = String(r['destinatario_cracha'] || '').toUpperCase() === searchVal;
        
        if (mode === 'entrada') {
          // Para entrada, buscamos itens que ainda não entraram no almox
          return (matchesOrdem || matchesOrdRep || matchesCracha) && 
                 (!r['Data_Ent_Almox.'] || r['Status'] === 'VRMP');
        } else {
          // Para separação, buscamos itens que já entraram (MPOK) mas não foram separados
          const statusUpper = (r['Status'] || '').toUpperCase();
          return (matchesOrdem || matchesOrdRep || matchesCracha) && 
                 (statusUpper === 'MPOK' || statusUpper.includes('SEPARACAO') || statusUpper.includes('SEPARAÇÃO'));
        }
      });

      setPendingItems(items);
      if (items.length > 0) {
        setSelectedItem(items[0]);
      } else {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedItem) return;

    setLoading(true);
    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      let updateData: any = { id: selectedItem.id };

      if (mode === 'entrada') {
        updateData.Status = 'MPOK';
        updateData['Data_Ent_Almox.'] = formattedDate;
      } else {
        const status = separacaoType === 'M²' ? 'SEPARAÇÃO M²' : 'SEPARAÇÃO AVIAMENTOS';
        updateData.Status = status;
        if (separacaoType === 'Aviamentos') {
          updateData.Data_Ent_Avi = formattedDate;
        } else {
          updateData.Data_Separacao = formattedDate;
        }
      }

      await api.post('updatePainelData', updateData);
      
      setMessage({ 
        type: 'success', 
        text: mode === 'entrada' ? 'Entrada registrada com sucesso!' : `Separação ${separacaoType} registrada!` 
      });
      
      // Atualiza lista local
      const updatedItems = pendingItems.filter(item => item.id !== selectedItem.id);
      setPendingItems(updatedItems);
      if (updatedItems.length > 0) {
        setSelectedItem(updatedItems[0]);
      } else {
        setSelectedItem(null);
        setBarcode('');
      }

      setTimeout(() => setMessage(null), 3000);
      dataCache.invalidate('painelData');
    } catch (error) {
      console.error('Erro na operação:', error);
      setMessage({ type: 'error', text: 'Erro ao processar. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    
    setLoading(true);
    try {
      await api.post('deletePainelData', { id });
      setPendingItems(prev => prev.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      setMessage({ type: 'success', text: 'Registro excluído com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
      dataCache.invalidate('painelData');
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao excluir registro.' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    setIsEditing(true);
    setEditData({ ...selectedItem });
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await api.post('updatePainelData', editData);
      setSelectedItem(editData);
      setPendingItems(prev => prev.map(item => item.id === editData.id ? editData : item));
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Registro atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
      dataCache.invalidate('painelData');
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 h-full bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Mode Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${mode === 'entrada' ? 'bg-blue-600' : 'bg-purple-600'} text-white shadow-lg`}>
              {mode === 'entrada' ? <Database size={28} /> : <Scissors size={28} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Cadastro Almoxarifado</h1>
              <p className="text-sm text-gray-500 font-medium">Gestão de materiais e separação</p>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => { setMode('entrada'); setBarcode(''); setPendingItems([]); setSelectedItem(null); }}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'entrada' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ENTRADA
            </button>
            <button 
              onClick={() => { setMode('separacao'); setBarcode(''); setPendingItems([]); setSelectedItem(null); }}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'separacao' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              SEPARAÇÃO
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Search & Selection */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pesquisar Ordem / Crachá</label>
                <div className="relative">
                  <input 
                    ref={inputRef}
                    type="text" 
                    value={barcode}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Escaneie ou digite..." 
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none text-lg font-mono transition-all"
                  />
                  <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                  {loading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>

              {mode === 'separacao' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo de Separação</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setSeparacaoType('M²')}
                      className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${separacaoType === 'M²' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-100 text-gray-500'}`}
                    >
                      M²
                    </button>
                    <button 
                      onClick={() => setSeparacaoType('Aviamentos')}
                      className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${separacaoType === 'Aviamentos' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-gray-100 text-gray-500'}`}
                    >
                      AVIAMENTOS
                    </button>
                  </div>
                </div>
              )}

              {pendingItems.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Itens Encontrados ({pendingItems.length})</label>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {pendingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedItem?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-gray-50 bg-gray-50 hover:border-gray-200'}`}
                      >
                        <div className="font-bold text-gray-800">Ordem: {item.Ordem || item.Ord_Rep}</div>
                        <div className="text-xs text-gray-500 truncate">{item.Produtos || 'Sem descrição'}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-1 bg-white rounded-md border border-gray-200 uppercase">{item.Status || 'S/ STATUS'}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{item.id.slice(0, 8)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Details & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {selectedItem ? (
                <motion.div 
                  key={selectedItem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Detail Header */}
                  <div className={`p-6 text-white flex items-center justify-between ${mode === 'entrada' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                    <div className="flex items-center gap-3">
                      <Box size={24} />
                      <h2 className="text-xl font-bold">Detalhes do Material</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={startEdit}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 size={20} />
                      </button>
                      <button 
                        onClick={() => handleDelete(selectedItem.id)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(editData).map(([key, value]: [string, any]) => {
                          if (key === 'id' || key === '_rowIndex') return null;
                          return (
                            <div key={key} className="space-y-1">
                              <label className="text-xs font-bold text-gray-400 uppercase">{key}</label>
                              <input 
                                type="text"
                                value={value || ''}
                                onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                              />
                            </div>
                          );
                        })}
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                          <button onClick={() => setIsEditing(false)} className="px-6 py-2 text-gray-500 font-bold">CANCELAR</button>
                          <button onClick={handleSaveEdit} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center gap-2">
                            <Save size={18} /> SALVAR
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          <InfoCard icon={User} label="Destinatário" value={selectedItem.destinatario_nome || selectedItem.entrega_nome || '-'} />
                          <InfoCard icon={Clock} label="Turno" value={selectedItem.destinatario_turno || selectedItem.entrega_turno || '-'} />
                          <InfoCard icon={Search} label="Desc. Cel" value={selectedItem.destinatario_descCel || selectedItem.entrega_descCel || '-'} />
                          <InfoCard icon={Briefcase} label="Função" value={selectedItem.destinatario_funcao || selectedItem.entrega_funcao || '-'} />
                          <InfoCard icon={FileText} label="Ordem" value={selectedItem.Ordem || '-'} />
                          <InfoCard icon={ScanLine} label="Ord_Rep" value={selectedItem.Ord_Rep || '-'} />
                          <InfoCard icon={Activity} label="Marca" value={selectedItem.Marca || '-'} />
                          <InfoCard icon={Layers} label="Produto" value={selectedItem.Produtos || '-'} />
                          <InfoCard icon={Box} label="Quantidade" value={selectedItem['Qtd.'] || '-'} />
                          <InfoCard icon={Briefcase} label="Setor" value={selectedItem['Setor'] || '-'} />
                        </div>

                        {/* Status Timeline */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Histórico / Status</h3>
                          <div className="flex flex-wrap gap-4">
                            <StatusBadge label="Registro" date={selectedItem.Data_Reg_Central} active={!!selectedItem.Data_Reg_Central} />
                            <ArrowRight className="text-gray-300 self-center" size={16} />
                            <StatusBadge label="Almox" date={selectedItem['Data_Ent_Almox.']} active={!!selectedItem['Data_Ent_Almox.']} />
                            <ArrowRight className="text-gray-300 self-center" size={16} />
                            <StatusBadge label="Separação" date={selectedItem.Data_Separacao || selectedItem.Data_Ent_Avi} active={!!(selectedItem.Data_Separacao || selectedItem.Data_Ent_Avi)} />
                            <ArrowRight className="text-gray-300 self-center" size={16} />
                            <StatusBadge label="Entrega" date={selectedItem.Data_Entrega} active={!!selectedItem.Data_Entrega} />
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex flex-col items-center gap-4 pt-6 border-t border-gray-100">
                          {message && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`w-full p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
                            >
                              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                              <span className="font-bold">{message.text}</span>
                            </motion.div>
                          )}

                          <button 
                            onClick={handleAction}
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl font-black text-xl tracking-widest shadow-xl transition-all flex items-center justify-center gap-4 transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 ${mode === 'entrada' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                          >
                            {loading ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            ) : (
                              mode === 'entrada' ? <Database size={32} /> : <Scissors size={32} />
                            )}
                            {loading ? 'PROCESSANDO...' : (mode === 'entrada' ? 'REGISTRAR ENTRADA' : `REGISTRAR SEPARAÇÃO ${separacaoType}`)}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 p-8 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Search size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-600">Nenhum material selecionado</h3>
                  <p className="max-w-xs mt-2">Escaneie um código de barras ou pesquise por uma ordem para começar.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
        <Icon size={12} /> {label}
      </div>
      <div className="text-sm font-bold text-gray-700 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ label, date, active }: { label: string, date?: string, active: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${active ? 'opacity-100' : 'opacity-30'}`}>
      <div className={`w-3 h-3 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`}></div>
      <span className="text-[10px] font-bold text-gray-600">{label}</span>
      {date && <span className="text-[8px] text-gray-400 font-mono">{date.split(' ')[0]}</span>}
    </div>
  );
}
