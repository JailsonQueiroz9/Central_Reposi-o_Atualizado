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
  onUpdateObservacao?: (id: string, text: string) => void;
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
  { key: 'Und.', label: 'Unidade' },
  { key: 'Observação', label: 'Observação' }
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

// Componente auxiliar para edição de Observação sem lag de digitação
function SpreadsheetInput({ value: initialValue, onChange }: { value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(initialValue);
  
  React.useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== initialValue) {
          onChange(val);
        }
      }}
      placeholder="Escrever observação..."
      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded px-2 py-1 outline-none text-xs text-gray-800 transition-all font-sans"
    />
  );
}

export default function MateriaPrimaPivotTable({ data, onRefresh, isLoading, onUpdateObservacao }: MateriaPrimaPivotTableProps) {
  // Configurações da Tabela Dinâmica
  const [selectedRowFields, setSelectedRowFields] = useState<string[]>(['Documento', 'Produto', 'Descrição produto']);
  const [selectedValues, setSelectedValues] = useState<string[]>(['Reserva', 'Qtd. estoque', 'Saldo']);
  const [aggregationType, setAggregationType] = useState<'SUM' | 'COUNT' | 'AVERAGE'>('SUM');
  
  // Estado dos Filtros e Visualização
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showTotalsOnRows, setShowTotalsOnRows] = useState(true);
  const [viewMode, setViewMode] = useState<'pivot' | 'spreadsheet'>('pivot');

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
    if (key === 'Legenda') {
      const originalLegenda = String(row['Legenda'] || row['legenda'] || 'ESTOQUE').toUpperCase();
      const estoqueStr = row['Qtd. estoque'] || row['Estoque Atual'] || row['Quantidade'] || row['quantidade'] || '0';
      const estoqueVal = parseNumeric(estoqueStr);
      if (estoqueVal <= 0 && originalLegenda === 'ESTOQUE') {
        return 'SEM ESTOQUE';
      }
      return originalLegenda;
    }

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
    if (key === 'Observação') {
      return String(row['Observação'] || row['observacao'] || row['Observacao'] || '');
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

  // Agrupamento plano (Tabular) de acordo com os campos de linha selecionados
  const tabularRows = useMemo(() => {
    if (selectedRowFields.length === 0 || filteredData.length === 0) return [];

    const groups: Record<string, any[]> = {};
    filteredData.forEach(row => {
      const keyParts = selectedRowFields.map(field => getRowValue(row, field));
      const groupKey = keyParts.join(' || ');
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(row);
    });

    return Object.entries(groups).map(([groupKey, groupItems]) => {
      const keyParts = groupKey.split(' || ');
      const keys: Record<string, string> = {};
      selectedRowFields.forEach((field, idx) => {
        keys[field] = keyParts[idx] || "-";
      });

      // Calcula as agregações para este grupo plano
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

      // Pega o ID do primeiro item do grupo para atualização da observação
      const firstItem = groupItems[0];
      const itemId = firstItem?.id || firstItem?.Id || "";
      const observacao = firstItem ? getRowValue(firstItem, 'Observação') : "";

      return {
        id: itemId,
        keys,
        aggregates,
        observacao,
        items: groupItems
      };
    });
  }, [filteredData, selectedRowFields, selectedValues, aggregationType]);

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
    if (tabularRows.length === 0) return;
    
    // Headers de agrupamento de linhas selecionadas + observação + valores
    const headers = [
      ...selectedRowFields.map(f => AVAILABLE_ROW_FIELDS.find(af => af.key === f)?.label || f), 
      "Observação",
      ...selectedValues
    ];
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(";") + "\n";

    tabularRows.forEach((row) => {
      // Cria a linha preenchida com as chaves correspondentes
      const rowData = selectedRowFields.map((field) => row.keys[field] || "");
      const obsData = row.observacao || "";
      // Valores numéricos correspondentes
      const valData = selectedValues.map(v => row.aggregates[v]?.toFixed(2) || "0.00");
      csvContent += [...rowData, obsData, ...valData].join(";") + "\n";
    });

    // Adiciona Total Geral
    const grandRow = [
      ...selectedRowFields.map((_, i) => i === 0 ? "TOTAL GERAL" : ""), 
      "",
      ...selectedValues.map(v => grandTotals[v]?.toFixed(2) || "0.00")
    ];
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
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex bg-gray-200/75 p-0.5 rounded-lg border border-gray-300 shadow-inner mr-1.5">
              <button
                onClick={() => setViewMode('pivot')}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'pivot'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tabela Dinâmica
              </button>
              <button
                onClick={() => setViewMode('spreadsheet')}
                className={`px-3 py-1.5 rounded-md text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'spreadsheet'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Planilha Completa
              </button>
            </div>

            {!showConfigPanel && viewMode === 'pivot' && (
              <button
                onClick={() => setShowConfigPanel(true)}
                className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 p-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm text-xs font-bold cursor-pointer"
                title="Mostrar Painel de Configuração"
              >
                <Settings size={15} className="text-orange-500" />
                Painel
              </button>
            )}
            
            {viewMode === 'pivot' && (
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
            )}
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
              disabled={tabularRows.length === 0}
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

        {/* Grid / Tabela */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {viewMode === 'spreadsheet' ? (
            <div className="p-3 bg-slate-50 min-h-full">
              <div className="border border-gray-200 rounded-lg overflow-auto bg-white shadow-sm max-h-[600px]">
                <table className="w-full border-collapse text-[11px] text-left min-w-[2000px] select-text">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-gray-300 uppercase sticky top-0 z-20">
                      <th className="p-2.5 border border-gray-200 text-center sticky left-0 bg-slate-100 z-30 w-12 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">N°</th>
                      <th className="p-2.5 border border-gray-200">ID</th>
                      <th className="p-2.5 border border-gray-200">Produto</th>
                      <th className="p-2.5 border border-gray-200">Descrição produto</th>
                      <th className="p-2.5 border border-gray-200">Tamanho</th>
                      <th className="p-2.5 border border-gray-200">Semana</th>
                      <th className="p-2.5 border border-gray-200">Modelo</th>
                      <th className="p-2.5 border border-gray-200 text-center">Legenda</th>
                      <th className="p-2.5 border border-gray-200">Documento</th>
                      <th className="p-2.5 border border-gray-200">OP</th>
                      <th className="p-2.5 border border-gray-200 text-right">Reserva</th>
                      <th className="p-2.5 border border-gray-200 text-right">Qtd. estoque</th>
                      <th className="p-2.5 border border-gray-200 text-right">Saldo</th>
                      <th className="p-2.5 border border-gray-200 text-right">Qtde. OC</th>
                      <th className="p-2.5 border border-gray-200 text-right">Qtde. EDI</th>
                      <th className="p-2.5 border border-gray-200">Nota EDI</th>
                      <th className="p-2.5 border border-gray-200">Nome fornecedor</th>
                      <th className="p-2.5 border border-gray-200 min-w-[260px] bg-amber-50/50">Observação (pode escrever)</th>
                      <th className="p-2.5 border border-gray-200">Dt.ent.Dass</th>
                      <th className="p-2.5 border border-gray-200">Dt. ETD</th>
                      <th className="p-2.5 border border-gray-200">Dt. emissão NF</th>
                      <th className="p-2.5 border border-gray-200">Localização</th>
                      <th className="p-2.5 border border-gray-200">Dt. leitura NF</th>
                      <th className="p-2.5 border border-gray-200">OC</th>
                      <th className="p-2.5 border border-gray-200">Und.</th>
                      <th className="p-2.5 border border-gray-200">Motorista</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((row, idx) => {
                      const legenda = getRowValue(row, 'Legenda');
                      const isSemEstoque = legenda === 'SEM ESTOQUE';
                      const isFaturado = legenda === 'FATURADO';
                      const isEstoque = legenda === 'ESTOQUE';

                      let badgeClass = "bg-gray-100 text-gray-700 border-gray-300";
                      if (isSemEstoque) {
                        badgeClass = "bg-red-50 text-red-700 border-red-200 font-bold";
                      } else if (isFaturado) {
                        badgeClass = "bg-green-50 text-green-700 border-green-200 font-bold";
                      } else if (isEstoque) {
                        badgeClass = "bg-blue-50 text-blue-700 border-blue-200 font-bold";
                      }

                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 border border-gray-200 text-center font-bold text-gray-500 bg-slate-50 sticky left-0 z-10 w-12 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono truncate max-w-[80px]" title={row['Id'] || row.id}>
                            {row['Id'] || row.id || `m-${idx}`}
                          </td>
                          <td className="p-2 border border-gray-200 font-bold text-gray-900 font-mono">
                            {row['Produto']}
                          </td>
                          <td className="p-2 border border-gray-200 font-medium text-gray-700 truncate max-w-sm" title={row['Descrição produto'] || row['Descrição'] || row['Descrição do Material']}>
                            {row['Descrição produto'] || row['Descrição'] || row['Descrição do Material']}
                          </td>
                          <td className="p-2 border border-gray-200 font-mono text-gray-600">{row['Tamanho'] || '0'}</td>
                          <td className="p-2 border border-gray-200 font-mono text-gray-600">{row['Semana']}</td>
                          <td className="p-2 border border-gray-200 text-gray-700 font-medium">{row['Modelo']}</td>
                          <td className="p-2 border border-gray-200 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase border tracking-wider ${badgeClass}`}>
                              {legenda}
                            </span>
                          </td>
                          <td className="p-2 border border-gray-200 font-mono text-gray-600">{row['Documento']}</td>
                          <td className="p-2 border border-gray-200 font-mono text-gray-600">{row['OP']}</td>
                          <td className="p-2 border border-gray-200 text-right font-mono font-medium text-gray-600">
                            {parseNumeric(row['Reserva']).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`p-2 border border-gray-200 text-right font-mono font-bold ${isSemEstoque ? 'text-red-600' : 'text-gray-900'}`}>
                            {parseNumeric(row['Qtd. estoque']).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-gray-200 text-right font-mono font-semibold text-slate-800">
                            {parseNumeric(row['Saldo']).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-gray-200 text-right font-mono text-gray-500">
                            {parseNumeric(row['Qtd. OC'] || row['Qtde. OC']).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-gray-200 text-right font-mono text-gray-500">
                            {parseNumeric(row['Qtd. EDI'] || row['Qtde. EDI']).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono">{row['Nota EDI'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-600 truncate max-w-xs" title={row['Nome fornecedor'] || row['Fornecedor']}>
                            {row['Nome fornecedor'] || row['Fornecedor']}
                          </td>
                          <td className="p-1 border border-gray-200 bg-amber-50/25 min-w-[260px]">
                            <SpreadsheetInput 
                              value={row['Observação'] || ''} 
                              onChange={(text) => onUpdateObservacao?.(row.id, text)} 
                            />
                          </td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono">{row['Dt.ent.Dass'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono">{row['Dt. ETD'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono">{row['Dt. emissão NF'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-500 font-medium">{row['Localização'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-400 font-mono">{row['Dt. leitura NF'] || '-'}</td>
                          <td className="p-2 border border-gray-200 text-gray-500 font-mono">{row['OC'] || '-'}</td>
                          <td className="p-2 border border-gray-200 font-mono text-gray-600 font-semibold">{row['Und.'] || row['Unidade'] || 'M²'}</td>
                          <td className="p-2 border border-gray-200 text-gray-500 font-medium">{row['Motorista'] || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tabularRows.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <FileSpreadsheet size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-bold">Nenhum agrupamento configurado ou nenhum dado disponível.</p>
              <p className="text-xs text-gray-400 mt-1">Marque campos de agrupamento em "Linhas" no editor para montar a tabela.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs min-w-[700px] select-text">
              <thead>
                <tr className="bg-slate-100 border-b border-gray-300 text-slate-700 font-extrabold uppercase">
                  {/* Coluna de index sutil */}
                  <th className="p-3 border-r border-gray-200 w-12 text-center text-slate-500">N°</th>

                  {/* Cabeçalhos de Grupos de Linhas */}
                  {selectedRowFields.map(fieldKey => {
                    const info = AVAILABLE_ROW_FIELDS.find(af => af.key === fieldKey);
                    return (
                      <th key={fieldKey} className="p-3 border-r border-gray-200">
                        {info?.label || fieldKey}
                      </th>
                    );
                  })}

                  {/* Coluna de Observação */}
                  <th className="p-3 border-r border-gray-200 w-64 bg-amber-50/20">
                    Observação (pode escrever)
                  </th>
                  
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
                {tabularRows.map((row, index) => {
                  return (
                    <tr 
                      key={row.id || index} 
                      className="border-b border-gray-200 hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Index da Linha */}
                      <td className="p-2 border-r border-gray-200 text-center font-bold text-gray-400 bg-slate-50/50 w-12">
                        {index + 1}
                      </td>

                      {/* Células de Grupos de Linhas (Documento, Produto, Descrição, etc.) */}
                      {selectedRowFields.map((fieldKey, colIdx) => {
                        const cellValue = row.keys[fieldKey] || "-";
                        
                        const isDocumento = fieldKey === 'Documento';
                        const isProduto = fieldKey === 'Produto';
                        const isDescricao = fieldKey === 'Descrição produto';
                        
                        let cellClass = "p-2.5 border-r border-gray-200 font-sans truncate max-w-xs";
                        if (isDocumento) {
                          cellClass += " bg-slate-100/60 font-bold text-slate-700";
                        } else if (isProduto) {
                          cellClass += " font-mono font-bold text-slate-950";
                        } else if (isDescricao) {
                          cellClass += " text-slate-800 font-medium max-w-sm";
                        } else {
                          cellClass += " text-slate-600 font-medium";
                        }

                        return (
                          <td key={fieldKey} className={cellClass} title={cellValue}>
                            {cellValue}
                          </td>
                        );
                      })}

                      {/* Coluna de Observação editável */}
                      <td className="p-1 border-r border-gray-200 bg-amber-50/10 min-w-[240px]">
                        {row.id ? (
                          <SpreadsheetInput 
                            value={row.observacao || ''} 
                            onChange={(text) => onUpdateObservacao?.(row.id, text)} 
                          />
                        ) : null}
                      </td>

                      {/* Células de Valores agregados */}
                      {selectedValues.map(v => {
                        const val = row.aggregates[v] ?? 0;
                        return (
                          <td 
                            key={v} 
                            className="p-2.5 text-right font-mono border-r border-gray-200 text-slate-800 font-semibold"
                          >
                            {aggregationType === 'COUNT' ? val : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Linha de Total Geral */}
                <tr className="bg-slate-800 text-white font-extrabold text-xs sticky bottom-0 z-10">
                  <td className="p-3 border-r border-slate-700 text-center font-bold">
                    -
                  </td>

                  {selectedRowFields.map((fieldKey, colIdx) => (
                    <td key={fieldKey} className="p-3 border-r border-slate-700 uppercase">
                      {colIdx === 0 ? "Total Geral" : ""}
                    </td>
                  ))}
                  
                  <td className="p-3 border-r border-slate-700"></td>

                  {selectedValues.map(v => {
                    const val = grandTotals[v] ?? 0;
                    return (
                      <td key={v} className="p-3 text-right font-mono border-r border-slate-700 text-amber-300 font-bold">
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
