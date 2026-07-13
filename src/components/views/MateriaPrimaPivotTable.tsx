'use client';

import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  Settings, 
  FileSpreadsheet, 
  Search, 
  HelpCircle, 
  Plus, 
  Minus, 
  RefreshCw,
  Sliders,
  Check,
  Eye,
  EyeOff,
  TrendingUp,
  Download,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';

interface MateriaPrimaPivotTableProps {
  data: any[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Lista de campos que podem ser selecionados para agrupar as Linhas (Rows)
const AVAILABLE_ROW_FIELDS = [
  { key: 'Documento', label: 'Documento' },
  { key: 'Produto', label: 'Produto' },
  { key: 'Descrição produto', label: 'Descrição do Produto' },
  { key: 'Modelo', label: 'Modelo' },
  { key: 'Semana', label: 'Semana' },
  { key: 'Legenda', label: 'Legenda (Status/Estoque)' },
  { key: 'Nome fornecedor', label: 'Fornecedor' },
  { key: 'OP', label: 'Ordem de Produção (OP)' },
  { key: 'Und.', label: 'Unidade' }
];

// Lista de campos que podem ser agregados como Valores (Values)
const AVAILABLE_VALUE_FIELDS = [
  { key: 'Reserva', label: 'Reserva' },
  { key: 'Qtd. estoque', label: 'Qtd. Estoque' },
  { key: 'Saldo', label: 'Saldo' },
  { key: 'Qtd. OC', label: 'Qtd. OC' },
  { key: 'Qtd. EDI', label: 'Qtd. EDI' }
];

interface PivotNode {
  keyName: string;      // ex: "Produto"
  keyValue: string;     // ex: "101484"
  path: string;         // ex: "Documento1/101484"
  level: number;        // nível de indentação (0, 1, 2...)
  children: PivotNode[];
  items: any[];         // linhas da planilha que caem neste grupo
  aggregates: Record<string, number>; // somas/médias calculadas
}

export default function MateriaPrimaPivotTable({ data, onRefresh, isLoading }: MateriaPrimaPivotTableProps) {
  // Configurações da Tabela Dinâmica
  const [selectedRowFields, setSelectedRowFields] = useState<string[]>(['Documento', 'Produto', 'Descrição produto']);
  const [selectedValues, setSelectedValues] = useState<string[]>(['Reserva', 'Qtd. estoque', 'Saldo']);
  const [aggregationType, setAggregationType] = useState<'SUM' | 'COUNT' | 'AVERAGE'>('SUM');
  
  // Estado dos Filtros e Visualização
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showTotalsOnRows, setShowTotalsOnRows] = useState(true);

  // Tratamento de segurança para dados numéricos
  const parseNumeric = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    // Remove pontos de milhar e substitui vírgula por ponto para decimais se for padrão PT-BR
    const cleanStr = String(val)
      .trim()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Função para pegar um valor da linha independente de pequenas variações de chaves/acentos
  const getRowValue = (row: any, key: string): string => {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]);
    
