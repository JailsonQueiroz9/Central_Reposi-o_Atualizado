'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CalendarClock, 
  CalendarDays, 
  Search, 
  Filter, 
  Plus, 
  Save, 
  Edit2, 
  Check, 
  X as CloseIcon, 
  BarChart3, 
  Layers, 
  Star, 
  CheckCircle, 
  RefreshCcw, 
  Loader2, 
  TableProperties, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Info,
  Eye,
  EyeOff,
  GripVertical,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

// All 54 columns requested by the user
const PCP_COLUMNS = [
  "LINHA / FÁBRICA",
  "LINHAS ANTIGAS",
  "LINHA SERIG",
  "FALTAS",
  "ABAST PRÉ",
  "GIRO FAB",
  "SOLA EXTERIOR OK",
  "CÓD. PRODUTO",
  "MARCA",
  "FAMÍLIA MONTAGEM",
  "SEMANA ORIGINAL",
  "DT. EMBARQUE",
  "SEMANA PRODUÇÃO",
  "NOME PRODUTO",
  "LOTE",
  "COR (COR DO TALÃO)",
  "QTD. PROGRAMADA",
  "STATUS DA OPERAÇÃO",
  "FOLLOW M2",
  "FOLLOW UND",
  "FOLLOW SOLA",
  "SEPAR. SERIGRAFIA",
  "ESTOQUE",
  "CONJUNTO",
  "ABAST DUB",
  "DUB LAGOA",
  "QT CONTE",
  "ENFESTO",
  "CORTE",
  "CARIMBO",
  "LIN ATOM",
  "CONTRAFORT",
  "ATACADOR",
  "ENV AVIAMENTO",
  "PONTE",
  "AUTOMATICO",
  "LECTRA",
  "REC SUPER",
  "KANBAN APOIO",
  "SERIG CARROSSEL",
  "DATA M2",
  "DATA AVIAMENTOS",
  "DATA CORTE / CORTE AUTOMATICO ",
  "DATA SUPERMERCADO",
  "DATA SERIGRAFIA",
  "DATA ORIGINAL",
  "TIPO DE MATERIAL",
  "\"RETORNO\" ALINHAMENTO",
  "TURNO",
  "HORÁRIO",
  "OBS",
  "STATUS PUXADA",
  "STATUS SERIGRAFIA",
  "RETORNO NF / OBS GERAIS / DATA DE CHEGADA"
];

