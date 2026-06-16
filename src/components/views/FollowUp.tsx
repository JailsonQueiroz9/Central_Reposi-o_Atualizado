'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Loader2, 
  Check, 
  X, 
  Copy, 
  FileDown, 
  ChevronRight, 
  Inbox, 
  ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import { jsPDF } from 'jspdf';

interface FollowUpOrder {
  id: string;
  _rowIndex?: number;
  Ordem: string;
  Ord_Rep: string;
  "N°_Req": string;
  Marca: string;
  Status: string;
  Produtos: string;
  "Descrição": string;
  "TAM.": string;
  "Qtd.": string;
  "Observação": string;
  Setor?: string;
  "Data_Reg_Central"?: string;
  "Data_ Avali_Follow"?: string;
}

interface GroupedBrandResult {
  brand: string;
  emailBody: string;
  itemsCount: number;
  items: FollowUpOrder[];
}

export default function FollowUp() {
  const [orders, setOrders] = useState<FollowUpOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Seleções de checkbox
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [processingBulk, setProcessingBulk] = useState(false);

  // Modal com Resultados do Processamento
  const [bulkResults, setBulkResults] = useState<GroupedBrandResult[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Usa cache de 20s compartilhado com o Painel
      const data = await dataCache.get('painelData', () => api.post('getPainelData'), 20000);
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao buscar dados do painel:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = Object.values(order).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesStatus = statusFilter === 'ALL' || order['Status'] === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Lista apenas os itens do filtro que possuem status literal "SOLICITADO COMPRA" e, portanto, podem ser selecionados
  const selectableItemsOnScreen = useMemo(() => {
    return filteredOrders.filter(order => order['Status'] === 'SOLICITADO COMPRA');
  }, [filteredOrders]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedIds).filter(
      id => selectedIds[id] && orders.some(o => o.id === id && o['Status'] === 'SOLICITADO COMPRA')
    ).length;
  }, [selectedIds, orders]);

  const isAllSelected = useMemo(() => {
    const selectable = selectableItemsOnScreen;
    if (selectable.length === 0) return false;
    return selectable.every(order => selectedIds[order.id]);
  }, [selectableItemsOnScreen, selectedIds]);

  const handleSelectAllToggle = () => {
    const selectable = selectableItemsOnScreen;
    if (selectable.length === 0) return;

    if (isAllSelected) {
      // Desmarca todos os itens selecionáveis atuais
      setSelectedIds(prev => {
        const updated = { ...prev };
        selectable.forEach(item => {
          updated[item.id] = false;
        });
        return updated;
      });
    } else {
      // Marca todos os itens selecionáveis atuais
      setSelectedIds(prev => {
        const updated = { ...prev };
        selectable.forEach(item => {
          updated[item.id] = true;
        });
        return updated;
      });
    }
  };

  const handleRowSelectToggle = (id: string, isSelectable: boolean) => {
    if (!isSelectable) return;
    setSelectedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getCurrentFormattedDate = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `(${day}/${month}/${year}, ${hours}:${minutes}:${seconds})`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.startsWith('(')) return dateStr;
    
    try {
      const parts = dateStr.split(/[-T:Z/ ]/);
      let d = new Date(dateStr);
      
      if (isNaN(d.getTime())) {
        return dateStr;
      }
      
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    const now = getCurrentFormattedDate();
    setOrders(prev => prev.map(o => o.id === id ? { ...o, Status: newStatus, 'Data_ Avali_Follow': now } : o));
    await saveUpdate(id, { Status: newStatus, 'Data_ Avali_Follow': now });
  };

  const handleObservacaoChange = (id: string, newObs: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, 'Observação': newObs } : o));
  };

  const handleObservacaoBlur = async (id: string, newObs: string) => {
    const now = getCurrentFormattedDate();
    setOrders(prev => prev.map(o => o.id === id ? { ...o, 'Observação': newObs, 'Data_ Avali_Follow': now } : o));
    await saveUpdate(id, { 'Observação': newObs, 'Data_ Avali_Follow': now });
  };

  const saveUpdate = async (id: string, updates: any) => {
    setSavingId(id);
    try {
      const orderToUpdate = orders.find(o => o.id === id);
      if (orderToUpdate) {
        const updatedOrder = { ...orderToUpdate, ...updates };
        await api.post('updatePainelData', updatedOrder);
        
        // Invalida o cache para forçar atualização na próxima navegação
        dataCache.invalidate('painelData');
        console.log('[DEBUG] Cache painelData invalidado após atualização individual');
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert('Erro ao salvar as alterações.');
    } finally {
      setSavingId(null);
    }
  };

  /**
   * PDF Generator - Estilização Premium para o Grupo Dass
   */
  const generateBrandPdf = (brand: string, items: FollowUpOrder[]): Blob => {
    const doc = new jsPDF();
    
    // Header do PDF - Visual corporativo Slate e detalhes Orange
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');
    
    // Friso de Destaque
    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 40, 210, 2, 'F');
    
    // Títulos textuais do Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text("DASS - SOLICITAÇÃO DE COMPRA", 15, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text("Segue abaixo, solicitação de compra para reposição.", 15, 31);
    
    // Detalhes da Marca e Data
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`MARCA: ${brand.toUpperCase()}`, 140, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 140, 31);

    let currentY = 54;
    
    // Cabeçalho da Tabela
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(10, currentY, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    
    doc.text("Ordem", 12, currentY + 5.5);
    doc.text("Produto", 34, currentY + 5.5);
    doc.text("Descrição do Material", 58, currentY + 5.5);
    doc.text("Tam.", 128, currentY + 5.5);
    doc.text("Qtd.", 142, currentY + 5.5);
    doc.text("Observação", 158, currentY + 5.5);
    
    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    // Iterar sobre os materiais
    items.forEach((item) => {
      // Tratamento de quebra de página
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
        
        doc.setFillColor(241, 245, 249);
        doc.rect(10, currentY, 190, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        
        doc.text("Ordem", 12, currentY + 5.5);
        doc.text("Produto", 34, currentY + 5.5);
        doc.text("Descrição do Material", 58, currentY + 5.5);
        doc.text("Tam.", 128, currentY + 5.5);
        doc.text("Qtd.", 142, currentY + 5.5);
        doc.text("Observação", 158, currentY + 5.5);
        
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
      }

      // Linha de divisão fina
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(10, currentY, 200, currentY);

      const ordem = String(item['Ordem'] || '').substring(0, 10);
      const produto = String(item['Produtos'] || '');
      const desc = String(item['Descrição'] || '');
      const tam = String(item['TAM.'] || '');
      const qtd = String(item['Qtd.'] || '');
      const obs = String(item['Observação'] || '');

      const wrappedDesc = doc.splitTextToSize(desc, 66);
      const wrappedObs = doc.splitTextToSize(obs, 38);
      const linesNeeded = Math.max(wrappedDesc.length, wrappedObs.length, 1);
      
      const rowHeight = linesNeeded * 4 + 4;

      doc.text(ordem, 12, currentY + 4.5);
      doc.text(produto, 34, currentY + 4.5);
      
      // Desenha descrição com wrap
      for (let i = 0; i < wrappedDesc.length; i++) {
        doc.text(wrappedDesc[i], 58, currentY + 4.5 + (i * 4));
      }
      
      doc.text(tam, 128, currentY + 4.5);
      doc.text(qtd, 142, currentY + 4.5);

      // Desenha observação com wrap
      for (let i = 0; i < wrappedObs.length; i++) {
        doc.text(wrappedObs[i], 158, currentY + 4.5 + (i * 4));
      }

      currentY += rowHeight;
    });

    // Rodapé
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("GRUPO DASS - DEPARTAMENTO DE COMPRAS", 15, 287);
    doc.text("Página 1 de 1", 175, 287);

    return doc.output('blob');
  };

  /**
   * Processamento Lote Principal
   */
  const handleGeneratePurchase = async () => {
    if (selectedCount === 0 || processingBulk) return;
    
    setProcessingBulk(true);
    const selectedItems = filteredOrders.filter(o => o['Status'] === 'SOLICITADO COMPRA' && selectedIds[o.id]);
    const now = getCurrentFormattedDate();

    try {
      // 1. Agrupar por "Marca"
      const grouped: Record<string, FollowUpOrder[]> = {};
      selectedItems.forEach(item => {
        const brand = (item.Marca || "Geral").trim().toUpperCase();
        if (!grouped[brand]) {
          grouped[brand] = [];
        }
        grouped[brand].push(item);
      });

      const updatedItemsForSheets = selectedItems.map(item => ({
        ...item,
        Status: 'EM PROCESSO DE COMPRA',
        'Data_ Avali_Follow': now
      }));

      // Acomoda resultados locais para gerar o modal resumo
      const brandResults: GroupedBrandResult[] = [];

      for (const [brand, itemsInBrand] of Object.entries(grouped)) {
        // A) Geração de Texto de E-mail solicitado pela regra de negócio 3.A
        const emailBody = `Segue abaixo, solicitação de compra para reposição referente a marca "${brand}"`;

        // B) Estruturação de PDF solicitado pela regra de negócio 3.B
        const pdfBlob = generateBrandPdf(brand, itemsInBrand);
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Dispara download automático e fluido de forma assíncrona para o usuário
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `compras_${brand.toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        brandResults.push({
          brand,
          emailBody,
          itemsCount: itemsInBrand.length,
          items: itemsInBrand
        });
      }

      // 4. Sincronização via Apps Script Web App - 100% resiliente com as permissões da planilha ativa
      await api.post('updateMultiplePainelData', updatedItemsForSheets);
      console.log("[DEBUG] Atualização múltipla persistida via Apps Script com sucesso!");

      // 5. Atualiza o estado da UI localmente e invalida cache
      setOrders(prev => prev.map(o => {
        const isProcessed = o['Status'] === 'SOLICITADO COMPRA' && selectedIds[o.id];
        return isProcessed ? { ...o, Status: 'EM PROCESSO DE COMPRA', 'Data_ Avali_Follow': now } : o;
      }));

      // Invalida cache de dados
      dataCache.invalidate('painelData');

      // Limpa registros selecionados
      setSelectedIds({});

      // Define estado final para visualização no Modal
      setBulkResults(brandResults);
      setShowResultsModal(true);

    } catch (error: any) {
      console.error("Erro no processamento em lote:", error);
      alert("Houve um problema ao processar a geração de compras: " + error.message);
    } finally {
      setProcessingBulk(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="p-6 h-full bg-gray-50 flex flex-col relative" id="follow-up-viewport">
      <div className="max-w-full mx-auto w-full flex-1 flex flex-col">
        
        {/* Cabeçalho de Pesquisa e Filtros */}
        <div className="flex justify-between items-center mb-6" id="follow-up-header">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-red-800" />
            Follow-up de Solicitações
          </h1>
          <div className="flex gap-3">
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-red-800/20 transition-all">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none ml-2 text-sm w-48" 
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm ${showFilters ? 'ring-2 ring-red-800/20 bg-gray-50' : ''}`}
                id="btn-filter-toggle"
              >
                <Filter size={18} />
                Filtros
              </button>
              
              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-40">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Filtrar por Status</h3>
                  <div className="space-y-2">
                    {['ALL', 'MPOK', 'SOLICITADO COMPRA', 'MP TRÂNSITO', 'MPNG', 'EM PROCESSO DE COMPRA'].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                        <input 
                          type="radio" 
                          name="statusFilter" 
                          checked={statusFilter === status}
                          onChange={() => setStatusFilter(status)}
                          className="text-red-800 focus:ring-red-800"
                        />
                        <span className="text-sm text-gray-600">
                          {status === 'ALL' ? 'Todos' : status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabela de Relatórios e Acompanhamentos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col" id="follow-up-table-container">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-sm">
                  {/* Nova coluna Checkbox à extrema esquerda */}
                  <th className="p-4 w-12 text-center sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                    <input 
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAllToggle}
                      disabled={selectableItemsOnScreen.length === 0}
                      className="rounded border-gray-300 text-red-800 focus:ring-red-800 w-4 h-4 cursor-pointer disabled:opacity-40"
                      title="Selecionar todos com status SOLICITADO COMPRA"
                    />
                  </th>
                  <th className="p-4 font-semibold whitespace-nowrap">Ordem</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Ord_Rep</th>
                  <th className="p-4 font-semibold whitespace-nowrap">N°_Req</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Marca</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Ações (Status)</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Produto</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Descrição do Material</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Tamanho</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Quantidade</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Observação</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Setor</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Data Reg.</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Data Avali. Follow</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isSolicitadoCompra = order['Status'] === 'SOLICITADO COMPRA';
                  const isChecked = !!selectedIds[order.id];

                  return (
                    <tr 
                      key={order.id} 
                      className={`border-b border-gray-100 transition-colors ${
                        isChecked ? 'bg-orange-50/40 hover:bg-orange-50/60' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Célula dinâmica de Checkbox */}
                      <td className="p-4 text-center sticky left-0 bg-white border-r border-gray-100 z-10">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRowSelectToggle(order.id, isSolicitadoCompra)}
                          disabled={!isSolicitadoCompra}
                          className="rounded border-gray-300 text-red-800 focus:ring-red-800 w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-4 font-mono text-sm text-gray-800 whitespace-nowrap">{order['Ordem']}</td>
                      <td className="p-4 font-mono text-sm text-gray-800 whitespace-nowrap">{order['Ord_Rep']}</td>
                      <td className="p-4 font-mono text-sm text-gray-800 whitespace-nowrap">{order['N°_Req']}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap font-semibold">{order['Marca']}</td>
                      <td className="p-4 whitespace-nowrap">
                        <select 
                          value={order['Status'] || ''} 
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-bold border outline-none cursor-pointer transition-colors ${
                            order['Status'] === 'MPOK' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200/40' :
                            order['Status'] === 'SOLICITADO COMPRA' ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-200/40' :
                            order['Status'] === 'EM PROCESSO DE COMPRA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-200/40' :
                            order['Status'] === 'MP TRÂNSITO' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200/40' :
                            'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200/40'
                          }`}
                          disabled={savingId === order.id}
                        >
                          <option value="">Selecione...</option>
                          <option value="MPOK">MPOK</option>
                          <option value="SOLICITADO COMPRA">SOLICITADO COMPRA</option>
                          <option value="EM PROCESSO DE COMPRA">EM PROCESSO DE COMPRA</option>
                          <option value="MP TRÂNSITO">MP TRÂNSITO</option>
                          <option value="MPNG">MPNG</option>
                        </select>
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{order['Produtos']}</td>
                      <td className="p-4 text-sm text-gray-600 max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap" title={order['Descrição']}>
                        {order['Descrição']}
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{order['TAM.']}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{order['Qtd.']}</td>
                      <td className="p-4 text-sm text-gray-600 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={order['Observação'] || ''} 
                            onChange={(e) => handleObservacaoChange(order.id, e.target.value)}
                            onBlur={(e) => handleObservacaoBlur(order.id, e.target.value)}
                            placeholder="Adicionar observação..."
                            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-red-500 transition-colors"
                            disabled={savingId === order.id}
                          />
                          {savingId === order.id && <Loader2 size={14} className="animate-spin text-gray-400" />}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{order['Setor'] || '-'}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(order['Data_Reg_Central'])}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(order['Data_ Avali_Follow'])}</td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-gray-500">
                      Nenhuma solicitação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 1. Barra Flutuante de Ação em Lote (Bulk Action Bar) com Framer Motion */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 80, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 80, x: '-50%', opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="fixed bottom-6 left-1/2 bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-between gap-6 z-50 w-[90%] max-w-lg min-w-[320px]"
            id="bulk-action-bar"
          >
            <div className="flex flex-col">
              <span className="text-sm font-bold text-orange-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              <span className="text-xs text-slate-400">Pronto para agrupar e gerar ordens de compra</span>
            </div>
            
            <button
              onClick={handleGeneratePurchase}
              disabled={processingBulk}
              className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wide px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md"
              id="btn-bulk-execute"
            >
              {processingBulk ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Processando...
                </>
              ) : (
                'Gerar Compra dos Selecionados'
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Modal do Resumo de Geração de Compras por Marca */}
      <AnimatePresence>
        {showResultsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200"
            >
              {/* Header do Modal */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="bg-green-500/10 p-2 rounded-lg text-green-400">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Ordens de Compra Criadas!</h2>
                    <p className="text-xs text-slate-400">Estes materiais foram agrupados e processados com sucesso.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowResultsModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista dos Grupos de Compra */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {bulkResults.map((res, index) => (
                  <div key={res.brand} className="bg-slate-50 border border-gray-200 rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-orange-500" />
                        Marca: {res.brand}
                      </span>
                      <span className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-orange-100">
                        {res.itemsCount} {res.itemsCount === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                        <span>Texto do E-mail Correspondente:</span>
                        <button
                          onClick={() => copyToClipboard(res.emailBody, index)}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-500 transition-colors"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-500" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copiar E-mail
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-sm bg-white p-3 border border-gray-200 rounded-lg text-gray-800 font-sans whitespace-pre-wrap select-all">
                        {res.emailBody}
                      </pre>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg flex items-center gap-1.5 flex-1">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>PDF Gerado e status atualizado para <strong>EM PROCESSO DE COMPRA</strong> na Planilha.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer do Modal */}
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
