'use client';
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Clock, 
  Briefcase, 
  FileText, 
  Activity, 
  Box,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter
} from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import { motion, AnimatePresence } from 'motion/react';

type StatusFilter = 'TODOS' | 'PENDENTE' | 'M²' | 'AVIAMENTOS';

export default function Almox() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchItems = async (silent = false, force = false) => {
    if (force) {
      dataCache.invalidate('painelData');
    }
    if (!silent) setLoading(true);
    try {
      const data = await dataCache.get('painelData', () => api.post('getPainelData'), 20000) || [];
      // Ordena por data de registro central
      const sorted = [...data].sort((a, b) => {
        const da = new Date(a['Data_Reg_Central'] || 0).getTime();
        const db = new Date(b['Data_Reg_Central'] || 0).getTime();
        return db - da;
      });
      setMateriais(sorted);
    } catch (error) {
      console.error('Erro ao buscar dados do almox:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // Refresh silencioso a cada 30 segundos
    const interval = setInterval(() => fetchItems(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = materiais.filter(item => {
    const rawStatus = (item['Status'] || '').toUpperCase().trim();
    const statusNorm = rawStatus.replace(/Ç/g, 'C').replace(/[ÁÀÂÃ]/g, 'A');
    const matchesSearch = 
      String(item['Ordem'] || '').toUpperCase().includes(searchTerm.toUpperCase()) ||
      String(item['Ord_Rep'] || '').toUpperCase().includes(searchTerm.toUpperCase()) ||
      String(item['Produtos'] || '').toUpperCase().includes(searchTerm.toUpperCase());

    if (!matchesSearch) return false;

    const medida = String(item['Medida'] || '').toUpperCase().trim();
    const isM2 = medida === 'M²' || medida === 'M';

    if (filter === 'PENDENTE') return rawStatus === 'MP PENDENTE';
    
    if (filter === 'M²') {
      const isM2Status = statusNorm === 'SEPARACAO M²';
      const isM2MPOK = rawStatus === 'MPOK' && isM2;
      return isM2Status || isM2MPOK;
    }
    
    if (filter === 'AVIAMENTOS') {
      const isAviamentosStatus = statusNorm === 'SEPARACAO AVIAMENTOS';
      const isAviamentosMPOK = rawStatus === 'MPOK' && !isM2;
      return isAviamentosStatus || isAviamentosMPOK;
    }
    
    // Todos traz o que importa para o Almox (MPOK, MP PENDENTE e Separações)
    return rawStatus === 'MPOK' || rawStatus === 'MP PENDENTE' || statusNorm.includes('SEPARACAO');
  });

  const stats = {
    pendente: materiais.filter(m => (m['Status'] || '').toUpperCase().trim() === 'MP PENDENTE').length,
    m2: materiais.filter(m => {
      const rawStatus = (m['Status'] || '').toUpperCase().trim();
      const s = rawStatus.replace(/Ç/g, 'C').replace(/[ÁÀÂÃ]/g, 'A');
      const medida = String(m['Medida'] || '').toUpperCase().trim();
      const isM2 = medida === 'M²' || medida === 'M';
      return s === 'SEPARACAO M²' || (rawStatus === 'MPOK' && isM2);
    }).length,
    aviamentos: materiais.filter(m => {
      const rawStatus = (m['Status'] || '').toUpperCase().trim();
      const s = rawStatus.replace(/Ç/g, 'C').replace(/[ÁÀÂÃ]/g, 'A');
      const medida = String(m['Medida'] || '').toUpperCase().trim();
      const isM2 = medida === 'M²' || medida === 'M';
      return s === 'SEPARACAO AVIAMENTOS' || (rawStatus === 'MPOK' && !isM2);
    }).length,
  };

  return (
    <div className="p-4 md:p-8 h-full bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Dashboard Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-800 text-white rounded-xl shadow-lg">
              <Box size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Painel ALMOX</h1>
              <p className="text-sm text-gray-500 font-medium">Gestão de Separação de Materiais</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Pendente" count={stats.pendente} color="text-orange-600" bg="bg-orange-50" />
            <StatCard label="M²" count={stats.m2} color="text-purple-600" bg="bg-purple-50" />
            <StatCard label="Aviamentos" count={stats.aviamentos} color="text-blue-600" bg="bg-blue-50" />
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Pesquisar por Ordem, Ord_Rep ou Produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-slate-800 outline-none text-sm transition-all"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <FilterButton active={filter === 'TODOS'} onClick={() => setFilter('TODOS')}>Todos</FilterButton>
            <FilterButton active={filter === 'PENDENTE'} onClick={() => setFilter('PENDENTE')}>Pendentes</FilterButton>
            <FilterButton active={filter === 'M²'} onClick={() => setFilter('M²')}>M²</FilterButton>
            <FilterButton active={filter === 'AVIAMENTOS'} onClick={() => setFilter('AVIAMENTOS')}>Aviamentos</FilterButton>
          </div>

          <button 
            onClick={() => fetchItems(false, true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
            title="Atualizar"
          >
            <Loader2 className={loading ? 'animate-spin' : ''} size={20} />
          </button>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest font-black border-b border-gray-100">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Ordem / Ord_Rep</th>
                  <th className="px-6 py-4">Produto / Descrição</th>
                  <th className="px-6 py-4">Setor</th>
                  <th className="px-6 py-4 text-center">Qtd / TAM</th>
                  <th className="px-6 py-4">Data Reg.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <StatusBadge status={item.Status} item={item} />
                      </td>
                      <td className="px-6 py-4">
                        <PriorityBadge priority={item.ordem_prioridade} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-800">{item.Ordem}</div>
                        <div className="text-[10px] font-mono text-gray-400">{item.Ord_Rep}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-sm font-medium text-gray-700 truncate">{item.Produtos}</div>
                        <div className="text-[10px] text-gray-400 truncate">{item['Descrição']}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-gray-500 uppercase">{item.Setor || item.destinatario_setor || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-black text-gray-800">{item['Qtd.']}</div>
                        <div className="text-[10px] font-bold text-gray-400">{item['TAM.']}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400 font-mono">
                        {item['Data_Reg_Central']?.split(',')[0] || '-'}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {!loading && filteredItems.length === 0 && (
              <div className="p-20 flex flex-col items-center justify-center text-gray-400 gap-4">
                <Package size={48} className="opacity-20" />
                <p className="font-medium italic">Nenhum material pendente de separação encontrado.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, count, color, bg }: { label: string, count: number, color: string, bg: string }) {
  return (
    <div className={`${bg} p-4 rounded-xl border border-white/50 flex flex-col items-center justify-center min-w-[100px]`}>
      <span className="text-[10px] font-black uppercase tracking-tighter opacity-70 mb-1">{label}</span>
      <span className={`text-2xl font-black ${color}`}>{count}</span>
    </div>
  );
}

function FilterButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status, item }: { status: string; item?: any }) {
  const raw = (status || '').toUpperCase().trim();
  const sNorm = raw.replace(/Ç/g, 'C').replace(/[ÁÀÂÃ]/g, 'A');
  
  let colors = 'bg-gray-100 text-gray-600';
  let label = raw;
  
  if (raw === 'MPOK') {
    const medida = String(item?.['Medida'] || '').toUpperCase().trim();
    if (medida === 'M²' || medida === 'M') {
      colors = 'bg-purple-100 text-purple-700 border border-purple-250 bg-gradient-to-r from-purple-50 to-orange-50';
      label = 'SEPARAÇÃO M²';
    } else {
      colors = 'bg-blue-100 text-blue-700 border border-blue-250 bg-gradient-to-r from-blue-50 to-orange-50';
      label = 'SEPARAÇÃO AVIAMENTOS';
    }
  } else if (sNorm === 'SEPARACAO M²' || raw === 'SEPARAÇÃO M²') {
    colors = 'bg-purple-100 text-purple-700 border border-purple-200';
    label = 'SEPARAÇÃO M²';
  } else if (sNorm === 'SEPARACAO AVIAMENTOS' || raw === 'SEPARAÇÃO AVIAMENTOS') {
    colors = 'bg-blue-100 text-blue-700 border border-blue-200';
    label = 'SEPARAÇÃO AVIAMENTOS';
  } else if (raw === 'MP PENDENTE') {
    colors = 'bg-red-100 text-red-700 border border-red-200';
    label = 'MP PENDENTE';
  }

  return (
    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${colors}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = String(priority || '').trim().toLowerCase();
  
  let colors = 'bg-gray-100 text-gray-500 border-gray-200';
  let label = p ? p.toUpperCase() : 'NORMAL';
  
  if (p === 'alta') {
    colors = 'bg-red-100 text-red-700 border-red-200 font-extrabold';
  } else if (p === 'média' || p === 'media') {
    colors = 'bg-orange-100 text-orange-700 border-orange-200';
  } else if (p === 'baixa') {
    colors = 'bg-blue-100 text-blue-700 border-blue-200';
  } else if (p === 'embarque') {
    colors = 'bg-amber-100 text-black border-amber-300 font-black';
    label = 'EMBARQUE 🚚';
  } else {
    colors = 'bg-gray-50 text-gray-400 border-gray-200';
    label = 'NORMAL';
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold rounded-md border tracking-wider uppercase ${colors}`}>
      {label}
    </span>
  );
}