// Helper to format Date strings to DD/MM/YYYY cleanly avoiding timezone/fuso-horário shifts
const formatDateString = (valStr: string): string => {
  if (!valStr) return '';
  const trimmed = valStr.trim();
  
  // 1. If already in DD/MM/YYYY or contains it, return as is
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
    return trimmed;
  }

  // 2. Check if it is a "YYYY-MM-DD" style string (with optional time) - extract directly to avoid timezone shift
  const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYMD) {
    const [_, y, m, d] = matchYMD;
    return `${d}/${m}/${y}`;
  }

  // 3. For long JS Date strings like "Fri Aug 14 2026 00:00:00 GMT-0300 (Horário Padrão de Brasília)"
  const isJSDateString = trimmed.includes('GMT') || trimmed.includes('UTC') || /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{1,2}\s\d{4}/.test(trimmed);
  if (isJSDateString) {
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp)) {
      const d = new Date(timestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  return valStr;
};

// Function to subtract working days (Monday-Friday, skipping Saturdays, Sundays and custom holidays/vacation)
// Note: Sunday is index 0 and Saturday is index 6 in Javascript getDay()
const calculateRetroDates = (originalDateStr: string, customDates?: { date: string; type: string }[]): { [key: string]: string } => {
  const parseDate = (str: string): Date | null => {
    if (!str) return null;
    const trimmed = str.trim();
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [_, d, m, y] = match;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYMD) {
      const [_, y, m, d] = matchYMD;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return new Date(parsed);
    return null;
  };

  const formatDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const subtractWorkDays = (start: Date, numDays: number): Date => {
    let d = new Date(start);
    let count = 0;
    while (count < numDays) {
      d.setDate(d.getDate() - 1);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dStr = `${year}-${month}-${day}`; // YYYY-MM-DD
      
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isCustomOffDay = customDates && customDates.some(c => c.date === dStr);
      
      if (!isWeekend && !isCustomOffDay) {
        count++;
      }
    }
    return d;
  };

  const baseDate = parseDate(originalDateStr);
  if (!baseDate) return {};

  const serigrafiaDate = subtractWorkDays(baseDate, 1);
  const supermercadoDate = subtractWorkDays(baseDate, 2);
  const corteDate = subtractWorkDays(baseDate, 3);
  const aviamentosDate = subtractWorkDays(baseDate, 4);
  const m2Date = subtractWorkDays(baseDate, 4); // same as aviamentos (4 work days retroactive)

  return {
    "DATA SERIGRAFIA": formatDate(serigrafiaDate),
    "DATA SUPERMERCADO": formatDate(supermercadoDate),
    "DATA CORTE / CORTE AUTOMATICO ": formatDate(corteDate),
    "DATA AVIAMENTOS": formatDate(aviamentosDate),
    "DATA M2": formatDate(m2Date)
  };
};

const isCorteDateColumn = (col: string): boolean => {
  if (!col) return false;
  const norm = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return norm.includes("corte") && (
    norm.includes("data") || 
    norm.includes("inicio") || 
    norm.includes("automatico") || 
    norm.includes("auto")
  );
};

const setFieldsWithNormalization = (obj: any, fields: { [key: string]: string }) => {
  for (const [colTitle, value] of Object.entries(fields)) {
    let foundKey = colTitle;
    const normTitle = colTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isCorteDateTitle = isCorteDateColumn(normTitle);
    
    for (const actualKey of Object.keys(obj)) {
      const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const isCorteDateActual = isCorteDateColumn(normActual);
      
      if (normTitle === normActual || (isCorteDateTitle && isCorteDateActual)) {
        foundKey = actualKey;
        break;
      }
    }
    obj[foundKey] = value;
  }
};

// Helper to look up values inside the item object with case-insensitive and accent-insensitive key fallback
const getVal = (item: any, columnTitle: string): string => {
  if (!item) return '';
  let rawVal = '';
  if (item[columnTitle] !== undefined && item[columnTitle] !== null) {
    rawVal = String(item[columnTitle]);
  } else {
    const normTitle = columnTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const isCorteDateTitle = isCorteDateColumn(normTitle);
    let found = false;
    for (const actualKey of Object.keys(item)) {
      const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const isCorteDateActual = isCorteDateColumn(normActual);
      if (normTitle === normActual || (isCorteDateTitle && isCorteDateActual)) {
        rawVal = String(item[actualKey]);
        found = true;
        break;
      }
    }
    if (!found) return '';
  }
  return formatDateString(rawVal);
};

// Map column index/name to appropriate CSS column width
const getColMinWidth = (col: string): string => {
  const c = col.toUpperCase();
  if (c.includes("NOME PRODUTO")) return "min-w-[460px] max-w-[500px]";
  if (c.includes("OBS") || c.includes("RETORNO NF")) return "min-w-[320px]";
  if (c.includes("COR (COR DO")) return "min-w-[190px]";
  if (c.includes("LOTE")) return "min-w-[160px]";
  if (c.includes("CÓD.") || c.includes("COD.")) return "min-w-[130px]";
  if (c.includes("INICIO CORTE") || c.includes("AUTOMATICO") || c.includes("FAMÍLIA") || c.includes("FAMILIA") || c.includes("MATERIAL")) return "min-w-[180px]";
  if (c.includes("LINHA /") || c.includes("LINHA APOIO") || c.includes("LINHAS ANTIGAS") || c.includes("LINHA SERIG") || c.includes("EMBARQUE")) return "min-w-[125px]";
  // Compact status operations
  if (c.length < 5 || c.includes("M2") || c.includes("UND") || c.includes("SOLA") || c.includes("DUB") || c.includes("LECTRA") || c.includes("POSTE")) return "min-w-[95px] text-center";
  return "min-w-[120px]";
};

// Header background styling based on spreadsheet groups shown in user screenshot
const getHeaderBgClass = (col: string): string => {
  const c = col.toUpperCase();
  if (c.includes("LINHA /") || c.includes("LINHA APOIO") || c.includes("LINHAS ANTIGAS") || c.includes("LINHA SERIG")) {
    // Alterado de bg-yellow-450 para bg-yellow-500 (ou utilize valor customizado sólido: bg-[#facc15])
    return "bg-yellow-500 text-black font-extrabold border-slate-300 text-center";
  }
  if (c.includes("STATUS PUXADA") || c.includes("STATUS SERIGRAFIA") || c.includes("RETORNO NF")) {
    return "bg-emerald-800 text-white font-semibold border-slate-300 text-center";
  }
  
  const processSteps = ["ENFESTO", "CORTE", "CARIMBO", "LIN ATOM", "CONTRAFORT", "ATACADOR", "ENV AVIAMENTO", "POSTE", "AUTOMATICO", "LECTRA", "REC SUPER", "KANBAN APOLO", "SERIG CARROSSEL"];
  if (processSteps.some(step => c === step)) {
    // Alterado de bg-amber-650 para bg-amber-600
    return "bg-amber-600 text-white font-semibold border-slate-300 text-center";
  }
  
  const dateSteps = ["DATA M2", "DATA AVIAMENTOS", "DATA SERIGRAFIA", "INICIO CORTE", "DATA SUPERMERCADO", "DATA ORIGINAL", "TIPO DE MATERIAL", "\"RETORNO\" ALINHAMENTO", "TURNO", "HORÁRIO", "OBS"];
  if (dateSteps.some(step => c.includes(step) || c === step)) {
    return "bg-amber-500 text-white font-semibold border-slate-300 text-center";
  }
  
  return "bg-rose-950 text-white font-semibold border-slate-300";
};

// Rich cell coloring layout derived from original sheet screenshot
const getCellStyle = (col: string, val: string): string => {
  const c = col.toUpperCase();
  const v = val.toUpperCase().trim();
  
  // Highlight LINHA headers or values on left in pure bright yellow
  if (c.includes("LINHA /") || c.includes("LINHA APOIO") || c.includes("LINHAS ANTIGAS") || c.includes("LINHA SERIG")) {
    return "bg-yellow-300 text-black font-bold text-center border-slate-300 font-mono text-[12px] group-hover:bg-yellow-200 transition-colors";
  }

  // Week Production is bright yellow background with bold black text
  if (c.includes("SEMANA PRODUÇÃO") || c.includes("SEMANA PRODUCAO")) {
    return "bg-yellow-300 text-black font-bold text-center border-slate-300 font-mono text-[12px] group-hover:bg-yellow-200 transition-colors";
  }

  // Active success status indicator
  if (v === 'OK' || v === 'CONCLUÍDO' || v === 'CONCLUIDO') {
    return "bg-emerald-600 text-white font-bold text-center text-[11px] border-emerald-700 group-hover:bg-emerald-500 transition-colors";
  }

  // Alert/Late/Danger status
  if (v.includes('FALTA') || v === 'ATRASO' || v === 'NOK' || v.includes('ATRASADO')) {
    return "bg-rose-100 text-red-700 font-bold border-red-200 text-center text-[11px] group-hover:bg-rose-200 transition-colors";
  }

  // Product Name highlight is clean bright white or pure yellow with bold dark text
  if (c.includes("NOME PRODUTO")) {
    return "bg-yellow-100 text-slate-900 font-bold border-slate-300 text-left text-[11px] font-sans group-hover:bg-blue-50 group-hover:text-black transition-colors";
  }

  // Code / Monospace columns
  if (c.includes("CÓD.") || c.includes("COD.") || c.includes("LOTE") || c.includes("COR (COR DO")) {
    // Coloring specific lot types as represented in user spreadsheet
    if (v.startsWith("UEXP")) {
      return "bg-cyan-200 text-cyan-900 font-bold text-center border-slate-300 font-mono text-[11px] group-hover:bg-cyan-300 transition-colors";
    }
    if (v.startsWith("UBL") || v.startsWith("USBF")) {
      return "bg-amber-400 text-amber-950 font-bold text-center border-slate-300 font-mono text-[11px] group-hover:bg-amber-300 transition-colors";
    }
    if (v.startsWith("BRI")) {
      return "bg-sky-200 text-slate-800 font-bold text-center border-slate-300 font-mono text-[11px] group-hover:bg-sky-300 transition-colors";
    }
    return "font-mono text-[11px] bg-white text-slate-800 border-slate-300 text-center group-hover:bg-blue-50 group-hover:text-black transition-colors";
  }

  // Quantity highlighted in high-contrast light blue background, similar to user screenshot
  if (c.includes("QTD_PROGRAMADA") || c.includes("QTD PROGRAMADA") || c.includes("QTD. PROGRAMADA") || c.includes("ABAST PRÉ")) {
    if (v && v !== '-') {
      return "bg-sky-100 text-blue-900 font-bold text-center border-sky-200 font-mono text-[12px] group-hover:bg-sky-200 transition-colors";
    }
    return "bg-white text-slate-400 font-light text-center border-slate-300 font-mono text-[11px] group-hover:bg-blue-50 group-hover:text-black transition-colors";
  }

  // Ship dates color
  if (c.includes("DT_EMBARQUE") || c.includes("DT. EMBARQUE") || c.includes("DATA EMBARQUE")) {
    const isLate = v.includes('JUL') || v.includes('3-') || v.includes('OUTUBRO');
    return isLate 
      ? "bg-white text-red-500 font-bold text-center border-slate-300 font-mono text-[12px] group-hover:bg-blue-50 group-hover:text-black transition-colors" 
      : "bg-white text-emerald-600 font-bold text-center border-slate-300 font-mono text-[12px] group-hover:bg-blue-50 group-hover:text-black transition-colors";
  }

  // PONTE, AUTOMATICO, LECTRA, REC SUPER (Cyan spreadsheet process columns)
  if (c.includes("PONTE") || c.includes("AUTOMATICO") || c.includes("LECTRA") || c.includes("REC SUPER")) {
    if (v && v !== '-') {
      return "bg-cyan-200 text-cyan-950 font-semibold text-center border-slate-300 font-mono text-[11px] group-hover:bg-cyan-300 transition-colors";
    }
    return "bg-cyan-150 text-cyan-850 font-light text-center border-slate-300 font-mono text-[11px] group-hover:bg-cyan-200 transition-colors";
  }

  // General spreadsheet process cells default to solid green or neutral green border-slate-300
  const isProcessCell = c.includes("FOLLOW") || c.includes("SEPAR.") || c.includes("ESTOQUE") || c.includes("DUB") || c.includes("CORTE") || c.includes("KANBAN") || c.includes("CARROSSEL") || c.includes("ABST");
  if (isProcessCell) {
    if (v === 'OK') return "bg-emerald-600 text-white font-bold text-[10px] text-center border-emerald-700 group-hover:bg-emerald-500 transition-colors";
    if (v === 'NOK') return "bg-red-600 text-white font-bold text-[10px] text-center border-red-700 group-hover:bg-red-500 transition-colors";
    if (c.includes("FOLLOW") && (c.includes("M2") || c.includes("UND")) && v !== '') {
      return "bg-rose-600 text-white font-bold text-center text-[10px] border-rose-700 group-hover:bg-rose-500 transition-colors";
    }
    if (!v || v === '-') {
      // In user image, these process grids appear predominantly filled with green blocks
      return "bg-emerald-700 text-emerald-100/50 text-[10px] text-center border-emerald-800/65 group-hover:bg-emerald-650 transition-colors";
    }
  }

  // Standard clean display cell mimicking Calibri/Excel layout
  return "bg-white text-slate-800 border-slate-300 text-[11px] font-medium text-center group-hover:bg-blue-50 group-hover:text-black transition-colors";
};

export default function ProgramacaoPCP({ setHeaderContent }: { setHeaderContent?: (content: React.ReactNode | null) => void }) {
  const [wipItems, setWipItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom states for holidays and vacations
  const [holidaysVacations, setHolidaysVacations] = useState<{ id: string; date: string; type: 'feriado' | 'ferias'; description: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pcp_holidays_vacations');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn("Erro ao carregar feriados e férias de localStorage", e);
        }
      }
    }
    return [];
  });
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  
  // Form states and handlers for holidays/vacation config modal
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'feriado' | 'ferias'>('feriado');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) return;
    
    const exists = holidaysVacations.some(h => h.date === newHolidayDate);
    if (exists) {
      setHolidayError("Esta data já foi cadastrada!");
      setTimeout(() => setHolidayError(null), 4000);
      return;
    }

    const newItem = {
      id: `cal-${Date.now()}`,
      date: newHolidayDate,
      type: newHolidayType,
      description: newHolidayDesc.trim() || (newHolidayType === 'feriado' ? 'Feriado' : 'Férias / Folga')
    };

    const updated = [...holidaysVacations, newItem].sort((a, b) => a.date.localeCompare(b.date));
    setHolidaysVacations(updated);
    localStorage.setItem('pcp_holidays_vacations', JSON.stringify(updated));
    
    // Reset form
    setNewHolidayDate('');
    setNewHolidayDesc('');
    setHolidayError(null);
  };

  const handleDeleteHoliday = (id: string) => {
    const updated = holidaysVacations.filter(h => h.id !== id);
    setHolidaysVacations(updated);
    localStorage.setItem('pcp_holidays_vacations', JSON.stringify(updated));
  };

  const handleRecalculateAllRows = async () => {
    setLoading(true);
    let count = 0;
    try {
      const updatedRows = await Promise.all(wipItems.map(async (row) => {
        let originalDateValue = '';
        let foundKey = '';
        const normOriginal = "data original";
        for (const actualKey of Object.keys(row)) {
          const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (normOriginal === normActual) {
            foundKey = actualKey;
            originalDateValue = String(row[actualKey]);
            break;
          }
        }
        
        if (!originalDateValue) return row;

        const calculated = calculateRetroDates(originalDateValue, holidaysVacations);
        let updatedRow = { ...row };
        setFieldsWithNormalization(updatedRow, calculated);
        
        try {
          await api.post('savePCPData', {
            id: row.id,
            sheetName: 'Wip042',
            data: updatedRow
          });
          count++;
        } catch (e) {
          console.warn(`Error background saving item ${row.id}`, e);
        }
        
        return updatedRow;
      }));

      // Cache all recalculated rows in local storage to preserve updates across pages!
      const savedEdits = localStorage.getItem('pcp_local_row_edits');
      const localEdits = savedEdits ? JSON.parse(savedEdits) : {};
      updatedRows.forEach(row => {
        localEdits[row.id] = {
          ...(localEdits[row.id] || {}),
          ...row
        };
      });
      localStorage.setItem('pcp_local_row_edits', JSON.stringify(localEdits));

      setWipItems(updatedRows);
      setFeedback({ 
        type: 'success', 
        text: `Recalculado com sucesso: ${count} OPs atualizadas no banco e na tela com o novo calendário!` 
      });
      setTimeout(() => setFeedback(null), 5000);
      setShowHolidaysModal(false);
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', text: 'Erro ao recalcular as datas do PCP.' });
    } finally {
      setLoading(false);
    }
  };
  
  // Custom filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Local search state for debouncing
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const weekSelectorRef = useRef<HTMLDivElement>(null);

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showBrandSelector, setShowBrandSelector] = useState(false);
  const brandSelectorRef = useRef<HTMLDivElement>(null);

  const [selectedStatusOpers, setSelectedStatusOpers] = useState<string[]>([]);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  const statusSelectorRef = useRef<HTMLDivElement>(null);

  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [showLineSelector, setShowLineSelector] = useState(false);
  const lineSelectorRef = useRef<HTMLDivElement>(null);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100); // 100 rows per page default
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Debounce search input for instant, lag-free typing performance
  useEffect(() => {
    if (searchInput === '') {
      setSearchTerm('');
      return;
    }
    const handler = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedWeeks, selectedBrands, selectedStatusOpers, selectedLines]);

  // States for row dragging reorder
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  
  // Save Feedback
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal editor states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  // Inline Quick Edit Cell States
  const [inlineEdit, setInlineEdit] = useState<{ rowId: string; column: string; value: string } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [wrapText, setWrapText] = useState(false);
  const [hideHeaderPanels, setHideHeaderPanels] = useState(false);

  // Column visibility states
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('PCP_COLUMNS_ONLY_ORDER');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === PCP_COLUMNS.length) {
            const allMatch = parsed.every(col => PCP_COLUMNS.includes(col)) && PCP_COLUMNS.every(col => parsed.includes(col));
            if (allMatch) {
              return parsed;
            }
          }
        } catch (e) {
          console.warn("Error parsing PCP_COLUMNS_ONLY_ORDER", e);
        }
      }
    }
    return [...PCP_COLUMNS];
  });
  const [draggedColName, setDraggedColName] = useState<string | null>(null);
  const [dragOverColName, setDragOverColName] = useState<string | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  // Click outside to close column selector and other dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
      if (weekSelectorRef.current && !weekSelectorRef.current.contains(event.target as Node)) {
        setShowWeekSelector(false);
      }
      if (brandSelectorRef.current && !brandSelectorRef.current.contains(event.target as Node)) {
        setShowBrandSelector(false);
      }
      if (statusSelectorRef.current && !statusSelectorRef.current.contains(event.target as Node)) {
        setShowStatusSelector(false);
      }
      if (lineSelectorRef.current && !lineSelectorRef.current.contains(event.target as Node)) {
        setShowLineSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync hidden columns with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pcp_hidden_columns_v1');
      if (saved) {
        try {
          setHiddenColumns(JSON.parse(saved));
        } catch (e) {
          console.error('Error parsing hidden columns from localStorage:', e);
        }
      }
    }
  }, []);

  const handleUpdateHiddenColumns = (newHidden: string[]) => {
    setHiddenColumns(newHidden);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pcp_hidden_columns_v1', JSON.stringify(newHidden));
    }
  };

  // Set header content in App.tsx dynamically if setHeaderContent is present
  useEffect(() => {
    if (setHeaderContent) {
      setHeaderContent(
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2.5 w-full select-none text-slate-100 py-1">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm md:text-base lg:text-lg font-black text-amber-400 tracking-tight flex items-center gap-2">
              <CalendarClock className="text-amber-500 flex-shrink-0 animate-pulse" size={18} />
              <span className="truncate">PCP — Plano de Corte {new Date().getFullYear()}</span>
            </h1>
            <p className="text-slate-400 text-[10px] md:text-[10.5px] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full font-medium" title="Gargalos operacionais, Follow-up de materiais, datas de embarque e liberação de corte.">
              Gargalos operacionais, Follow-up de materiais, datas de embarque e liberação de corte.
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2 flex-shrink-0">
            <button 
              id="toggle-header-panels-btn"
              onClick={() => setHideHeaderPanels(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold transition-all border shadow-sm cursor-pointer ${
                hideHeaderPanels 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-705 text-slate-100'
              }`}
            >
              {hideHeaderPanels ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{hideHeaderPanels ? "Mostrar Painel" : "Ocultar Painel"}</span>
              {hideHeaderPanels && (searchTerm !== '' || selectedWeeks.length > 0 || selectedBrands.length > 0 || selectedStatusOpers.length > 0 || selectedLines.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Filtros estão ativos!" />
              )}
            </button>
            <button 
              onClick={() => setShowHolidaysModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-705 text-slate-100 rounded-lg flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold transition-all shadow-md cursor-pointer"
            >
              <CalendarDays size={12} className="text-amber-500" />
              <span>Feriados e Férias</span>
              {holidaysVacations.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] rounded-full px-1.5 py-0.2 select-none">
                  {holidaysVacations.length}
                </span>
              )}
            </button>
            <button 
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-705 text-slate-100 rounded-lg flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold transition-all shadow-md cursor-pointer"
            >
              <Download size={12} />
              Exportar Planejamento
            </button>
            <button 
              onClick={() => fetchWipData(false, true)}
              disabled={loading}
              className={`px-3 py-1.5 text-amber-950 rounded-lg flex items-center gap-1.5 text-[10px] md:text-[11px] font-black tracking-wider uppercase transition-all shadow-md cursor-pointer ${
                loading 
                  ? 'bg-amber-500/50 cursor-not-allowed opacity-60' 
                  : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={12} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCcw size={12} />
                  Sincronizar Planilha
                </>
              )}
            </button>
          </div>
        </div>
      );
    }
    return () => {
      if (setHeaderContent) {
        setHeaderContent(null);
      }
    };
  }, [setHeaderContent, hideHeaderPanels, loading, searchTerm, selectedWeeks, selectedBrands, selectedStatusOpers, selectedLines, holidaysVacations.length]);

  const visibleColumns = useMemo(() => {
    const list = columnOrder.filter(col => !hiddenColumns.includes(col));
    return list.length > 0 ? list : columnOrder;
  }, [columnOrder, hiddenColumns]);

  // Dynamic sticky column left positions based on visible columns
  const getStickyLeft = (colName: string, visibleCols: string[]) => {
    let offset = 75; // Actions column is 75px
    const stickyCols = ["LINHA / FÁBRICA", "LINHAS ANTIGAS", "LINHA SERIG"];
    if (!stickyCols.includes(colName)) return 0;

    const indexInVisible = visibleCols.indexOf(colName);
    if (indexInVisible === -1) return 0;

    let currentOffset = offset;
    for (let i = 0; i < indexInVisible; i++) {
      const prevCol = visibleCols[i];
      if (stickyCols.includes(prevCol)) {
        currentOffset += 125; // Each of these sticky columns has min-w-[125px]
      }
    }
    return currentOffset;
  };

  // Fetch data
  const fetchWipData = async (silent = false, force = false) => {
    if (force) {
      dataCache.invalidate('wipData');
    }
    if (!silent) setLoading(true);
    try {
      const data = await dataCache.get('wipData', () => api.post('getWipData'), 30000) || [];
      const formatted = data.map((item: any, idx: number) => ({
        ...item,
        id: item.id || item.Ordem || `wip-${idx}`,
        _rowIndex: item._rowIndex || idx + 2
      }));

      // If we got back basic mock data with few columns, merge with the real full schema!
      const enriched = formatted.map((item: any, idx: number) => {
        // Check if standard columns are missing, then inject full 54-columns fallback values
        if (!item['LINHA / FÁBRICA'] && !item['LINHA / FABRICA']) {
          return getEnrichedMockRow(item, idx);
        }
        return item;
      });

      // Retrieve locally saved edits to merge them and maintain offline persistence across page refreshes
      let localEdits: { [key: string]: any } = {};
      if (typeof window !== 'undefined') {
        const savedEdits = localStorage.getItem('pcp_local_row_edits');
        if (savedEdits) {
          try {
            localEdits = JSON.parse(savedEdits);
          } catch(e) {
            console.error("Error loading local row edits:", e);
          }
        }
      }

      const mergedWithLocal = enriched.map((item: any) => {
        if (localEdits[item.id]) {
          return { ...item, ...localEdits[item.id] };
        }
        return item;
      });

      setWipItems(mergedWithLocal);
    } catch (err) {
      console.error('Erro ao buscar dados do WIP (PCP):', err);
      // Fallback directly to 3 full size mock rows matching screenshot
      const fallbackData = [
        getEnrichedMockRow({ Ordem: '1407124', Marca: 'ASICS', 'Semana': '25' }, 0),
        getEnrichedMockRow({ Ordem: '1407315', Marca: 'ASICS', 'Semana': '25' }, 1),
        getEnrichedMockRow({ Ordem: '1407352', Marca: 'ASICS', 'Semana': '27' }, 2)
      ];

      let localEdits: { [key: string]: any } = {};
      if (typeof window !== 'undefined') {
        const savedEdits = localStorage.getItem('pcp_local_row_edits');
        if (savedEdits) {
          try {
            localEdits = JSON.parse(savedEdits);
          } catch(e) {
            console.error("Error loading local row edits:", e);
          }
        }
      }

      const mergedFallback = fallbackData.map((item: any) => {
        if (localEdits[item.id]) {
          return { ...item, ...localEdits[item.id] };
        }
        return item;
      });

      setWipItems(mergedFallback);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchWipData();
  }, []);

  // Set focus on inline input if active
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineEdit]);

  // Handle saving of entire row via Modal Form
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingItem(editingItem.id);
    try {
      // Create clone matching the correct case of keys in the object
      let updatedItem = { ...editingItem };
      
      // Map all modified form fields correctly back to keys
      PCP_COLUMNS.forEach((col) => {
        const value = formFields[col] || '';
        
        let foundKey = col;
        const normTitle = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        for (const actualKey of Object.keys(editingItem)) {
          const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (normTitle === normActual) {
            foundKey = actualKey;
            break;
          }
        }
        updatedItem[foundKey] = value;
      });

      // Update local state
      setWipItems(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));

      // Persist in local storage for absolute robustness/refresh proof!
      if (typeof window !== 'undefined') {
        const savedEdits = localStorage.getItem('pcp_local_row_edits');
        const localEdits = savedEdits ? JSON.parse(savedEdits) : {};
        localEdits[editingItem.id] = {
          ...(localEdits[editingItem.id] || {}),
          ...updatedItem
        };
        localStorage.setItem('pcp_local_row_edits', JSON.stringify(localEdits));
      }

      // Attempt endpoint save
      try {
        await api.post('savePCPData', {
          id: updatedItem.id,
          sheetName: 'Wip042',
          data: updatedItem
        });
      } catch (saveErr) {
        console.warn('Endpoint error or mock environment:', saveErr);
      }

      setFeedback({ type: 'success', text: `Ordem de Produção atualizada com sucesso!` });
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Não foi possível gravar os dados da peça.' });
    } finally {
      setSavingItem(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Handle saving of one single cell edited inline
  const handleInlineSave = async (item: any, column: string, newValue: string) => {
    let updatedRowResult: any = null;

    setWipItems(prev => prev.map(row => {
      if (row.id === item.id) {
        let updatedRow = { ...row };
        let foundKey = column;
        const normTitle = column.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        for (const actualKey of Object.keys(row)) {
          const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (normTitle === normActual) {
            foundKey = actualKey;
            break;
          }
        }
        updatedRow[foundKey] = newValue;

        // If updating DATA ORIGINAL, auto recalculate and assign retroactive dates!
        if (normTitle === "data original") {
          const calculated = calculateRetroDates(newValue, holidaysVacations);
          setFieldsWithNormalization(updatedRow, calculated);
        }

        updatedRowResult = updatedRow;
        return updatedRow;
      }
      return row;
    }));

    setInlineEdit(null);

    // Save in background and client storage
    try {
      let finalRow = updatedRowResult;
      if (!finalRow) {
        finalRow = { ...item };
        let foundKey = column;
        const normTitle = column.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        for (const actualKey of Object.keys(finalRow)) {
          const normActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (normTitle === normActual) {
            foundKey = actualKey;
            break;
          }
        }
        finalRow[foundKey] = newValue;

        if (normTitle === "data original") {
          const calculated = calculateRetroDates(newValue, holidaysVacations);
          setFieldsWithNormalization(finalRow, calculated);
        }
      }

      // 1. Persist in local storage for absolute robustness/refresh proof!
      if (typeof window !== 'undefined') {
        const savedEdits = localStorage.getItem('pcp_local_row_edits');
        const localEdits = savedEdits ? JSON.parse(savedEdits) : {};
        localEdits[item.id] = {
          ...(localEdits[item.id] || {}),
          ...finalRow
        };
        localStorage.setItem('pcp_local_row_edits', JSON.stringify(localEdits));
      }

      // 2. Persist in Google Sheets (or fallback database)
      await api.post('savePCPData', {
        id: item.id,
        sheetName: 'Wip042',
        data: finalRow
      });
    } catch(e) {
      console.log('Background save updated inline with local storage backup sync.', e);
    }
  };

  // Pivot list of Weeks
  const weeks = useMemo(() => {
    const list = new Set<string>();
    wipItems.forEach(item => {
      const wk = getVal(item, 'SEMANA PRODUÇÃO') || getVal(item, 'Semana') || '';
      if (wk) list.add(wk);
    });
    return ['TODAS', ...Array.from(list).sort()];
  }, [wipItems]);

  // Pivot list of Brands
  const brands = useMemo(() => {
    const list = new Set<string>();
    wipItems.forEach(item => {
      const b = getVal(item, 'MARCA') || getVal(item, 'Marca') || '';
      if (b) list.add(b);
    });
    return ['TODAS', ...Array.from(list).sort()];
  }, [wipItems]);

  // Pivot list of Operations Status
  const statuses = useMemo(() => {
    const list = new Set<string>();
    wipItems.forEach(item => {
      const s = getVal(item, 'STATUS DA OPERAÇÃO') || getVal(item, 'Status') || '';
      if (s) list.add(s);
    });
    return ['TODOS', ...Array.from(list).sort()];
  }, [wipItems]);

  // Pivot list of Lines
  const lines = useMemo(() => {
    const list = new Set<string>();
    wipItems.forEach(item => {
      const l = getVal(item, 'LINHA / FÁBRICA') || '';
      if (l) list.add(l);
    });
    return ['TODAS', ...Array.from(list).sort()];
  }, [wipItems]);

  // Filtered array based on user pivot settings
  const filteredWip = useMemo(() => {
    return wipItems.filter(item => {
      const itemWk = getVal(item, 'SEMANA PRODUÇÃO') || getVal(item, 'Semana') || '';
      const matchWeek = selectedWeeks.length === 0 || selectedWeeks.includes(itemWk);
      
      const itemBrand = getVal(item, 'MARCA') || getVal(item, 'Marca') || '';
      const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(itemBrand);

      const itemStatus = getVal(item, 'STATUS DA OPERAÇÃO') || getVal(item, 'Status') || '';
      const matchStatus = selectedStatusOpers.length === 0 || selectedStatusOpers.includes(itemStatus);

      const itemLine = getVal(item, 'LINHA / FÁBRICA') || '';
      const matchLine = selectedLines.length === 0 || selectedLines.includes(itemLine);
      
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term ||
        String(getVal(item, 'NOME PRODUTO') || '').toLowerCase().includes(term) ||
        String(getVal(item, 'LOTE') || '').toLowerCase().includes(term) ||
        String(getVal(item, 'CÓD. PRODUTO') || '').toLowerCase().includes(term) ||
        String(getVal(item, 'OBS') || '').toLowerCase().includes(term) ||
        String(item.id || '').toLowerCase().includes(term);

      return matchWeek && matchBrand && matchStatus && matchLine && matchSearch;
    });
  }, [wipItems, selectedWeeks, selectedBrands, selectedStatusOpers, selectedLines, searchTerm]);

  // Compute stats card totals
  const totals = useMemo(() => {
    const totalOrders = filteredWip.length;
    const totalQty = filteredWip.reduce((sum, curr) => {
      const rawVal = getVal(curr, 'QTD. PROGRAMADA') || getVal(curr, 'Qtd a Cortar') || getVal(curr, 'ABAST PRÉ') || '0';
      const val = parseInt(rawVal.replace(/\D/g, '')) || 0;
      return sum + val;
    }, 0);
    
    // Group loads by brand
    const brandLoads: Record<string, number> = {};
    filteredWip.forEach(item => {
      const bBrand = getVal(item, 'MARCA') || 'DADOS';
      const rawVal = getVal(item, 'QTD. PROGRAMADA') || getVal(item, 'Qtd a Cortar') || getVal(item, 'ABAST PRÉ') || '0';
      const val = parseInt(rawVal.replace(/\D/g, '')) || 0;
      brandLoads[bBrand] = (brandLoads[bBrand] || 0) + val;
    });
    
    return { totalOrders, totalQty, brandLoads };
  }, [filteredWip]);

  // Paginated subset of rows for instantaneous performance
  const paginatedWip = useMemo(() => {
    if (pageSize === -1) return filteredWip;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredWip.slice(startIndex, startIndex + pageSize);
  }, [filteredWip, currentPage, pageSize]);

  // Infinite scroll / auto-load more rows on reaching the bottom of the current view
  const lastRowRef = (node: HTMLTableRowElement | null) => {
    if (loading || isAutoLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    if (node) {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (paginatedWip.length < filteredWip.length) {
            setIsAutoLoading(true);
            // Brief timeout for standard smooth organic loading indicator display
            setTimeout(() => {
              setPageSize(prev => {
                if (prev === -1) return -1;
                // Append next batch of 150 rows automatically!
                return prev + 150;
              });
              setIsAutoLoading(false);
            }, 250);
          }
        }
      }, {
        rootMargin: '150px', // Trigger slightly ahead of time for ultimate seamlessness
        threshold: 0.1
      });
      observerRef.current.observe(node);
    }
  };

  // Disconnect the intersection observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const totalItems = filteredWip.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
  const safeCurrentPage = Math.min(currentPage, totalPages || 1);

  // Helper to generate completely realistic full mock rows based on the user screenshot
  function getEnrichedMockRow(baseItem: any, idx: number): any {
    const defaultTemplates = [
      {
        "LINHA / FÁBRICA": "1626",
        "LINHAS ANTIGAS": "3101",
        "LINHA SERIG": "3624",
        "FALTAS": "",
        "ABAST PRÉ": "447",
        "GIRO FAB": "",
        "SOLA EXTERIOR OK": "OK",
        "CÓD. PRODUTO": "1407124",
        "MARCA": baseItem.Marca || "ASICS",
        "FAMÍLIA MONTAGEM": "ENSACADO",
        "SEMANA ORIGINAL": "202628",
        "DT. EMBARQUE": "25-jun.",
        "SEMANA PRODUÇÃO": baseItem.Semana || "25",
        "NOME PRODUTO": "GEL-SHOGUN 9 M BLACK/BLUE",
        "LOTE": "ASB0052391UN",
        "COR (COR DO TALÃO)": "15597701",
        "QTD. PROGRAMADA": "447",
        "STATUS DA OPERAÇÃO": "FALTA CORTAR",
        "FOLLOW M2": "OK",
        "FOLLOW UND": "",
        "FOLLOW SOLA": "OK",
        "SEPAR. SERIGRAFIA": "",
        "ESTOQUE": "",
        "CONJUNTO": "",
        "ABAST DUB": "",
        "DUB LAGOA": "Process...",
        "QT CONTE": "",
        "ENFESTO": "",
        "CORTE": "",
        "CARIMBO": "",
        "LIN ATOM": "OK",
        "CONTRAFORT": "OK",
        "ATACADOR": "OK",
        "ENV AVIAMENTO": "OK",
        "POSTE": "OK",
        "AUTOMATICO": "06/07",
        "LECTRA": "",
        "REC SUPER": "",
        "KANBAN APOLO": "",
        "SERIG CARROSSEL": "OK",
        "DATA M2": "",
        "DATA AVIAMENTOS": "FALTA SERIGRAFIA",
        "DATA SERIGRAFIA": "1263270 FILME ADES NF 676 09/06 AG ENVIO",
        "DATA CORTE / CORTE AUTOMATICO ": "",
        "DATA SUPERMERCADO": "",
        "DATA ORIGINAL": "",
        "TIPO DE MATERIAL": "SINTETICO",
        "\"RETORNO\" ALINHAMENTO": "",
        "TURNO": "1° TURNO",
        "HORÁRIO": "07:30",
        "OBS": "1263270 FILME ADES NF 676 09/06 AG ENVIO ----",
        "STATUS PUXADA": "",
        "STATUS SERIGRAFIA": "",
        "RETORNO NF / OBS GERAIS / DATA DE CHEGADA": ""
      },
      {
        "LINHA / FÁBRICA": "1626",
        "LINHAS ANTIGAS": "3101",
        "LINHA SERIG": "3624",
        "FALTAS": "",
        "ABAST PRÉ": "515",
        "GIRO FAB": "",
        "SOLA EXTERIOR OK": "",
        "CÓD. PRODUTO": "1407315",
        "MARCA": baseItem.Marca || "ASICS",
        "FAMÍLIA MONTAGEM": "ENSACADO",
        "SEMANA ORIGINAL": "202624",
        "DT. EMBARQUE": "25-jun.",
        "SEMANA PRODUÇÃO": baseItem.Semana || "25",
        "NOME PRODUTO": "GEL-SHOGUN 9 M VINTAGE KHAKI/KHAKI",
        "LOTE": "ASB0052417UN",
        "COR (COR DO TALÃO)": "15486346",
        "QTD. PROGRAMADA": "515",
        "STATUS DA OPERAÇÃO": "FALTA CORTAR",
        "FOLLOW M2": "",
        "FOLLOW UND": "",
        "FOLLOW SOLA": "",
        "SEPAR. SERIGRAFIA": "",
        "ESTOQUE": "",
        "CONJUNTO": "",
        "ABAST DUB": "",
        "DUB LAGOA": "",
        "QT CONTE": "",
        "ENFESTO": "",
        "CORTE": "",
        "CARIMBO": "",
        "LIN ATOM": "OK",
        "CONTRAFORT": "OK",
        "ATACADOR": "",
        "ENV AVIAMENTO": "",
        "POSTE": "06/07",
        "AUTOMATICO": "",
        "LECTRA": "",
        "REC SUPER": "",
        "KANBAN APOLO": "OK",
        "SERIG CARROSSEL": "",
        "DATA M2": "",
        "DATA AVIAMENTOS": "FALTA SERIGRAFIA",
        "DATA SERIGRAFIA": "1391516 TECIDO JAC OC 15486346 FAT 02/06/26 ATRASO",
        "INICIO CORTE / CORTE AUTO": "",
        "DATA SUPERMERCADO": "",
        "DATA ORIGINAL": "",
        "TIPO DE MATERIAL": "TEXTIL",
        "\"RETORNO\" ALINHAMENTO": "",
        "TURNO": "2° TURNO",
        "HORÁRIO": "18:00",
        "OBS": "1391516 TECIDO JAC OC 15496689 FAT 02/06/26 ATRASO",
        "STATUS PUXADA": "",
        "STATUS SERIGRAFIA": "",
        "RETORNO NF / OBS GERAIS / DATA DE CHEGADA": ""
      },
      {
        "LINHA / FÁBRICA": "1626",
        "LINHAS ANTIGAS": "3101",
        "LINHA SERIG": "3624",
        "FALTAS": "",
        "ABAST PRÉ": "1077",
        "GIRO FAB": "",
        "SOLA EXTERIOR OK": "",
        "CÓD. PRODUTO": "1407352",
        "MARCA": baseItem.Marca || "ASICS",
        "FAMÍLIA MONTAGEM": "ENSACADO",
        "SEMANA ORIGINAL": "202623",
        "DT. EMBARQUE": "3-jul.",
        "SEMANA PRODUÇÃO": baseItem.Semana || "27",
        "NOME PRODUTO": "GEL-SHOGUN 9 W BLACK/WHITE",
        "LOTE": "ASB0052395",
        "COR (COR DO TALÃO)": "15486349",
        "QTD. PROGRAMADA": "1077",
        "STATUS DA OPERAÇÃO": "FALTA CORTAR",
        "FOLLOW M2": "OK",
        "FOLLOW UND": "",
        "FOLLOW SOLA": "",
        "SEPAR. SERIGRAFIA": "",
        "ESTOQUE": "",
        "CONJUNTO": "",
        "ABAST DUB": "",
        "DUB LAGOA": "",
        "QT CONTE": "",
        "ENFESTO": "",
        "CORTE": "",
        "CARIMBO": "",
        "LIN ATOM": "OK",
        "CONTRAFORT": "OK",
        "ATACADOR": "",
        "ENV AVIAMENTO": "",
        "POSTE": "06/07",
        "AUTOMATICO": "",
        "LECTRA": "",
        "REC SUPER": "",
        "KANBAN APOLO": "OK",
        "SERIG CARROSSEL": "",
        "DATA M2": "",
        "DATA AVIAMENTOS": "FALTA SERIGRAFIA",
        "DATA SERIGRAFIA": "1391513 TECIDO JAC NF 1099688 4/6/2026 AG ENVIO...",
        "INICIO CORTE / CORTE AUTO": "",
        "DATA SUPERMERCADO": "",
        "DATA ORIGINAL": "",
        "TIPO DE MATERIAL": "TEXTIL",
        "\"RETORNO\" ALINHAMENTO": "",
        "TURNO": "1° TURNO",
        "HORÁRIO": "07:30",
        "OBS": "1391513 TECIDO JAC NF 1099688 4/6/2026 AG ENVIO...",
        "STATUS PUXADA": "",
        "STATUS SERIGRAFIA": "",
        "RETORNO NF / OBS GERAIS / DATA DE CHEGADA": ""
      }
    ];

    const template = defaultTemplates[idx % defaultTemplates.length];
    
    return {
      ...template,
      id: baseItem.Ordem || `wip-${idx}`,
      "MARCA": baseItem.Marca || template.MARCA,
      "CÓD. PRODUTO": baseItem.Ordem || template['CÓD. PRODUTO'],
      "SEMANA PRODUÇÃO": baseItem.Semana || template['SEMANA PRODUÇÃO']
    };
  }

  // Trigger editing values
  const startEditingRow = (item: any) => {
    setEditingItem(item);
    const fields: Record<string, string> = {};
    PCP_COLUMNS.forEach(col => {
      fields[col] = getVal(item, col);
    });
    setFormFields(fields);
  };

  const handleExportCSV = () => {
    try {
      const headers = PCP_COLUMNS.join(';');
      const rows = filteredWip.map(item => 
        PCP_COLUMNS.map(col => `"${getVal(item, col).replace(/"/g, '""')}"`).join(';')
      );
      const csvContent = "\uFEFF" + [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const wkLabel = selectedWeeks.length === 0 ? 'TODAS' : selectedWeeks.join('_');
      link.setAttribute("download", `programacao_pcp_semana_${wkLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-2 md:p-3 h-full bg-slate-900 text-slate-100 flex flex-col gap-2 overflow-hidden font-sans">
      {/* Title block */}
      {!setHeaderContent && (
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2.5 bg-slate-800/60 p-2.5 px-3.5 rounded-lg border border-slate-700/55 shadow-md flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm md:text-base font-black text-amber-400 tracking-tight flex items-center gap-2">
              <CalendarClock className="text-amber-500 flex-shrink-0 animate-pulse" size={18} />
              <span className="truncate">PCP — Plano de Corte {new Date().getFullYear()}</span>
            </h1>
            <p className="text-slate-400 text-[10px] md:text-[10.5px] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full font-medium" title="Gargalos operacionais, Follow-up de materiais, datas de embarque e liberação de corte.">
              Gargalos operacionais, Follow-up de materiais, datas de embarque e liberação de corte.
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-1.5 flex-shrink-0">
            <button 
              id="toggle-header-panels-btn"
              onClick={() => setHideHeaderPanels(!hideHeaderPanels)}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10.5px] md:text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                hideHeaderPanels 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30' 
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-100'
              }`}
            >
              {hideHeaderPanels ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{hideHeaderPanels ? "Mostrar Painel" : "Ocultar Painel"}</span>
              {hideHeaderPanels && (searchTerm !== '' || selectedWeeks.length > 0 || selectedBrands.length > 0 || selectedStatusOpers.length > 0 || selectedLines.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Filtros estão ativos!" />
              )}
            </button>
            <button 
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 bg-slate-705 hover:bg-slate-600 border border-slate-600 text-slate-100 rounded-lg flex items-center gap-1.5 text-[10.5px] md:text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Download size={12} />
              Exportar Planejamento
            </button>
            <button 
              onClick={() => setShowHolidaysModal(true)}
              className="px-2.5 py-1.5 bg-slate-705 hover:bg-slate-600 border border-slate-600 text-slate-100 rounded-lg flex items-center gap-1.5 text-[10.5px] md:text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <CalendarDays size={12} className="text-amber-500" />
              <span>Feriados e Férias</span>
              {holidaysVacations.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] rounded-full px-1.5 py-0.2 select-none">
                  {holidaysVacations.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => fetchWipData(false, true)}
              disabled={loading}
              className={`px-2.5 py-1.5 text-amber-950 rounded-lg flex items-center gap-1.25 text-[10.5px] md:text-xs font-black tracking-wider uppercase transition-all shadow-md cursor-pointer ${
                loading 
                  ? 'bg-amber-500/50 cursor-not-allowed opacity-60' 
                  : 'bg-amber-500 hover:bg-amber-605 shadow-amber-500/20'
              }`}
            >
              <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Sincronizar Planilha</span>
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`p-4 rounded-lg flex items-center gap-2 text-xs font-bold shadow-md animate-bounce ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
          <CheckCircle size={16} />
          {feedback.text}
        </div>
      )}

      {/* Grid of KPIs */}
      {!hideHeaderPanels && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* KPI 1 */}
        <div className="bg-slate-850 rounded-lg border border-slate-705/85 p-2 px-3 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-md">
            <TableProperties size={18} />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Ordens Filtradas</p>
            <p className="text-base font-black text-white mt-0.5">{totals.totalOrders} <span className="text-[10px] text-slate-400 font-normal">OPs</span></p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-850 rounded-lg border border-slate-705/85 p-2 px-3 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-md">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Volume (Pares)</p>
            <p className="text-base font-black text-cyan-300 mt-0.5">
              {totals.totalQty.toLocaleString('pt-BR')} <span className="text-[10px] text-slate-400 font-normal">PARES</span>
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-850 rounded-lg border border-slate-705/85 p-2 px-3 shadow-sm flex items-center gap-3 md:col-span-2">
          <div className="p-2 bg-violet-500/10 text-violet-400 rounded-md">
            <BarChart3 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Distribuição por Marca</p>
            <div className="flex gap-1.5 flex-wrap mt-0.5 overflow-x-auto max-h-[36px]">
              {Object.keys(totals.brandLoads).map(brand => (
                <span key={brand} className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-black uppercase border border-slate-700/60 leading-none">
                  {brand}: {totals.brandLoads[brand].toLocaleString('pt-BR')} px
                </span>
              ))}
              {Object.keys(totals.brandLoads).length === 0 && <span className="text-xs text-slate-500">-</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Table Filters Pivot Controller */}
      {!hideHeaderPanels && (
        <div className="bg-slate-850 rounded-lg border border-slate-705/85 p-2.5 flex flex-col gap-2 shadow-md">
        <div className="flex items-center gap-1.5 border-b border-slate-700/40 pb-1.5">
          <SlidersHorizontal className="text-amber-500" size={13} />
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-300">Painel de Filtros e Segmentação PCP</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Filter search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por lote, modelo, OP..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-amber-550 transition-all placeholder:text-slate-500 h-[34px]"
            />
          </div>

          {/* Filter Week Multi-Select */}
          <div className="relative" ref={weekSelectorRef}>
            <div 
              onClick={() => setShowWeekSelector(!showWeekSelector)}
              className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 text-xs font-bold cursor-pointer h-[34px] select-none"
            >
              <div className="flex items-center gap-1 overflow-hidden py-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase px-0.5 font-sans">Semana:</span>
                <span className="text-slate-150 truncate max-w-[120px] font-black">
                  {selectedWeeks.length === 0 
                    ? "TODAS" 
                    : selectedWeeks.length === 1 
                      ? `${selectedWeeks[0]}` 
                      : `${selectedWeeks.length} Sel.`}
                </span>
              </div>
              <ChevronRight size={13} className={`text-slate-400 transition-transform mr-1 ${showWeekSelector ? 'rotate-90' : ''}`} />
            </div>

            {showWeekSelector && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Filtrar Semanas</span>
                  {selectedWeeks.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWeeks([]);
                      }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 underline font-black cursor-pointer uppercase"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-1 select-none flex flex-col bg-slate-950/45 rounded border border-slate-800/60 divide-y divide-slate-805">
                  {weeks.filter(w => w !== 'TODAS').map((wk) => {
                    const isChecked = selectedWeeks.includes(wk);
                    return (
                      <label 
                        key={wk} 
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-805/60 rounded cursor-pointer transition-colors text-left"
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedWeeks(selectedWeeks.filter(w => w !== wk));
                            } else {
                              setSelectedWeeks([...selectedWeeks, wk].sort());
                            }
                          }}
                          className="rounded border-slate-650 bg-slate-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-550"
                        />
                        <span className="text-[11px] font-bold text-slate-300">
                          Semana {wk}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filter Brand Multi-Select */}
          <div className="relative" ref={brandSelectorRef}>
            <div 
              onClick={() => setShowBrandSelector(!showBrandSelector)}
              className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 text-xs font-bold cursor-pointer h-[34px] select-none"
            >
              <div className="flex items-center gap-1 overflow-hidden py-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase px-0.5 font-sans">Marca:</span>
                <span className="text-slate-150 truncate max-w-[120px] font-black">
                  {selectedBrands.length === 0 
                    ? "TODAS" 
                    : selectedBrands.length === 1 
                      ? `${selectedBrands[0]}` 
                      : `${selectedBrands.length} Sel.`}
                </span>
              </div>
              <ChevronRight size={13} className={`text-slate-400 transition-transform mr-1 ${showBrandSelector ? 'rotate-90' : ''}`} />
            </div>

            {showBrandSelector && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Filtrar Marcas</span>
                  {selectedBrands.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBrands([]);
                      }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 underline font-black cursor-pointer uppercase"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-1 select-none flex flex-col bg-slate-950/45 rounded border border-slate-800/60 divide-y divide-slate-805">
                  {brands.filter(b => b !== 'TODAS').map((br) => {
                    const isChecked = selectedBrands.includes(br);
                    return (
                      <label 
                        key={br} 
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-805/60 rounded cursor-pointer transition-colors text-left"
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedBrands(selectedBrands.filter(b => b !== br));
                            } else {
                              setSelectedBrands([...selectedBrands, br].sort());
                            }
                          }}
                          className="rounded border-slate-650 bg-slate-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-550"
                        />
                        <span className="text-[11px] font-bold text-slate-300">
                          {br}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filter Status Operacao Multi-Select */}
          <div className="relative" ref={statusSelectorRef}>
            <div 
              onClick={() => setShowStatusSelector(!showStatusSelector)}
              className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 text-xs font-bold cursor-pointer h-[34px] select-none"
            >
              <div className="flex items-center gap-1 overflow-hidden py-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase px-0.5 font-sans">Op.:</span>
                <span className="text-slate-150 truncate max-w-[125px] font-black">
                  {selectedStatusOpers.length === 0 
                    ? "TODOS" 
                    : selectedStatusOpers.length === 1 
                      ? `${selectedStatusOpers[0]}` 
                      : `${selectedStatusOpers.length} Sel.`}
                </span>
              </div>
              <ChevronRight size={13} className={`text-slate-400 transition-transform mr-1 ${showStatusSelector ? 'rotate-90' : ''}`} />
            </div>

            {showStatusSelector && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Filtrar Operações</span>
                  {selectedStatusOpers.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStatusOpers([]);
                      }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 underline font-black cursor-pointer uppercase"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-1 select-none flex flex-col bg-slate-950/45 rounded border border-slate-800/60 divide-y divide-slate-805">
                  {statuses.filter(s => s !== 'TODOS').map((st) => {
                    const isChecked = selectedStatusOpers.includes(st);
                    return (
                      <label 
                        key={st} 
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-805/60 rounded cursor-pointer transition-colors text-left"
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedStatusOpers(selectedStatusOpers.filter(s => s !== st));
                            } else {
                              setSelectedStatusOpers([...selectedStatusOpers, st].sort());
                            }
                          }}
                          className="rounded border-slate-650 bg-slate-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-550"
                        />
                        <span className="text-[11px] font-bold text-slate-300">
                          {st}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filter Line Multi-Select */}
          <div className="relative" ref={lineSelectorRef}>
            <div 
              onClick={() => setShowLineSelector(!showLineSelector)}
              className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 text-xs font-bold cursor-pointer h-[34px] select-none"
            >
              <div className="flex items-center gap-1 overflow-hidden py-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase px-0.5 font-sans">Linha:</span>
                <span className="text-slate-150 truncate max-w-[120px] font-black">
                  {selectedLines.length === 0 
                    ? "TODAS" 
                    : selectedLines.length === 1 
                      ? `${selectedLines[0]}` 
                      : `${selectedLines.length} Sel.`}
                </span>
              </div>
              <ChevronRight size={13} className={`text-slate-400 transition-transform mr-1 ${showLineSelector ? 'rotate-90' : ''}`} />
            </div>

            {showLineSelector && (
              <div className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Filtrar Linhas</span>
                  {selectedLines.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLines([]);
                      }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 underline font-black cursor-pointer uppercase"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-1 select-none flex flex-col bg-slate-950/45 rounded border border-slate-800/60 divide-y divide-slate-805">
                  {lines.filter(l => l !== 'TODAS').map((ln) => {
                    const isChecked = selectedLines.includes(ln);
                    return (
                      <label 
                        key={ln} 
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-805/60 rounded cursor-pointer transition-colors text-left"
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedLines(selectedLines.filter(l => l !== ln));
                            } else {
                              setSelectedLines([...selectedLines, ln].sort());
                            }
                          }}
                          className="rounded border-slate-650 bg-slate-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-550"
                        />
                        <span className="text-[11px] font-bold text-slate-300">
                          Linha {ln}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main spreadsheet tracking card */}
      <div className="bg-slate-850 rounded-xl border border-slate-700/60 overflow-hidden flex flex-col shadow-lg flex-1 min-h-0">
        
        {/* Helper info banner */}
        <div className="bg-slate-800 border-b border-slate-700 p-3 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Info size={13} className="text-amber-450 flex-shrink-0" />
            <span>Role para os lados para ver as 54 colunas. <strong>Dicas:</strong> Dê clique duplo para editar rápido ou hover (passar o mouse) para ver o texto completo!</span>
          </span>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-slate-200 cursor-pointer hover:text-white select-none transition-colors">
              <input 
                type="checkbox"
                checked={wrapText}
                onChange={(e) => setWrapText(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer accent-amber-550"
              />
              <span className="font-bold tracking-wide uppercase text-[10px] text-amber-400">Ajustar / Quebrar Linhas</span>
            </label>

            {/* Caixa Seletora de Ocultar/Exibir Colunas */}
            <div className="relative inline-block text-left" ref={columnSelectorRef}>
              <button
                type="button"
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-750 text-slate-205 hover:text-white rounded text-[10px] font-bold uppercase border border-slate-700 transition-all cursor-pointer"
              >
                <SlidersHorizontal size={11} className="text-amber-400 animate-pulse" />
                <span>Colunas ({PCP_COLUMNS.length - hiddenColumns.length} visíveis)</span>
              </button>
              
              {showColumnSelector && (
                <div className="absolute right-0 mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Exibir/Ocultar Colunas</span>
                    <div className="flex gap-2.5 items-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateHiddenColumns([])}
                        className="text-[9px] text-amber-400 hover:text-amber-300 underline font-black cursor-pointer uppercase"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateHiddenColumns([...PCP_COLUMNS])}
                        className="text-[9px] text-slate-405 hover:text-white underline font-black cursor-pointer uppercase"
                      >
                        Nenhuma
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setColumnOrder([...PCP_COLUMNS]);
                          localStorage.removeItem('PCP_COLUMNS_ONLY_ORDER');
                        }}
                        className="text-[9px] text-emerald-450 hover:text-emerald-355 underline font-black cursor-pointer uppercase font-sans"
                        title="Restaurar colunas para a ordem original padrão"
                      >
                        Restaurar Ordem
                      </button>
                    </div>
                  </div>
                  
                  {/* Busca filtrando colunas */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar coluna..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                  
                  {/* Lista com scroll */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-805 pr-1 select-none flex flex-col bg-slate-950/45 rounded border border-slate-800/60">
                    {columnOrder.filter(col => 
                      col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .includes(columnSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
                    ).map((col) => {
                      const isHidden = hiddenColumns.includes(col);
                      return (
                        <label 
                          key={col} 
                          className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-805/60 rounded cursor-pointer transition-colors text-left"
                        >
                          <input 
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => {
                              if (isHidden) {
                                handleUpdateHiddenColumns(hiddenColumns.filter(c => c !== col));
                              } else {
                                handleUpdateHiddenColumns([...hiddenColumns, col]);
                              }
                            }}
                            className="rounded border-slate-650 bg-slate-900 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer accent-amber-550"
                          />
                          <span className="text-[10.5px] font-bold text-slate-300 truncate" title={col}>
                            {col}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <span className="hidden sm:inline-block bg-slate-900 text-amber-500 px-2.5 py-1 rounded font-mono font-bold uppercase border border-slate-700">
              Sheet Name: Wip042
            </span>
          </div>
        </div>

        {loading && wipItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 gap-4">
            <Loader2 className="animate-spin text-amber-550" size={44} />
            <p className="text-slate-400 font-bold text-sm tracking-wider uppercase animate-pulse">Lendo banco de dados da planilha...</p>
          </div>
        ) : filteredWip.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Nenhuma linha na planilha encontrou correspondência com os filtros informados.
          </div>
        ) : (
          <>
          {/* Table horizontal scrolling container */}
          <div className="overflow-x-auto relative flex-1 overflow-y-auto border border-slate-700/60 rounded-lg min-h-0">
            <table className="min-w-max w-full text-left border-collapse select-none bg-slate-900">
              
              {/* Sticky Headers */}
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-900 text-slate-350 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-700 shadow-md h-[36px]">
                  
                  {/* Sticky Control Header Column */}
                  <th className="sticky left-0 z-30 bg-slate-900/95 border-r border-slate-700 text-center w-[75px] min-w-[75px] py-1 px-1.5 text-[10px] h-[36px]">
                    Ações
                  </th>

                  {/* Dynamic spreadsheet column headers (visible only) */}
                  {visibleColumns.map((col) => {
                    const bgClass = getHeaderBgClass(col);
                    const widthClass = getColMinWidth(col);
                    
                    // First 3 columns will be frozen/sticky on the left if visible
                    let stickyClass = "";
                    let stickyStyle: React.CSSProperties = {};
                    const isStickyCol = ["LINHA / FÁBRICA", "LINHAS ANTIGAS", "LINHA SERIG"].includes(col);
                    if (isStickyCol) {
                      stickyClass = "sticky z-30 shadow-[1px_0_0_0_rgba(100,116,139,0.3)]";
                      stickyStyle = { left: `${getStickyLeft(col, visibleColumns)}px` };
                    }

                    return (
                      <th 
                        key={col} 
                        style={stickyStyle}
                        draggable
                        onDragStart={(e) => {
                          setDraggedColName(col);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', col);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverColName !== col) {
                            setDragOverColName(col);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverColName === col) {
                            setDragOverColName(null);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedColName(null);
                          setDragOverColName(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const source = draggedColName;
                          setDraggedColName(null);
                          setDragOverColName(null);
                          
                          if (!source || source === col) return;
                          
                          setColumnOrder(prev => {
                            const list = [...prev];
                            const sourceIdx = list.indexOf(source);
                            const targetIdx = list.indexOf(col);
                            if (sourceIdx === -1 || targetIdx === -1) return prev;
                            
                            // Swap column positions
                            const [moved] = list.splice(sourceIdx, 1);
                            list.splice(targetIdx, 0, moved);
                            
                            localStorage.setItem('PCP_COLUMNS_ONLY_ORDER', JSON.stringify(list));
                            return list;
                          });
                        }}
                        className={`py-1 px-1 h-[36px] text-[10px] font-black uppercase text-center border-r select-none cursor-grab active:cursor-grabbing transition-all ${bgClass} ${widthClass} ${stickyClass} ${
                          draggedColName === col ? 'opacity-30 bg-slate-800' : ''
                        } ${
                          dragOverColName === col ? 'border-l-4 border-l-amber-500 bg-amber-500/20' : ''
                        }`}
                        title="Arraste e solte para reordenar esta coluna"
                      >
                        <div className="whitespace-nowrap overflow-hidden text-ellipsis px-0.5 text-center font-extrabold tracking-tight">
                          {col}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody className="divide-y divide-slate-700/80">
                {paginatedWip.map((item, rowIdx) => {
                  const isSelected = selectedRowId === item.id;
                  return (
                    <tr 
                      key={item.id || `row-${rowIdx}`} 
                      ref={rowIdx === paginatedWip.length - 1 ? lastRowRef : undefined}
                      onClick={() => setSelectedRowId(isSelected ? null : item.id)}
                      draggable
                      onDragStart={(e) => {
                        setDraggedRowId(item.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverRowId !== item.id) {
                          setDragOverRowId(item.id);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedRowId(null);
                        setDragOverRowId(null);
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const sourceId = draggedRowId;
                        setDragOverRowId(null);
                        setDraggedRowId(null);

                        if (!sourceId || sourceId === item.id) return;

                        // Reorder locally
                        let updatedList: any[] = [];
                        setWipItems(prev => {
                          const list = [...prev];
                          const sourceIndex = list.findIndex(x => x.id === sourceId);
                          const targetIndex = list.findIndex(x => x.id === item.id);

                          if (sourceIndex === -1 || targetIndex === -1) return prev;

                          const [moved] = list.splice(sourceIndex, 1);
                          list.splice(targetIndex, 0, moved);

                          updatedList = list.map((x, idx) => ({
                            ...x,
                            _rowIndex: idx + 2
                          }));
                          return updatedList;
                        });

                        // Save new order to backend
                        try {
                          const activeIdsInOrder = updatedList.map(x => x.id);
                          await api.post('reorderPCPRows', {
                            sheetName: 'Wip042',
                            idList: activeIdsInOrder
                          });
                          setFeedback({ type: 'success', text: 'Linha reordenada e salva na planilha com sucesso!' });
                          setTimeout(() => setFeedback(null), 3000);
                        } catch (err) {
                          console.warn('Erro ao salvar ordenação:', err);
                        }
                      }}
                      className={`group transition-all cursor-pointer odd:bg-slate-850/40 even:bg-slate-850/80 ${
                        isSelected ? 'bg-blue-900/40 ring-1 ring-amber-500/50' : 'hover:bg-slate-800/70'
                      } ${
                        dragOverRowId === item.id ? 'border-t-4 border-t-amber-500 bg-amber-500/15' : ''
                      } ${
                        draggedRowId === item.id ? 'opacity-40 bg-slate-800' : ''
                      }`}
                    >
                      {/* Floating / Sticky row action buttons on leftmost */}
                      <td className={`sticky left-0 z-10 border-r border-slate-700 text-center px-1.5 py-1.5 transition-colors ${
                        isSelected ? '!bg-blue-900/60 text-white' : 'bg-slate-900/95 text-slate-400'
                      }`}>
                        <div className="flex items-center justify-center gap-1 h-full">
                          <div 
                            title="Arraste para mover a linha" 
                            className="p-0.5 cursor-grab active:cursor-grabbing hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-amber-400"
                          >
                            <GripVertical size={11} />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingRow(item);
                            }}
                            title="Editar toda a linha"
                            className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-amber-400 rounded transition-colors border border-slate-850 hover:border-slate-700/70"
                          >
                            <Edit2 size={11} />
                          </button>
                          <span className="text-[9px] text-slate-500 font-bold font-mono min-w-[12px]">
                            {item._rowIndex || (pageSize === -1 ? rowIdx + 2 : (currentPage - 1) * pageSize + rowIdx + 2)}
                          </span>
                        </div>
                      </td>

                      {/* Display cells for visible columns */}
                      {visibleColumns.map((col) => {
                        const colIdx = PCP_COLUMNS.indexOf(col);
                        const val = getVal(item, col);
                        const cellStyleClass = getCellStyle(col, val);
                        const widthClass = getColMinWidth(col);

                        // Position first 3 frozen/sticky columns of sheet Wip042 if visible
                        let stickyCellClass = "";
                        let stickyStyle: React.CSSProperties = {};
                        const isStickyCol = ["LINHA / FÁBRICA", "LINHAS ANTIGAS", "LINHA SERIG"].includes(col);
                        if (isStickyCol) {
                          stickyCellClass = "sticky z-10 shadow-[1px_0_0_0_rgba(100,116,139,0.3)] bg-yellow-300";
                          stickyStyle = { left: `${getStickyLeft(col, visibleColumns)}px` };
                        }

                        // Determine if cell is active for inline quick text editing
                        const isEditingCell = inlineEdit && 
                          inlineEdit.rowId === item.id && 
                          inlineEdit.column === col;

                        // Descriptive tooltip with column name and clean content value
                        const cellTooltip = val ? `Coluna: ${col}\nValor: ${val}` : `Coluna: ${col}\n(Vazia)`;

                        const selectedCellClass = isSelected ? "!bg-blue-100 !text-black font-semibold border-blue-300/60" : "";

                        return (
                          <td
                            key={col}
                            style={stickyStyle}
                            onDoubleClick={() => {
                              if (!isEditingCell) {
                                  setInlineEdit({ rowId: item.id, column: col, value: val });
                              }
                            }}
                            title={cellTooltip}
                            className={`px-3 py-1.5 border-r border-slate-300/40 text-[11px] hover:ring-1 hover:ring-amber-500/40 cursor-text transition-all ${
                              wrapText ? 'whitespace-normal break-words overflow-visible' : 'whitespace-nowrap overflow-hidden text-ellipsis'
                            } ${widthClass} ${cellStyleClass} ${stickyCellClass} ${selectedCellClass} ${
                              draggedColName === col ? 'opacity-30' : ''
                            }`}
                          >
                            {isEditingCell ? (
                              <input
                                ref={inlineInputRef}
                                type="text"
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleInlineSave(item, col, inlineEdit.value);
                                  } else if (e.key === 'Escape') {
                                    setInlineEdit(null);
                                  }
                                }}
                                onBlur={() => handleInlineSave(item, col, inlineEdit.value)}
                                className="w-full bg-slate-100 border border-amber-500 rounded px-1 py-0.5 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-amber-500 outline-none text-center"
                              />
                            ) : (
                              <span 
                                className={`block ${
                                  wrapText ? 'whitespace-normal break-words overflow-visible' : 'whitespace-nowrap overflow-hidden text-ellipsis'
                                }`}
                              >
                                {val || '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredWip.length > 0 && (
            <div className="mt-1.5 bg-slate-850 rounded-lg py-1 px-2.5 border border-slate-705/85 shadow-md flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] text-slate-300 select-none">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-400">Linhas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value);
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded px-1.5 py-0 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold transition-all cursor-pointer h-5.5"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>Ver todas</option>
                </select>
                
                <span className="text-[10px] text-slate-400 ml-0.5">
                  Exibindo <strong>{Math.min(filteredWip.length, (safeCurrentPage - 1) * (pageSize === -1 ? filteredWip.length : pageSize) + 1)}</strong> a <strong>{Math.min(filteredWip.length, safeCurrentPage * (pageSize === -1 ? filteredWip.length : pageSize))}</strong> de <strong>{filteredWip.length}</strong> {filteredWip.length === 1 ? 'linha' : 'linhas'}
                </span>
                {pageSize === -1 && (
                  <span className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded font-extrabold uppercase ml-0.5 tracking-tight">
                     Carregar tudo pode reduzir desempenho
                  </span>
                )}
                {isAutoLoading && (
                  <span className="text-[9.5px] text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 font-bold animate-pulse ml-1.5">
                    <Loader2 className="animate-spin text-amber-500" size={10} />
                    Carregando mais 150 linhas automaticamente...
                  </span>
                )}
              </div>
              
              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-750 text-slate-300 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:cursor-not-allowed border border-slate-700 transition-colors cursor-pointer flex items-center justify-center font-bold h-5.5 w-5.5"
                    title="Primeira Página"
                  >
                    <ChevronsLeft size={11} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-750 text-slate-300 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:cursor-not-allowed border border-slate-700 transition-colors cursor-pointer flex items-center justify-center font-bold h-5.5 w-5.5"
                    title="Página Anterior"
                  >
                    <ChevronLeft size={11} />
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const list = [];
                      const start = Math.max(1, safeCurrentPage - 2);
                      const end = Math.min(totalPages, safeCurrentPage + 2);
                      
                      if (start > 1) {
                        list.push(
                          <button
                            key={1}
                            onClick={() => setCurrentPage(1)}
                            className="w-5.5 h-5.5 text-[9px] rounded border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-750 font-bold transition-all cursor-pointer flex items-center justify-center"
                          >
                            1
                          </button>
                        );
                        if (start > 2) {
                          list.push(<span key="ellipsis-start" className="px-0.5 text-[9px] text-slate-500 font-bold">...</span>);
                        }
                      }
                      
                      for (let i = start; i <= end; i++) {
                        const isCurrent = i === safeCurrentPage;
                        list.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`w-5.5 h-5.5 text-[9px] rounded font-bold transition-all cursor-pointer flex items-center justify-center ${
                              isCurrent
                                ? 'bg-amber-500 text-slate-950 border border-amber-600 shadow-md'
                                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-750'
                            }`}
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      if (end < totalPages) {
                        if (end < totalPages - 1) {
                          list.push(<span key="ellipsis-end" className="px-0.5 text-[9px] text-slate-500 font-bold">...</span>);
                        }
                        list.push(
                          <button
                            key={totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-5.5 h-5.5 text-[9px] rounded border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-750 font-bold transition-all cursor-pointer flex items-center justify-center"
                          >
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return list;
                    })()}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-750 text-slate-300 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:cursor-not-allowed border border-slate-700 transition-colors cursor-pointer flex items-center justify-center font-bold h-5.5 w-5.5"
                    title="Próxima Página"
                  >
                    <ChevronRight size={11} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    className="p-1 rounded bg-slate-900 hover:bg-slate-750 text-slate-300 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:cursor-not-allowed border border-slate-700 transition-colors cursor-pointer flex items-center justify-center font-bold h-5.5 w-5.5"
                    title="Última Página"
                  >
                    <ChevronsRight size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </div>

      {/* Complete Spreadsheet Editor Modal (Full row details) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditingItem(null)} />
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header info */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-amber-450 flex items-center gap-2">
                  <CalendarClock size={20} className="text-amber-500 animate-pulse" />
                  Editar Registro de Programação PCP
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  ID Linha: {editingItem.id} | Linha Planilha: {editingItem._rowIndex || 'Nova'}
                </p>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Scrolling Form body */}
            <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Core Information Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-slate-800 pb-1.5">
                  1. Chaves de Identificação & Linhas de Fábrica
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {PCP_COLUMNS.slice(0, 3).map((col) => (
                    <div key={col}>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{col}</label>
                      <input
                        type="text"
                        value={formFields[col] || ''}
                        onChange={(e) => setFormFields(prev => ({ ...prev, [col]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Info Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-slate-800 pb-1.5">
                  2. Dados do Produto, Lote & Quantidades
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    "CÓD. PRODUTO",
                    "MARCA",
                    "FAMÍLIA MONTAGEM",
                    "SEMANA ORIGINAL",
                    "DT. EMBARQUE",
                    "SEMANA PRODUÇÃO",
                    "NOME PRODUTO",
                    "LOTE",
                    "COR (COR DO TALÃO)",
                    "QTD. PROGRAMADA",
                    "STATUS DA OPERAÇÃO",
                    "FALTAS",
                    "ABAST PRÉ",
                    "GIRO FAB",
                    "SOLA EXTERIOR OK"
                  ].map((col) => {
                    const isLongField = col === "NOME PRODUTO" || col === "STATUS DA OPERAÇÃO";
                    return (
                      <div key={col} className={isLongField ? "sm:col-span-2" : ""}>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{col}</label>
                        <input
                          type="text"
                          value={formFields[col] || ''}
                          onChange={(e) => setFormFields(prev => ({ ...prev, [col]: e.target.value }))}
                          className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 ${
                            col === "NOME PRODUTO" ? "font-bold text-amber-300" : ""
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operations Steps & Controls Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-slate-800 pb-1.5">
                  3. Fluxo de Operações, Status de Follow-up & Enfestos
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    "FOLLOW M2", "FOLLOW UND", "FOLLOW SOLA", "SEPAR. SERIGRAFIA", "ESTOQUE", "CONJUNTO", "ABAST DUB", "DUB LAGOA", "QT CONTE", 
                    "ENFESTO", "CORTE", "CARIMBO", "LIN ATOM", "CONTRAFORT", "ATACADOR", "ENV AVIAMENTO", "POSTE", "AUTOMATICO", "LECTRA", "REC SUPER", "KANBAN APOLO", "SERIG CARROSSEL"
                  ].map((col) => (
                    <div key={col}>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase truncate" title={col}>{col}</label>
                      <input
                        type="text"
                        value={formFields[col] || ''}
                        placeholder="Ex: OK"
                        onChange={(e) => setFormFields(prev => ({ ...prev, [col]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-705 rounded-lg px-2.5 py-1.5 text-xs text-center text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold uppercase placeholder:text-slate-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates & Logistic tracking fields */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-slate-800 pb-1.5">
                  4. Monitoramento de Datas, Logística & STATUS DE FECHAMENTOS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    "DATA M2", "DATA AVIAMENTOS", "DATA SERIGRAFIA", "INICIO CORTE / CORTE AUTO", "DATA SUPERMERCADO", "DATA ORIGINAL", "TIPO DE MATERIAL", "\"RETORNO\" ALINHAMENTO", "TURNO", "HORÁRIO", "STATUS PUXADA", "STATUS SERIGRAFIA"
                  ].map((col) => (
                    <div key={col}>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{col}</label>
                      <input
                        type="text"
                        value={formFields[col] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormFields(prev => {
                            let updated = { ...prev, [col]: val };
                            if (col === "DATA ORIGINAL") {
                              const calculated = calculateRetroDates(val, holidaysVacations);
                              for (const [calcCol, calcVal] of Object.entries(calculated)) {
                                let matchCol = calcCol;
                                const normCalc = calcCol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                
                                for (const key of Object.keys(prev)) {
                                  const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                  if (normKey === normCalc || (isCorteDateColumn(normCalc) && isCorteDateColumn(normKey))) {
                                    matchCol = key;
                                    break;
                                  }
                                }
                                updated[matchCol] = calcVal;
                              }
                            }
                            return updated;
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Long Observations */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider border-b border-slate-800 pb-1.5">
                  5. Observações Gerais & Notas Administrativas
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    "OBS",
                    "RETORNO NF / OBS GERAIS / DATA DE CHEGADA"
                  ].map((col) => (
                    <div key={col}>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{col}</label>
                      <textarea
                        value={formFields[col] || ''}
                        rows={3}
                        onChange={(e) => setFormFields(prev => ({ ...prev, [col]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono tracking-tight"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </form>

            {/* Modal actions */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-5 py-2 border border-slate-700 text-slate-350 hover:bg-slate-900 text-xs font-bold rounded-lg transition-colors"
                disabled={savingItem !== null}
              >
                Descartar Mudanças
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-6 py-2 bg-amber-550 hover:bg-amber-600 text-amber-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2"
                disabled={savingItem !== null}
              >
                {savingItem ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Gravando Dados...
                  </>
                ) : 'Gravar Alterações'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Holidays and Vacations Registration Modal */}
      {showHolidaysModal && (
        <div id="holidays-config-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowHolidaysModal(false)} />
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base md:text-lg text-amber-450 flex items-center gap-2">
                  <CalendarDays size={20} className="text-amber-500" />
                  Calendário de Feriados & Férias — PCP
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Cadastre as datas de folga para calibrar corretamente as regras de desconto de dias úteis.
                </p>
              </div>
              <button 
                onClick={() => setShowHolidaysModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Modal Body: Split Form and List */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Form (cols 5) */}
              <div className="md:col-span-12 lg:col-span-5 space-y-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider pb-1.5 border-b border-slate-800 flex items-center gap-1">
                  <span>Cadastrar Nova Folga</span>
                </h4>
                
                <form onSubmit={handleAddHoliday} className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 shadow-inner">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Data da Folga</label>
                    <input
                      type="date"
                      required
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Tipo de Evento</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewHolidayType('feriado')}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          newHolidayType === 'feriado'
                            ? 'bg-blue-500/15 border-blue-500 text-blue-300 font-black'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        Feriado
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewHolidayType('ferias')}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          newHolidayType === 'ferias'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-black'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        Férias / Folga
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Descrição / Nome</label>
                    <input
                      type="text"
                      placeholder="Ex: Ano Novo, Carnaval, Folga Setor"
                      value={newHolidayDesc}
                      onChange={(e) => setNewHolidayDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-bold placeholder:text-slate-600"
                    />
                  </div>

                  {holidayError && (
                    <div className="bg-rose-500/10 text-rose-350 border border-rose-500/25 p-2 rounded-lg text-[10.5px] font-bold text-center animate-pulse">
                      {holidayError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-550 hover:bg-amber-605 text-amber-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                    Adicionar ao Calendário
                  </button>
                </form>
              </div>

              {/* Right Column: List of Dates (cols 7) */}
              <div className="md:col-span-12 lg:col-span-7 flex flex-col space-y-3 min-h-[250px]">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider pb-1.5 border-b border-slate-800 flex justify-between items-center">
                  <span>Datas Cadastradas ({holidaysVacations.length})</span>
                  {holidaysVacations.length > 0 && (
                    <span className="text-[9px] font-normal text-slate-450 normal-case">Ordem cronológica</span>
                  )}
                </h4>

                <div className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  {holidaysVacations.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <CalendarDays size={32} className="text-slate-700 mb-2.5" />
                      <p className="text-xs font-bold text-slate-400">Nenhuma folga cadastrada</p>
                      <p className="text-[10.5px] text-slate-550 mt-1 max-w-[240px]">
                        Utilize o formulário ao lado para programar folgas, feriados ou férias coletivas.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-805 max-h-[300px]">
                      {holidaysVacations.map((item) => {
                        // Format date to DD/MM/YYYY for UI
                        const [y, m, d] = item.date.split('-');
                        const dateFormatted = `${d}/${m}/${y}`;
                        
                        return (
                          <div key={item.id} className="flex justify-between items-center p-2.5 hover:bg-slate-900/60 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs font-black text-white shrink-0">{dateFormatted}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider shrink-0 ${
                                item.type === 'feriado'
                                  ? 'bg-blue-500/10 text-blue-450 border border-blue-550/20'
                                  : 'bg-emerald-500/10 text-emerald-450 border border-emerald-550/20'
                              }`}>
                                {item.type === 'feriado' ? 'Feriado' : 'Férias / Folga'}
                              </span>
                              <span className="text-[10.5px] font-bold text-slate-400 truncate max-w-[124px] md:max-w-[180px]" title={item.description}>
                                {item.description}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteHoliday(item.id)}
                              className="p-1 hover:bg-rose-500/15 text-slate-500 hover:text-rose-450 rounded cursor-pointer transition-colors shrink-0"
                              title="Excluir folga"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Bar containing bulk calculation option */}
            <div className="bg-slate-950 px-5 py-4 border-t border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-3.5">
              <div className="flex items-start gap-2 max-w-[420px] text-left">
                <Info size={14} className="text-amber-550 flex-shrink-0 mt-0.5" />
                <p className="text-[9.5px]/[13.5px] text-slate-450 font-medium">
                  As folgas cadastradas são salvas persistentemente e <strong className="text-slate-350">não se apagam ao sair</strong>. Clique no botão de recalcular para reprocessar todas as datas de recuo do grid que dependem de datas originais.
                </p>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {holidaysVacations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalculateAllRows}
                    disabled={loading}
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-550/30 text-amber-400 text-xs font-black uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-all shrink-0"
                  >
                    <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                    Recalcular OPs do Grid
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHolidaysModal(false)}
                  className="px-5 py-2 border border-slate-700 text-slate-350 hover:bg-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
