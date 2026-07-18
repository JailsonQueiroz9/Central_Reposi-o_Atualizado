'use client';
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Table, 
  Database, 
  Info, 
  FileText,
  AlertTriangle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

interface UploadScreenProps {
  currentUser?: any;
}

type SheetTarget = 'Wip042' | 'Follow Material Prima';

export default function UploadScreen({ currentUser }: UploadScreenProps) {
  const [targetSheet, setTargetSheet] = useState<SheetTarget>('Wip042');
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const resetStates = () => {
    setFile(null);
    setWorkbook(null);
    setAvailableTabs([]);
    setSelectedTab('');
    setParsedData([]);
    setHeaders([]);
    setError(null);
    setSuccess(null);
  };

  const processFile = (uploadedFile: File) => {
    resetStates();
    setFile(uploadedFile);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setAvailableTabs(wb.SheetNames);
        
        // Auto-select first tab
        if (wb.SheetNames.length > 0) {
          const firstTab = wb.SheetNames[0];
          setSelectedTab(firstTab);
          parseWorksheet(wb, firstTab);
        }
      } catch (err: any) {
        console.error('Erro ao ler planilha:', err);
        setError('Falha ao processar o arquivo excel. Certifique-se de que é um formato válido (.xlsx, .xls, .csv).');
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Erro ao ler arquivo do sistema local.');
      setLoading(false);
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const parseWorksheet = (wb: XLSX.WorkBook, tabName: string) => {
    try {
      const sheet = wb.Sheets[tabName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      
      if (json.length === 0) {
        setError(`A aba "${tabName}" está vazia ou não possui cabeçalhos.`);
        setParsedData([]);
        setHeaders([]);
        return;
      }

      // Extract headers from first few rows to ensure coverage
      const allHeadersSet = new Set<string>();
      json.slice(0, 10).forEach(row => {
        Object.keys(row).forEach(k => {
          if (k !== '_rowIndex' && k.trim() !== '') {
            allHeadersSet.add(k);
          }
        });
      });

      setHeaders(Array.from(allHeadersSet));
      setParsedData(json);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao processar aba:', err);
      setError('Erro ao extrair linhas desta aba.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    if (workbook) {
      parseWorksheet(workbook, tab);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSync = async () => {
    if (parsedData.length === 0) return;
    
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.post('importSheetData', {
        sheetName: targetSheet,
        rows: parsedData
      });

      // Invalidate relevant cache keys
      if (targetSheet === 'Wip042') {
        dataCache.invalidate('wipData');
      }
      dataCache.invalidate('painelData');

      setSuccess(`Planilha sincronizada com sucesso! Foram carregadas ${parsedData.length} linhas na aba "${targetSheet}".`);
      
      // Auto reset after some time
      setTimeout(() => {
        resetStates();
      }, 5000);
    } catch (err: any) {
      console.error('Erro de sincronização:', err);
      setError(err.message || 'Falha ao sincronizar os dados com a planilha Google. Tente novamente.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full flex flex-col gap-6 overflow-y-auto" id="spreadsheets-upload-panel">
      {/* Target Selector Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-blue-600" size={18} />
            Destino da Importação
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Selecione a tabela do banco de dados (Aba do Google Sheets) que deseja sobrescrever/atualizar.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setTargetSheet('Wip042'); resetStates(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              targetSheet === 'Wip042'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Wip042 (PCP)
          </button>
          <button
            type="button"
            onClick={() => { setTargetSheet('Follow Material Prima'); resetStates(); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              targetSheet === 'Follow Material Prima'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Follow Matéria-Prima
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Drag Drop & Tab selector */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Upload de Arquivo</h3>
            
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadClick}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center text-center justify-center cursor-pointer transition-all min-h-[180px] ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-50/50' 
                  : file 
                    ? 'border-emerald-400 bg-emerald-50/10 hover:bg-emerald-50/20' 
                    : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
              }`}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-blue-500" size={36} />
                  <p className="text-xs font-semibold text-slate-600">Lendo planilha...</p>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
                    <FileText size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); resetStates(); }}
                    className="mt-2 text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                  >
                    Remover Arquivo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-1">
                    <FileUp size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Arrastar & Soltar arquivo</p>
                  <p className="text-[10px] text-slate-400">ou clique para selecionar do computador</p>
                  <span className="inline-block mt-3 px-2.5 py-1 bg-slate-100 rounded-md text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
                    XLSX, XLS, CSV
                  </span>
                </div>
              )}
            </div>

            {/* Warnings and Info */}
            <div className="bg-amber-50/80 rounded-xl p-3.5 border border-amber-100 text-[11px] text-amber-800 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Atenção ao importar:</span> Esta operação irá <span className="font-bold underline">substituir completamente</span> o conteúdo atual da aba <span className="font-semibold text-slate-900 bg-white/50 px-1 py-0.5 rounded border border-slate-200">{targetSheet}</span> no banco de dados do Google Sheets pelas linhas importadas.
              </div>
            </div>
          </div>

          {/* Tab Selection (only if workbook is parsed) */}
          {availableTabs.length > 1 && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Info size={14} className="text-blue-500" />
                Abas Detectadas no Excel
              </h3>
              <p className="text-[10px] text-slate-500">
                Seu arquivo possui mais de uma aba. Escolha qual deseja carregar:
              </p>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {availableTabs.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between border cursor-pointer ${
                      selectedTab === tab
                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 border-transparent text-slate-600'
                    }`}
                  >
                    <span className="truncate">{tab}</span>
                    {selectedTab === tab && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"></div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview & Execution */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
              <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-medium leading-normal">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-semibold leading-normal">{success}</div>
            </div>
          )}

          {/* Preview Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[350px]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Table size={16} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-800">Pré-visualização dos Dados</span>
              </div>
              
              {parsedData.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {parsedData.length} Linhas Encontradas
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto max-h-[350px]">
              {parsedData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3">
                  <Table size={44} className="text-slate-200 animate-pulse" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-500">Nenhum dado carregado</p>
                    <p className="text-[10px] text-slate-400 mt-1">Carregue uma planilha ao lado para visualizar os dados aqui</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[10px] tracking-wider">
                        <th className="p-3 border-r border-slate-200 text-center w-12 bg-slate-100 sticky top-0">#</th>
                        {headers.map(h => (
                          <th key={h} className="p-3 whitespace-nowrap sticky top-0 bg-slate-100 border-b border-slate-200 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData.slice(0, 5).map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 border-r border-slate-150 text-center font-semibold text-slate-400 bg-slate-50/30">
                            {index + 1}
                          </td>
                          {headers.map(h => (
                            <td key={h} className="p-3 max-w-[200px] truncate text-slate-700 font-medium whitespace-nowrap" title={String(row[h] ?? '')}>
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {parsedData.length > 5 && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1.5 flex-shrink-0">
                <span>Mostrando as primeiras 5 linhas de {parsedData.length} no total.</span>
                <span className="text-blue-500">Os dados restantes serão importados por completo.</span>
              </div>
            )}

            {/* Sync Action Area */}
            {parsedData.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0 gap-4">
                <div className="flex items-center gap-2 text-slate-500 text-[11px] leading-relaxed">
                  <Info size={14} className="text-blue-500 flex-shrink-0" />
                  <span>
                    Pronto para enviar para a planilha do Google <span className="font-bold text-slate-800">{targetSheet}</span>.
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all font-semibold text-xs shadow-md disabled:opacity-50 cursor-pointer flex-shrink-0"
                >
                  {syncing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Atualizar Banco de Dados
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