    // Fallbacks inteligentes
    if (key === 'Descrição produto') {
      return String(row['Descrição produto'] || row['Descrição'] || row['Descrição do Material'] || row['descricao'] || '-');
    }
    if (key === 'Nome fornecedor') {
      return String(row['Nome fornecedor'] || row['Fornecedor'] || row['fornecedor'] || '-');
    }
    if (key === 'Qtd. estoque') {
      return String(row['Qtd. estoque'] || row['Estoque Atual'] || row['Quantidade'] || row['quantidade'] || '0');
    }
    if (key === 'Und.') {
      return String(row['Und.'] || row['Unidade'] || row['unidade'] || 'M²');
    }
    return String(row[key] || '-');
  };

  // Filtragem inicial dos dados originais baseado na busca global antes de pivotar
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery]);

  // Construção recursiva da árvore de agregação pivotada
  const pivotTree = useMemo(() => {
    if (selectedRowFields.length === 0 || filteredData.length === 0) return [];

    const buildTree = (
      rows: any[], 
      fieldIndex: number, 
      parentPath: string
    ): PivotNode[] => {
      const currentField = selectedRowFields[fieldIndex];
      if (!currentField) return [];

      // Agrupa as linhas pelo valor do campo atual
      const grouped: Record<string, any[]> = {};
      rows.forEach(row => {
        const val = getRowValue(row, currentField);
        if (!grouped[val]) grouped[val] = [];
        grouped[val].push(row);
      });

      return Object.keys(grouped).map(keyValue => {
        const nodePath = parentPath ? `${parentPath} || ${keyValue}` : keyValue;
        const groupItems = grouped[keyValue];
        const isLeaf = fieldIndex === selectedRowFields.length - 1;

        // Calcula as agregações para este nó específico
        const aggregates: Record<string, number> = {};
        selectedValues.forEach(valKey => {
          const vals = groupItems.map(item => parseNumeric(item[valKey] || getRowValue(item, valKey)));
          
          if (aggregationType === 'SUM') {
            aggregates[valKey] = vals.reduce((sum, v) => sum + v, 0);
          } else if (aggregationType === 'COUNT') {
            aggregates[valKey] = vals.length;
          } else if (aggregationType === 'AVERAGE') {
            const sum = vals.reduce((sum, v) => sum + v, 0);
            aggregates[valKey] = vals.length > 0 ? sum / vals.length : 0;
          }
        });

        const node: PivotNode = {
          keyName: currentField,
          keyValue,
          path: nodePath,
          level: fieldIndex,
          children: [],
          items: groupItems,
          aggregates
        };

        if (!isLeaf) {
          node.children = buildTree(groupItems, fieldIndex + 1, nodePath);
        }

        return node;
      });
    };

    return buildTree(filteredData, 0, '');
  }, [filteredData, selectedRowFields, selectedValues, aggregationType]);

  // Planificação da árvore considerando o estado de expansão para exibição na tabela
  const flatTableRows = useMemo(() => {
    const list: { node: PivotNode; isTotal?: boolean }[] = [];

    const traverse = (nodes: PivotNode[]) => {
      nodes.forEach(node => {
        list.push({ node });
        
        const isExpanded = expandedNodes[node.path];
        if (isExpanded && node.children.length > 0) {
          traverse(node.children);
          
          // Opcionalmente adiciona um nó de subtotal acumulado da linha se expandido
          if (showTotalsOnRows && node.level < selectedRowFields.length - 1) {
            list.push({ 
              node: {
                ...node,
                keyValue: `Total ${node.keyValue}`,
                children: [] // Sem filhos para o subtotal
              }, 
              isTotal: true 
            });
          }
        }
      });
    };

    traverse(pivotTree);
    return list;
  }, [pivotTree, expandedNodes, showTotalsOnRows, selectedRowFields]);

  // Totais Gerais acumulados
  const grandTotals = useMemo(() => {
    const aggregates: Record<string, number> = {};
    selectedValues.forEach(valKey => {
      const vals = filteredData.map(item => parseNumeric(item[valKey] || getRowValue(item, valKey)));
      
      if (aggregationType === 'SUM') {
        aggregates[valKey] = vals.reduce((sum, v) => sum + v, 0);
      } else if (aggregationType === 'COUNT') {
        aggregates[valKey] = vals.length;
      } else if (aggregationType === 'AVERAGE') {
        const sum = vals.reduce((sum, v) => sum + v, 0);
        aggregates[valKey] = vals.length > 0 ? sum / vals.length : 0;
      }
    });
    return aggregates;
  }, [filteredData, selectedValues, aggregationType]);

  // Expande ou recolhe tudo
  const toggleAllNodes = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    if (expand) {
      const traverse = (nodes: PivotNode[]) => {
        nodes.forEach(node => {
          newExpanded[node.path] = true;
          if (node.children.length > 0) traverse(node.children);
        });
      };
      traverse(pivotTree);
    }
    setExpandedNodes(newExpanded);
  };

  // Alterna expansão de um nó individual
  const toggleNode = (path: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Funções para adicionar/remover/reordenar campos de agrupação
  const handleToggleRowField = (fieldKey: string) => {
    if (selectedRowFields.includes(fieldKey)) {
      setSelectedRowFields(prev => prev.filter(f => f !== fieldKey));
    } else {
      setSelectedRowFields(prev => [...prev, fieldKey]);
    }
  };

  const moveRowField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...selectedRowFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newFields.length) {
      const temp = newFields[index];
      newFields[index] = newFields[targetIndex];
      newFields[targetIndex] = temp;
      setSelectedRowFields(newFields);
    }
  };

  // Exportar dados atuais em formato CSV
  const exportToCSV = () => {
    if (flatTableRows.length === 0) return;
    
    // Headers de agrupamento de linhas selecionadas + valores
    const headers = [...selectedRowFields.map(f => AVAILABLE_ROW_FIELDS.find(af => af.key === f)?.label || f), ...selectedValues];
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(";") + "\n";

    flatTableRows.forEach(({ node, isTotal }) => {
      // Cria a linha preenchida com as chaves correspondentes
      const rowData = selectedRowFields.map((field, idx) => {
        if (node.keyName === field) {
          return isTotal ? `[SUBTOTAL] ${node.keyValue}` : node.keyValue;
        }
        // Se for descendente e estamos exibindo o detalhe, podemos deixar em branco ou repetir
        return "";
      });

      // Valores numéricos correspondentes
      const valData = selectedValues.map(v => node.aggregates[v]?.toFixed(2) || "0.00");
      csvContent += [...rowData, ...valData].join(";") + "\n";
    });

    // Adiciona Total Geral
    const grandRow = [...selectedRowFields.map((_, i) => i === 0 ? "TOTAL GERAL" : ""), ...selectedValues.map(v => grandTotals[v]?.toFixed(2) || "0.00")];
    csvContent += grandRow.join(";") + "\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tabela_Dinamica_Materia_Prima_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full flex-1 min-h-0 bg-gray-50 text-gray-800" id="pivot-table-container">
      {/* PAINEL LATERAL DE CONFIGURAÇÃO - ESTILO GOOGLE SHEETS */}
      {showConfigPanel && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-80 bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-6 select-none shrink-0"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
              <Sliders size={16} className="text-orange-500" />
              Editor de Pivot
            </h2>
            <button 
              onClick={() => setShowConfigPanel(false)}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Recolher Painel"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Seção de Linhas (Rows) */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
              Agrupamento (Linhas)
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">{selectedRowFields.length}</span>
            </h3>
            
            <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 rounded-lg border border-gray-100 max-h-40 overflow-y-auto">
              {AVAILABLE_ROW_FIELDS.map(field => {
                const isSelected = selectedRowFields.includes(field.key);
                return (
                  <button
                    key={field.key}
                    onClick={() => handleToggleRowField(field.key)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {isSelected ? <Check size={12} className="text-orange-600" /> : <Plus size={12} />}
                    {field.label}
                  </button>
                );
              })}
            </div>

            {/* Lista ordenada de agrupamento com botões de reordenação */}
            {selectedRowFields.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1 border-t border-dashed border-gray-100 pt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Ordem de Hierarquia:</p>
                {selectedRowFields.map((fieldKey, idx) => {
                  const info = AVAILABLE_ROW_FIELDS.find(af => af.key === fieldKey);
                  return (
                    <div 
                      key={fieldKey} 
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    >
                      <span className="truncate pr-2 font-bold text-slate-800">
                        {idx + 1}. {info?.label || fieldKey}
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          disabled={idx === 0}
                          onClick={() => moveRowField(idx, 'up')}
                          className="p-1 hover:bg-white rounded text-gray-500 disabled:text-gray-300 disabled:hover:bg-transparent"
                          title="Subir na hierarquia"
                        >
                          ▲
                        </button>
                        <button 
                          disabled={idx === selectedRowFields.length - 1}
                          onClick={() => moveRowField(idx, 'down')}
                          className="p-1 hover:bg-white rounded text-gray-500 disabled:text-gray-300 disabled:hover:bg-transparent"
                          title="Descer na hierarquia"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção de Valores (Columns to aggregate) */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
              Métricas / Valores
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">{selectedValues.length}</span>
            </h3>
            
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {AVAILABLE_VALUE_FIELDS.map(field => {
                const isSelected = selectedValues.includes(field.key);
                return (
                  <button
                    key={field.key}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedValues(prev => prev.filter(f => f !== field.key));
                      } else {
                        setSelectedValues(prev => [...prev, field.key]);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center justify-between border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{field.label}</span>
                    {isSelected ? <Check size={14} className="text-blue-600" /> : <Plus size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipo de Agregação */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo de Agregação</h3>
            <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden text-xs">
              {(['SUM', 'COUNT', 'AVERAGE'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setAggregationType(type)}
                  className={`py-2 text-center transition-colors font-bold cursor-pointer ${
                    aggregationType === type 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type === 'SUM' ? 'Soma' : type === 'COUNT' ? 'Contar' : 'Média'}
                </button>
              ))}
            </div>
          </div>

          {/* Configurações Adicionais */}
          <div className="flex flex-col gap-3 border-t border-dashed border-gray-100 pt-4 text-xs font-bold">
            <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900">
              <input 
                type="checkbox" 
                checked={showTotalsOnRows} 
                onChange={(e) => setShowTotalsOnRows(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span>Mostrar subtotais de linhas</span>
            </label>
          </div>
        </motion.div>
      )}

      {/* ÁREA DA TABELA PIVOTADA */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Barra superior de ações e busca */}
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50">
          <div className="flex items-center gap-2.5">
            {!showConfigPanel && (
              <button
                onClick={() => setShowConfigPanel(true)}
                className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 p-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm text-xs font-bold cursor-pointer"
                title="Mostrar Painel de Configuração"
              >
                <Settings size={15} className="text-orange-500" />
                Painel
              </button>
            )}
            
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <button 
                onClick={() => toggleAllNodes(true)}
                className="p-2 border-r border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs flex items-center gap-1"
                title="Expandir todos os níveis"
              >
                <Maximize2 size={13} />
                Expandir Tudo
              </button>
              <button 
                onClick={() => toggleAllNodes(false)}
                className="p-2 hover:bg-gray-50 text-gray-600 font-bold text-xs flex items-center gap-1"
                title="Recolher todos os níveis"
              >
                <Minimize2 size={13} />
                Recolher Tudo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex-1 md:flex-initial bg-white border border-gray-300 rounded-lg flex items-center px-2.5 py-1.5 max-w-xs shadow-sm">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Filtrar dados..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none ml-1.5 text-xs font-medium text-gray-800 placeholder-gray-400 w-full"
              />
            </div>

            <button
              onClick={exportToCSV}
              disabled={flatTableRows.length === 0}
              className="bg-white hover:bg-gray-100 text-slate-800 border border-gray-300 p-2 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Exportar Tabela Dinâmica para CSV"
            >
              <Download size={15} />
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="bg-white hover:bg-gray-100 text-slate-800 border border-gray-300 p-2 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                title="Atualizar dados da planilha"
              >
                <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
              </button>
            )}
          </div>
        </div>

        {/* Info da amostra */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex justify-between text-[11px] text-blue-700 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <Database size={12} />
            <span>Dados Originais: {data.length} registros</span>
          </div>
          <div>
            <span>Filtro Ativo: {filteredData.length} registros</span>
          </div>
        </div>

        {/* Grid / Tabela Pivot */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {flatTableRows.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <FileSpreadsheet size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-bold">Nenhum agrupamento configurado ou nenhum dado disponível.</p>
              <p className="text-xs text-gray-400 mt-1">Marque campos de agrupamento em "Linhas" no editor para montar a tabela.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs min-w-[700px] select-text">
              <thead>
                <tr className="bg-slate-100 border-b border-gray-300 text-slate-700 font-extrabold uppercase">
                  {/* Cabeçalhos de Grupos de Linhas */}
                  <th className="p-3 border-r border-gray-200">Hierarquia de Agrupamento</th>
                  
                  {/* Cabeçalhos de Valores agregados */}
                  {selectedValues.map(v => {
                    const info = AVAILABLE_VALUE_FIELDS.find(af => af.key === v);
                    return (
                      <th key={v} className="p-3 text-right font-bold w-36 border-r border-gray-200">
                        {aggregationType === 'SUM' ? 'Soma de ' : aggregationType === 'COUNT' ? 'Contar de ' : 'Média de '}
                        {info?.label || v}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {flatTableRows.map(({ node, isTotal }, index) => {
                  const isExpanded = expandedNodes[node.path];
                  const hasChildren = node.children.length > 0;
                  
                  // Estilização com base no nível na hierarquia e se é subtotal
                  const indentStyle = { paddingLeft: `${node.level * 20 + 12}px` };
                  const rowBg = isTotal 
                    ? 'bg-slate-50 font-bold border-b border-gray-200 text-slate-900' 
                    : node.level === 0 
                      ? 'bg-gray-50/50 hover:bg-gray-100/60 font-semibold text-slate-800' 
                      : 'hover:bg-gray-50/60 text-slate-700 border-b border-gray-100';

                  return (
                    <tr 
                      key={`${node.path}-${index}`} 
                      className={`border-b border-gray-200 transition-colors ${rowBg}`}
                    >
                      {/* Célula de Agrupamento de Linha */}
                      <td className="p-2.5 border-r border-gray-200 font-sans truncate max-w-md" style={indentStyle}>
                        <div className="flex items-center gap-1.5">
                          {hasChildren && !isTotal ? (
                            <button
                              onClick={() => toggleNode(node.path)}
                              className="p-1 rounded hover:bg-gray-200/80 transition-colors focus:outline-none"
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-slate-600 stroke-[3]" />
                              ) : (
                                <ChevronRight size={14} className="text-slate-600 stroke-[3]" />
                              )}
                            </button>
                          ) : (
                            <span className="w-6 inline-block" /> // Alinhamento vazio para folhas
                          )}
                          
                          <span 
                            className={`truncate ${isTotal ? 'italic text-slate-500 font-bold' : node.level === 0 ? 'font-extrabold text-slate-950' : 'font-medium'}`}
                            title={`${node.keyName}: ${node.keyValue}`}
                          >
                            {node.keyValue || <span className="text-gray-400 italic">[Vazio]</span>}
                          </span>
                        </div>
                      </td>

                      {/* Células de Valores agregados */}
                      {selectedValues.map(v => {
                        const val = node.aggregates[v] ?? 0;
                        return (
                          <td 
                            key={v} 
                            className={`p-2.5 text-right font-mono border-r border-gray-200 ${
                              isTotal || node.level === 0 ? 'font-bold text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {aggregationType === 'COUNT' ? val : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Linha de Total Geral */}
                <tr className="bg-slate-800 text-white font-extrabold text-xs">
                  <td className="p-3 border-r border-slate-700 uppercase">
                    Total Geral
                  </td>
                  {selectedValues.map(v => {
                    const val = grandTotals[v] ?? 0;
                    return (
                      <td key={v} className="p-3 text-right font-mono border-r border-slate-700">
                        {aggregationType === 'COUNT' ? val : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
