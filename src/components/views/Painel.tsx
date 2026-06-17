'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle, Package, Box, TableProperties, Loader2, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Painel() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('TODOS');
  const [selectedStatus, setSelectedStatus] = useState('TODOS');
  const [selectedMarca, setSelectedMarca] = useState('TODOS');
  const [isTableSidebarOpen, setIsTableSidebarOpen] = useState(true);

  useEffect(() => {
    // Carregamento Instantâneo com SWR
    dataCache.swr(
      'painelData',
      () => api.post('getPainelData'),
      (data) => {
        setMateriais(data || []);
        setLoading(false);
      },
      20000 // TTL de 20 segundos
    );
  }, []);

  // List of unique Sectors from materials (excluding empty/null values)
  const setoresList = useMemo(() => {
    const setors = new Set<string>();
    materiais.forEach(m => {
      const s = String(m['destinatario_setor'] || m['Setor'] || '').trim().toUpperCase();
      if (s && s !== 'UNDEFINED' && s !== 'NULL' && s !== 'DESTINATARIO_SETOR') {
        setors.add(s);
      }
    });
    return Array.from(setors).sort();
  }, [materiais]);

  // List of unique Statuses from materials
  const statusesList = useMemo(() => {
    const stats = new Set<string>();
    materiais.forEach(m => {
      let s = String(m['Status'] || '').trim().toUpperCase();
      if (s === 'MPOK') {
        const medida = String(m['Medida'] || '').toUpperCase().trim();
        s = (medida === 'M²' || medida === 'M') ? 'SEPARAÇÃO M²' : 'SEPARAÇÃO AVIAMENTOS';
      }
      if (s && s !== 'STATUS') {
        stats.add(s);
      }
    });
    return Array.from(stats).sort();
  }, [materiais]);

  // List of unique Brands from materials
  const marcasList = useMemo(() => {
    const brands = new Set<string>();
    materiais.forEach(m => {
      const b = String(m['Marca'] || '').trim().toUpperCase();
      if (b && b !== 'MARCA') {
        brands.add(b);
      }
    });
    return Array.from(brands).sort();
  }, [materiais]);

  // Combined filters of materials
  const filteredMateriais = useMemo(() => {
    return materiais.filter(m => {
      // 1. Sector filter
      if (selectedSetor !== 'TODOS') {
        const sector = String(m['destinatario_setor'] || m['Setor'] || '').trim().toUpperCase();
        if (sector !== selectedSetor) return false;
      }

      // 2. Status filter
      if (selectedStatus !== 'TODOS') {
        let status = String(m['Status'] || '').trim().toUpperCase();
        if (status === 'MPOK') {
          const medida = String(m['Medida'] || '').toUpperCase().trim();
          status = (medida === 'M²' || medida === 'M') ? 'SEPARAÇÃO M²' : 'SEPARAÇÃO AVIAMENTOS';
        }
        if (status !== selectedStatus) return false;
      }

      // 3. Brand filter
      if (selectedMarca !== 'TODOS') {
        const brand = String(m['Marca'] || '').trim().toUpperCase();
        if (brand !== selectedMarca) return false;
      }

      // 4. Search term filter across any major column
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const match = 
          String(m['Ordem'] || '').toLowerCase().includes(term) ||
          String(m['Ord_Rep'] || '').toLowerCase().includes(term) ||
          String(m['N°_Req'] || '').toLowerCase().includes(term) ||
          String(m['Marca'] || '').toLowerCase().includes(term) ||
          String(m['Produtos'] || '').toLowerCase().includes(term) ||
          String(m['Descrição'] || '').toLowerCase().includes(term) ||
          String(m['Status'] || '').toLowerCase().includes(term) ||
          String(m['destinatario_setor'] || m['Setor'] || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [materiais, selectedSetor, selectedStatus, selectedMarca, searchTerm]);

  // Sum of quantities for filtered items
  const totalQuantity = useMemo(() => {
    return filteredMateriais.reduce((sum, m) => {
      const valStr = String(m['Qtd.'] || '0').replace(',', '.').trim();
      const val = parseFloat(valStr);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredMateriais]);

  // Função para parsear datas em formatos variados encontrados na planilha
  const parseCustomDate = (dateStr: any): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
      return isNaN(dateStr.getTime()) ? null : dateStr;
    }
    if (typeof dateStr !== 'string') return null;

    const cleanStr = dateStr.replace(/[()]/g, '').trim();
    if (!cleanStr) return null;

    // 1. Tentar padrão brasileiro DD/MM/YYYY, HH:mm:ss ou DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY - HH:mm:ss
    const matchBr = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,.-]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (matchBr) {
      const day = parseInt(matchBr[1], 10);
      const month = parseInt(matchBr[2], 10) - 1; // 0-indexed
      const year = parseInt(matchBr[3], 10);
      const hours = matchBr[4] ? parseInt(matchBr[4], 10) : 0;
      const minutes = matchBr[5] ? parseInt(matchBr[5], 10) : 0;
      const seconds = matchBr[6] ? parseInt(matchBr[6], 10) : 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 2. Tentar padrão ISO (YYYY-MM-DD) ou outro padrão com hífens
    const matchIso = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const month = parseInt(matchIso[2], 10) - 1; // 0-indexed
      const day = parseInt(matchIso[3], 10);
      const hours = matchIso[4] ? parseInt(matchIso[4], 10) : 0;
      const minutes = matchIso[5] ? parseInt(matchIso[5], 10) : 0;
      const seconds = matchIso[6] ? parseInt(matchIso[6], 10) : 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 3. Fallback genérico apenas se não corresponder às regras explícitas
    const fallback = new Date(cleanStr);
    if (!isNaN(fallback.getTime())) {
      return fallback;
    }

    return null;
  };

  // Cálculos dinâmicos baseados nos dados reais
  const ordensEmAndamento = materiais.length;
  const concluidasHoje = materiais.filter(m => {
    const status = String(m['Status'] || '').toUpperCase().trim();
    return status === 'CONCLUÍDO' || status === 'ENTREGUE' || status === 'FINALIZADO';
  }).length;
  const atrasadas = materiais.filter(m => {
    const status = String(m['Status'] || '').toUpperCase().trim();
    return status === 'EM PROCESSO DE COMPRA';
  }).length;

  // Cálculo do Tempo Médio - atravessamento entre cadastrar (Data_Reg_Central) e entregar ao Destinatário (Data_Entrega)
  const tempoMedio = useMemo(() => {
    let totalHours = 0;
    let count = 0;

    materiais.forEach(m => {
      const regDateStr = m['Data_Reg_Central'];
      const entDateStr = m['Data_Entrega'];

      if (regDateStr && entDateStr) {
        const regDate = parseCustomDate(regDateStr);
        const entDate = parseCustomDate(entDateStr);

        if (regDate && entDate) {
          const diffMs = entDate.getTime() - regDate.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours >= 0) {
            totalHours += diffHours;
            count++;
          }
        }
      }
    });

    if (count === 0) return 'N/A';

    const avgHoursTotal = totalHours / count;
    const days = Math.floor(avgHoursTotal / 24);
    const hours = Math.round(avgHoursTotal % 24);

    if (days > 0) {
      if (hours > 0) {
        return `${days}d ${hours}h`;
      }
      return `${days}d`;
    }
    return `${hours}h`;
  }, [materiais]);

  const stats = [
    { title: 'Ordens em Andamento', value: ordensEmAndamento.toString(), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Atrasadas', value: atrasadas.toString(), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
    { title: 'Concluídas', value: concluidasHoje.toString(), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { title: 'Tempo Médio', value: tempoMedio, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  const mpStatus = useMemo(() => {
    const statusConfig: Record<string, { label: string, color: string }> = {
      'MPOK': { label: 'MPOK', color: 'bg-green-500' },
      'VRMP': { label: 'VRMP', color: 'bg-amber-600' },
      'MPNG': { label: 'MPNG', color: 'bg-red-500' },
      'SEPARACAO M²': { label: 'SEPARAÇÃO M²', color: 'bg-purple-600' },
      'SEPARAÇÃO M²': { label: 'SEPARAÇÃO M²', color: 'bg-purple-600' },
      'SEPARACAO AVIAMENTOS': { label: 'SEPARAÇÃO AVIAMENTOS', color: 'bg-indigo-600' },
      'SEPARACAO AVIAMENTOS ': { label: 'SEPARAÇÃO AVIAMENTOS', color: 'bg-indigo-600' },
      'SEPARAÇÃO AVIAMENTOS': { label: 'SEPARAÇÃO AVIAMENTOS', color: 'bg-indigo-600' },
      'EM PROCESSO DE COMPRA': { label: 'EM PROCESSO DE COMPRA', color: 'bg-orange-500' },
      'MP TRÂNSITO': { label: 'MP TRÂNSITO', color: 'bg-blue-500' },
      'DISPONÍVEL NA CENTRAL': { label: 'DISPONÍVEL NA CENTRAL', color: 'bg-teal-500' },
      'DISPONIVEL NA CENTRAL': { label: 'DISPONÍVEL NA CENTRAL', color: 'bg-teal-500' },
      'ENTREGUE': { label: 'ENTREGUE', color: 'bg-emerald-600' },
      'CONCLUÍDO': { label: 'CONCLUÍDO', color: 'bg-green-600' },
    };

    const counts: Record<string, number> = {};
    
    materiais.forEach(curr => {
      let rawStatus = String(curr['Status'] || '').toUpperCase().trim();
      if (!rawStatus || rawStatus === 'STATUS') return;
      
      if (rawStatus === 'MPOK') {
        const medida = String(curr['Medida'] || '').toUpperCase().trim();
        rawStatus = (medida === 'M²' || medida === 'M') ? 'SEPARAÇÃO M²' : 'SEPARAÇÃO AVIAMENTOS';
      }
      
      const matchedKey = Object.keys(statusConfig).find(k => k.toUpperCase() === rawStatus);
      const label = matchedKey ? statusConfig[matchedKey].label : rawStatus;
      
      counts[label] = (counts[label] || 0) + 1;
    });

    const list = Object.entries(counts).map(([label, count]) => {
      const config = Object.values(statusConfig).find(c => c.label === label);
      const color = config ? config.color : 'bg-slate-400';
      return { status: label, count, color };
    });

    const sorted = list.sort((a, b) => b.count - a.count);

    if (sorted.length === 0) {
      return [{ status: 'Sem Dados', count: 0, color: 'bg-gray-400' }];
    }
    return sorted;
  }, [materiais]);

  const ultimasAtualizacoes = [...materiais]
    .reverse()
    .slice(0, 6)
    .map(m => {
      let status = m['Status'] || 'Atualizado';
      if (String(status).toUpperCase().trim() === 'MPOK') {
        const medida = String(m['Medida'] || '').toUpperCase().trim();
        status = (medida === 'M²' || medida === 'M') ? 'SEPARAÇÃO M²' : 'SEPARAÇÃO AVIAMENTOS';
      }
      return {
        ordem: m['Ordem'] || m['Ord_Rep'] || 'Desconhecida',
        status: status,
        data: m['Data_Reg_Central'] || 'Recentemente'
      };
    });

  const setorCounts = materiais.reduce((acc, curr) => {
    const setor = String(curr['Setor'] || curr['destinatario_setor'] || 'N/A').toUpperCase().trim();
    if (setor && setor !== 'UNDEFINED' && setor !== 'NULL' && setor !== 'DESTINATARIO_SETOR') {
      acc[setor] = (acc[setor] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  const producaoSetor = (Object.entries(setorCounts) as [string, number][])
    .map(([name, value]) => ({
      name,
      value
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (producaoSetor.length === 0) {
    producaoSetor.push({ name: 'Sem Dados', value: 0 });
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.startsWith('(')) return dateStr;

    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      return `(${day}/${month}/${year}, ${hours}:${minutes}:${seconds})`;
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 h-full bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-red-800 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-full mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <BarChart3 className="text-red-800" size={32} />
          Painel de Status
        </h1>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${stat.bg}`}>
                  <Icon className={stat.color} size={28} />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium mb-1">{stat.title}</div>
                  <div className="text-3xl font-bold text-gray-800">{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3x1 Grid for Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Column 1: Últimas Atualizações */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Clock className="text-gray-400" size={24} />
              Últimas Atualizações
            </h2>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {ultimasAtualizacoes.length > 0 ? ultimasAtualizacoes.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Box className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800 mb-1">Ordem {item.ordem} - {item.status}</div>
                    <div className="text-xs text-gray-500 font-medium">{formatDateTime(item.data)}</div>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-gray-500">Nenhuma atualização recente.</div>
              )}
            </div>
          </div>

          {/* Column 2: Produção por Setor */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <TrendingUp className="text-gray-400" size={24} />
              Produção por Setor
            </h2>
            <div className="flex-1 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={producaoSetor}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {producaoSetor.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-center gap-6">
               {producaoSetor.slice(0, 3).map((item, i) => (
                 <div key={i} className="text-center">
                   <div className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[80px]">{item.name}</div>
                   <div className="text-lg font-black text-gray-800 leading-none">{item.value}</div>
                 </div>
               ))}
            </div>
          </div>

          {/* Column 3: Status da Matéria-Prima */}
          {/* Column 3: Status da Matéria-Prima */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Package className="text-gray-400" size={24} />
              Status da Matéria-Prima
            </h2>

            {/* Ajustado: gap-3 e justify-start para não esticar demais os itens */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">
              {mpStatus.length > 0 && !(mpStatus.length === 1 && mpStatus[0].status === 'Sem Dados') ? (
                mpStatus.map((item, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-50 flex items-center justify-between transition-hover hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      {/* O "Pingo" colorido */}
                      <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm`}></div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {item.status}
                      </span>
                    </div>
                    {/* O Número grande à direita */}
                    <div className="text-3xl font-black text-gray-800 leading-none">
                      {item.count}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 italic">Nenhum dado disponível.</div>
              )}
            </div>
          </div>

        </div>

        {/* Bottom Row: Tabela de Materiais */}
        <div id="desc-materiais-section" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TableProperties className="text-red-800" size={26} />
              <div>
                <h2 className="text-xl font-bold text-gray-800 font-sans">Descrição de Materiais</h2>
                <span className="text-xs text-gray-400 font-medium font-sans">Visualizando {filteredMateriais.length} de {materiais.length} registros</span>
              </div>
            </div>
            
            {/* Header Controls */}
            <div className="flex items-center gap-3">
              {(selectedSetor !== 'TODOS' || selectedStatus !== 'TODOS' || selectedMarca !== 'TODOS' || searchTerm !== '') && (
                <button
                  onClick={() => {
                    setSelectedSetor('TODOS');
                    setSelectedStatus('TODOS');
                    setSelectedMarca('TODOS');
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors border border-red-200"
                >
                  Limpar Filtros
                </button>
              )}
              
              <button
                onClick={() => setIsTableSidebarOpen(!isTableSidebarOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-red-800 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 transition-colors"
              >
                <Filter className="text-gray-500" size={18} />
                <span>{isTableSidebarOpen ? 'Ocultar Painel Lateral' : 'Mostrar Painel Lateral'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-1">
            {/* Table Container (Left Side) */}
            <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[550px] border border-gray-250 rounded-xl custom-scrollbar relative shadow-sm bg-gray-50/10">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="sticky top-0延 z-20 shadow-sm">
                    <tr className="bg-[#00FF00] border-b border-gray-300">
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Ordem</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Ord_Rep</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">N°_Req</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Marca</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Produtos</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Descrição</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Qtd.</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Medida</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">TAM.</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Status</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_Reg_Central</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_Ent_Almox.</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_Entrega</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_Ent_Avi</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_Ent_Central</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Data_ Avali_Follow</th>
                      <th className="p-3 text-sm font-bold text-black border-r border-white/20 sticky top-0 bg-[#00FF00] z-20">Observação</th>
                      <th className="p-3 text-sm font-bold text-black bg-[#00FF00] sticky top-0 z-20">Setor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMateriais.length > 0 ? filteredMateriais.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors bg-[#F5DEB3]/30">
                        <td className="p-3 text-sm font-medium text-gray-800 border-r border-gray-200/50 font-sans">{mat['Ordem']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{mat['Ord_Rep']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{mat['N°_Req']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">{mat['Marca']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">{mat['Produtos']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">{mat['Descrição']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-bold font-mono">{mat['Qtd.']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">{mat['Medida']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">{mat['TAM.']}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-sans">
                          {(() => {
                            const rawStatus = String(mat['Status']).toUpperCase().trim();
                            const medida = String(mat['Medida'] || '').toUpperCase().trim();
                            const isM2 = medida === 'M²' || medida === 'M';
                            
                            let label = mat['Status'];
                            let styleClass = 'bg-gray-100 text-gray-700 border border-gray-250';
                            
                            if (rawStatus === 'MPOK') {
                              if (isM2) {
                                label = 'SEPARAÇÃO M²';
                                styleClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                              } else {
                                label = 'SEPARAÇÃO AVIAMENTOS';
                                styleClass = 'bg-indigo-100 text-indigo-700 border border-indigo-200';
                              }
                            } else if (rawStatus === 'SOLICITADO COMPRA' || rawStatus === 'EM PROCESSO DE COMPRA') {
                              styleClass = 'bg-orange-100 text-orange-700 border border-orange-200';
                            } else if (rawStatus === 'MP TRÂNSITO') {
                              styleClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                            } else if (rawStatus === 'MPNG') {
                              styleClass = 'bg-red-100 text-red-700 border border-red-200';
                            } else if (rawStatus === 'VRMP') {
                              styleClass = 'bg-indigo-100 text-indigo-700 border border-indigo-200';
                            } else if (rawStatus === 'SEPARACAO M²' || rawStatus === 'SEPARAÇÃO M²') {
                              styleClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                            } else if (rawStatus === 'SEPARACAO AVIAMENTOS' || rawStatus === 'SEPARAÇÃO AVIAMENTOS') {
                              styleClass = 'bg-indigo-100 text-indigo-700 border border-indigo-200';
                            } else if (rawStatus === 'MP PENDENTE') {
                              styleClass = 'bg-red-100 text-red-700 border border-red-200';
                            } else if (rawStatus === 'DISPONIVEL NA CENTRAL' || rawStatus === 'DISPONÍVEL NA CENTRAL') {
                              styleClass = 'bg-teal-100 text-teal-700 border border-teal-200';
                            }
                            
                            return (
                              <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${styleClass}`}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_Reg_Central'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_Ent_Almox.'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_Entrega'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_Ent_Avi'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_Ent_Central'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 font-mono">{formatDateTime(mat['Data_ Avali_Follow'])}</td>
                        <td className="p-3 text-sm text-gray-600 border-r border-gray-200/50 max-w-[200px] truncate font-sans" title={mat['Observação']}>{mat['Observação']}</td>
                        <td className="p-3 text-sm text-gray-600 font-sans">{mat['destinatario_setor'] || mat['Setor']}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={18} className="p-8 text-center text-gray-400 italic bg-white/60 font-sans">
                          Nenhum material corresponde aos filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Collapsible Sidebar Filter Panel (Right Side) */}
            {isTableSidebarOpen && (
              <div id="table-sidebar-filter" className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/70 p-6 flex flex-col gap-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 font-sans">Painel de Filtros</h3>
                  <p className="text-xs text-gray-500 font-sans">Ajuste as informações da tabela em tempo real com facilidade.</p>
                </div>

                {/* Quick Search */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide font-sans">Busca Rápida</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Pesquise ordem, marca, produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full text-xs pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none bg-white text-gray-800 focus:border-red-800 font-sans"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold font-sans"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter by Setor */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide font-sans">Filtrar por Setor</label>
                  <select
                    value={selectedSetor}
                    onChange={(e) => setSelectedSetor(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 focus:outline-none bg-white text-gray-800 cursor-pointer font-sans"
                  >
                    <option value="TODOS">Todos os Setores ({setoresList.length})</option>
                    {setoresList.map((setor) => (
                      <option key={setor} value={setor}>{setor}</option>
                    ))}
                  </select>
                </div>

                {/* Filter by Status */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide font-sans font-sans">Filtrar por Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 focus:outline-none bg-white text-gray-800 cursor-pointer font-sans"
                  >
                    <option value="TODOS">Todos os Status ({statusesList.length})</option>
                    {statusesList.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {/* Filter by Marca */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide font-sans">Filtrar por Marca</label>
                  <select
                    value={selectedMarca}
                    onChange={(e) => setSelectedMarca(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 focus:outline-none bg-white text-gray-800 cursor-pointer font-sans"
                  >
                    <option value="TODOS">Todas as Marcas ({marcasList.length})</option>
                    {marcasList.map((marca) => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </div>

                {/* Summary Box */}
                <div className="mt-auto bg-white p-4 border border-gray-100 rounded-xl space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-700 border-b border-gray-100 pb-2 font-sans">Resumo da Seleção</h4>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-500 font-sans">Registros exibidos:</span>
                    <span className="font-bold text-gray-800">{filteredMateriais.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-500 font-sans">Quantidade Total:</span>
                    <span className="font-bold text-emerald-700">
                      {totalQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
}
