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
  ExternalLink,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Box,
  Sparkles,
  Menu,
  Plane,
  UploadCloud,
  FileText,
  Eye,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import { jsPDF } from 'jspdf';
import MateriaPrimaPivotTable from './MateriaPrimaPivotTable';
import { savePdfToStorage, getPdfFromStorage } from '@/lib/pdf-store';
import { parsePdfContent } from '@/lib/pdfParser';

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

interface FollowUpProps {
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser?: any;
}

function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10) - 1; // 0-indexed month
      const p2 = parseInt(parts[2], 10);
      if (p2 > 1000) {
        return new Date(p2, p1, p0);
      }
    }
  }
  
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10) - 1;
      const p2 = parseInt(parts[2], 10);
      if (p0 > 1000) {
        return new Date(p0, p1, p2);
      }
    }
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateStr: any): string {
  const d = parseDate(dateStr);
  return d ? d.toLocaleDateString('pt-BR') : '-';
}

function formatSubtractedDate(dateStr: any, days: number): string {
  const d = parseDate(dateStr);
  if (!d) return '-';
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('pt-BR');
}

export default function FollowUp({ isSidebarOpen = true, setIsSidebarOpen, currentUser }: FollowUpProps) {
  // Obter permissões do usuário logado (via prop ou localStorage)
  const userPermissions = useMemo(() => {
    let loggedInUser = currentUser;
    if (!loggedInUser) {
      try {
        const stored = localStorage.getItem('pcp_user');
        if (stored) loggedInUser = JSON.parse(stored);
      } catch (e) {
        console.error('Erro ao ler usuário do localStorage em FollowUp:', e);
      }
    }

    if (!loggedInUser) return null;

    let perms = loggedInUser['Permissões de Tela (Módulos)'] || loggedInUser.permissions;
    let parsed: any = {};
    
    if (typeof perms === 'string' && perms.trim()) {
      try {
        parsed = JSON.parse(perms);
      } catch (e) {
        console.error('Erro ao parsear permissões em FollowUp:', e);
      }
    } else if (perms && typeof perms === 'object') {
      parsed = perms;
    }

    const role = loggedInUser.role || loggedInUser['PAPEL'] || 'User';
    const isAdmin = role === 'Admin';

    return {
      solicitacoes: parsed.followup_solicitacoes !== false,
      materias: parsed.followup_materias !== false,
      awb: parsed.followup_awb !== false,
      awb_novo: parsed.followup_awb_novo !== false,
      awb_acoes: parsed.followup_awb_acoes !== false,
      awb_anexar: parsed.followup_awb_anexar !== false,
      isAdmin
    };
  }, [currentUser]);

  const perms = useMemo(() => {
    return userPermissions || {
      solicitacoes: true,
      materias: true,
      awb: true,
      awb_novo: true,
      awb_acoes: true,
      awb_anexar: true,
      isAdmin: false
    };
  }, [userPermissions]);

  const [isInnerSidebarOpen, setIsInnerSidebarOpen] = useState(true);
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

  // Tab de Navegação Interna ("Follow-up de Solicitações" ou "Matéria-Prima" ou "Follow-Up AWB")
  const [activeTab, setActiveTab] = useState<'solicitacoes' | 'materias' | 'awb'>('solicitacoes');

  // Redirecionamento automático de aba baseada nas permissões
  useEffect(() => {
    if (userPermissions) {
      if (activeTab === 'solicitacoes' && !userPermissions.solicitacoes) {
        if (userPermissions.materias) {
          setActiveTab('materias');
        } else if (userPermissions.awb) {
          setActiveTab('awb');
        }
      } else if (activeTab === 'materias' && !userPermissions.materias) {
        if (userPermissions.solicitacoes) {
          setActiveTab('solicitacoes');
        } else if (userPermissions.awb) {
          setActiveTab('awb');
        }
      } else if (activeTab === 'awb' && !userPermissions.awb) {
        if (userPermissions.solicitacoes) {
          setActiveTab('solicitacoes');
        } else if (userPermissions.materias) {
          setActiveTab('materias');
        }
      }
    }
  }, [userPermissions, activeTab]);

  // --- SUB-TELA MATÉRIA-PRIMA STATES ---
  const [materias, setMateriaisList] = useState<any[]>([]);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [searchMateria, setSearchMateria] = useState('');
  const [materiaStatusFilter, setMateriaStatusFilter] = useState('ALL');
  const [isMateriaModalOpen, setIsMateriaModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState<any | null>(null);

  const [materiaForm, setMateriaForm] = useState({
    Produto: '',
    Descrição: '',
    Quantidade: '',
    Unidade: 'M²',
    Status: 'MPOK',
    Fornecedor: '',
    Almox: 'CENTRAL-A'
  });

  const fetchMaterias = async () => {
    setLoadingMaterias(true);
    try {
      const data = await api.post('getMateriasData');
      if (Array.isArray(data)) {
        const normalized = data.map((item: any, idx: number) => {
          const id = item.id || item.ID || (item.Documento ? `doc_${item.Documento}_${item.Produto || idx}` : '') || `materia-${idx}`;
          return {
            ...item,
            id: String(id)
          };
        });
        setMateriaisList(normalized);
      } else {
        setMateriaisList([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de matérias:', error);
      // Fallback em caso de offline/carregamento sem dados
      setMateriaisList([
        { id: 'm1', Produto: '1012560', Descrição: 'TECIDO K897/4 DUPLA FRONTURA AZUL', Quantidade: '750', Unidade: 'M²', Status: 'MPOK', Fornecedor: 'Textil Dass', Almox: 'CENTRAL-A' },
        { id: 'm2', Produto: '637355', Descrição: 'ETIQUETA DE FABRICACAO LINGUETA ASICS', Quantidade: '100', Unidade: 'UN', Status: 'MPNG', Fornecedor: 'Etibras SA', Almox: 'CENTRAL-B' },
        { id: 'm3', Produto: '627790', Descrição: 'FILME TPU ECOFUSION PRESS STAMPING', Quantidade: '154', Unidade: 'M', Status: 'MP TRÂNSITO', Fornecedor: 'TPU Importadora', Almox: 'DOCK-2' },
        { id: 'm4', Produto: '1355754', Descrição: 'TECIDO KETTEN 1501 BRANCO 09 COMPRE', Quantidade: '230', Unidade: 'M²', Status: 'MPOK', Fornecedor: 'Inylbra Ltda', Almox: 'CENTRAL-A' },
        { id: 'm5', Produto: '1391346', Descrição: 'TECIDO JACQUARD LOCALIZADO AZUL/CYAN', Quantidade: '0', Unidade: 'M²', Status: 'CRÍTICO', Fornecedor: 'Fitas Dass', Almox: 'SETOR-PCP' }
      ]);
    } finally {
      setLoadingMaterias(false);
    }
  };

  // --- SUB-TELA FOLLOW-UP AWB STATES ---
  const [awbList, setAwbList] = useState<any[]>([]);
  const [loadingAwb, setLoadingAwb] = useState(false);
  const [searchAwb, setSearchAwb] = useState('');
  const [awbStatusFilter, setAwbStatusFilter] = useState('ALL');
  const [isAwbModalOpen, setIsAwbModalOpen] = useState(false);
  const [editingAwb, setEditingAwb] = useState<any | null>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedTrackingAwb, setSelectedTrackingAwb] = useState<any | null>(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [selectedDocsAwb, setSelectedDocsAwb] = useState<any | null>(null);
  const [previewedDocName, setPreviewedDocName] = useState<string | null>(null);

  const closeDocsModal = () => {
    setDocsModalOpen(false);
    setPreviewedDocName(null);
  };

  useEffect(() => {
    if (previewedDocName && !uploadedFilesCache[previewedDocName]) {
      // 1. Tenta obter o PDF do FileBinaries compartilhado do registro da AWB
      if (selectedDocsAwb && selectedDocsAwb.FileBinaries && selectedDocsAwb.FileBinaries[previewedDocName]) {
        const content = selectedDocsAwb.FileBinaries[previewedDocName];
        setUploadedFilesCache(prev => ({
          ...prev,
          [previewedDocName]: content
        }));
        // Opcional: salva no IndexedDB local também para performance futura
        savePdfToStorage(previewedDocName, content);
      } else {
        // 2. Fallback para o IndexedDB local
        getPdfFromStorage(previewedDocName).then(content => {
          if (content) {
            setUploadedFilesCache(prev => ({
              ...prev,
              [previewedDocName]: content
            }));
          }
        });
      }
    }
  }, [previewedDocName, selectedDocsAwb]);

  const [uploadedFilesCache, setUploadedFilesCache] = useState<Record<string, string>>({});
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [onTheFlyParsedInfo, setOnTheFlyParsedInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    if (previewedDocName && uploadedFilesCache[previewedDocName] && !onTheFlyParsedInfo[previewedDocName]) {
      parsePdfContent(uploadedFilesCache[previewedDocName], previewedDocName).then(parsed => {
        setOnTheFlyParsedInfo(prev => ({
          ...prev,
          [previewedDocName]: parsed
        }));
      });
    }
  }, [previewedDocName, uploadedFilesCache, onTheFlyParsedInfo]);

  // Permite ler arquivos PDF selecionados e adicionar seus nomes a DocList
  const handlePdfUpload = (files: FileList | null, isFromAwbModal: boolean = false) => {
    if (!files) return;
    const newFileNames: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        newFileNames.push(file.name);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setUploadedFilesCache(prev => ({
            ...prev,
            [file.name]: content
          }));
          // Persiste o PDF original no IndexedDB do navegador
          savePdfToStorage(file.name, content);

          // Extrai os dados originais do PDF em segundo plano
          parsePdfContent(content, file.name).then((parsedData) => {
            console.log("PDF parsed details:", parsedData);
            
            // Salva no cache local para uso imediato
            setOnTheFlyParsedInfo(prev => ({
              ...prev,
              [file.name]: parsedData
            }));

            // Armazena no payload de envio da AWB para sincronizar com outros usuários
            if (isFromAwbModal) {
              setAwbForm(prev => {
                // Auto-preenche apenas campos que estejam vazios ou padrão
                const updatedForm = {
                  ...prev,
                  Fornecedor: prev.Fornecedor || parsedData.Fornecedor,
                  NFs: prev.NFs || parsedData.NumeroNF,
                  Awb: prev.Awb || parsedData.Awb,
                  Material: prev.Material || parsedData.Material,
                  Saida: prev.Saida || parsedData.DataSaida,
                  Transportadora: parsedData.Transportadora || prev.Transportadora,
                  Observacao: prev.Observacao ? `${prev.Observacao}\n${parsedData.Observacao}` : parsedData.Observacao,
                  FileBinaries: {
                    ...(prev.FileBinaries || {}),
                    [file.name]: content
                  },
                  FileBinariesInfo: {
                    ...(prev.FileBinariesInfo || {}),
                    [file.name]: parsedData
                  }
                };
                return updatedForm;
              });
            } else if (selectedDocsAwb) {
              setSelectedDocsAwb((prev: any) => {
                if (!prev) return prev;
                const updatedBinaries = {
                  ...(prev.FileBinaries || {}),
                  [file.name]: content
                };
                
                const updatedFileBinariesInfo = {
                  ...(prev.FileBinariesInfo || {}),
                  [file.name]: parsedData
                };

                const updatedDocs = Array.isArray(prev.DocList)
                  ? (prev.DocList.includes(file.name) ? prev.DocList : [...prev.DocList, file.name])
                  : [file.name];
                
                const updatedPayload = {
                  ...prev,
                  Fornecedor: prev.Fornecedor || parsedData.Fornecedor,
                  NFs: prev.NFs || parsedData.NumeroNF,
                  Awb: prev.Awb || parsedData.Awb,
                  Material: prev.Material || parsedData.Material,
                  DocList: updatedDocs,
                  Docs: updatedDocs.length,
                  FileBinaries: updatedBinaries,
                  FileBinariesInfo: updatedFileBinariesInfo
                };

                // Envia os dados para a API (com o binário compartilhado) e atualiza estado local
                api.post('saveAwbData', updatedPayload);
                setAwbList((localList: any[]) => localList.map(item => item.id === prev.id ? updatedPayload : item));
                return updatedPayload;
              });
            }
          });
        };
        reader.readAsDataURL(file);
      } else {
        alert('Por favor, selecione apenas arquivos PDF.');
      }
    }

    if (newFileNames.length === 0) return;

    if (isFromAwbModal) {
      setAwbForm(prev => ({
        ...prev,
        DocList: [...(prev.DocList || []), ...newFileNames]
      }));
    }
  };

  const downloadDocument = async (docName: string, awbItem: any) => {
    let cachedDataUrl = uploadedFilesCache[docName];
    if (!cachedDataUrl) {
      // 1. Tenta obter do FileBinaries compartilhado no registro do AWB
      if (awbItem && awbItem.FileBinaries && awbItem.FileBinaries[docName]) {
        cachedDataUrl = awbItem.FileBinaries[docName];
        setUploadedFilesCache(prev => ({
          ...prev,
          [docName]: cachedDataUrl
        }));
      } else {
        // 2. Busca no IndexedDB o PDF original que foi importado
        const content = await getPdfFromStorage(docName);
        if (content) {
          cachedDataUrl = content;
          setUploadedFilesCache(prev => ({
            ...prev,
            [docName]: content
          }));
        }
      }
    }

    if (cachedDataUrl) {
      const link = document.createElement('a');
      link.href = cachedDataUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (docName.toLowerCase().endsWith('.pdf')) {
      const doc = new jsPDF();
      
      let key = '35260243631191000100550020010732631165266879';
      let nfNum = '1073263';
      let supplier = String(awbItem?.Fornecedor || 'BRANYL COM. IND. TEXTIL LTDA.');

      // Tenta obter dados reais do PDF
      const parsedInfo = awbItem?.FileBinariesInfo?.[docName] || onTheFlyParsedInfo[docName];
      if (parsedInfo) {
        if (parsedInfo.ChaveDeAcesso) key = parsedInfo.ChaveDeAcesso;
        if (parsedInfo.NumeroNF) nfNum = parsedInfo.NumeroNF;
        if (parsedInfo.Fornecedor) supplier = parsedInfo.Fornecedor;
      } else {
        const digits = docName.replace(/\D/g, '');
        if (digits.length >= 7) {
          if (digits.length >= 44) {
            key = digits.substring(0, 44);
            nfNum = digits.substring(25, 34).replace(/^0+/, '') || '1073263';
          } else {
            nfNum = digits.substring(0, 7);
          }
        }
      }
      
      const formattedKey = String(key.replace(/(.{4})/g, '$1 ').trim());
      const awb = String(awbItem?.Awb !== undefined && awbItem?.Awb !== null ? awbItem.Awb : 'N/A');
      const marca = String(awbItem?.Marca !== undefined && awbItem?.Marca !== null ? awbItem.Marca : 'N/A');
      const nfs = String(awbItem?.NFs !== undefined && awbItem?.NFs !== null ? awbItem.NFs : 'N/A');
      const transp = String(awbItem?.Transportadora !== undefined && awbItem?.Transportadora !== null ? awbItem.Transportadora : 'N/A');
      
      // Borda Externa da Folha
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(8, 8, 194, 280);
      
      // 1. Recibo de Entrega (topo)
      doc.rect(10, 10, 190, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text("RECEBEMOS DE " + supplier.toUpperCase() + " OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO", 12, 15, { maxWidth: 145 });
      
      doc.setFontSize(7);
      doc.text("DATA DE RECEBIMENTO", 12, 24);
      doc.text("IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", 85, 24);
      
      // Linhas divisórias internas do recibo
      doc.line(10, 20, 160, 20);
      doc.line(80, 20, 80, 32);
      doc.line(160, 10, 160, 32); // coluna NF-e do recibo
      
      doc.setFontSize(10);
      doc.text("NF-e", 172, 15);
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 255);
      doc.text("Nº " + nfNum, 168, 21);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(6.5);
      doc.text("SÉRIE 2 - FL 1/1", 168, 26);
      
      // Separador pontilhado/linha dupla abaixo do recibo
      doc.setLineDashPattern([2, 2], 0);
      doc.line(10, 35, 200, 35);
      doc.setLineDashPattern([], 0); // reset
      
      // 2. Cabeçalho Principal (Emitente, DANFE, Chave de Acesso)
      // Caixa do Emitente
      doc.rect(10, 38, 85, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(supplier.toUpperCase(), 12, 45, { maxWidth: 81 });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text("RUA FLAVIO GIACOMINI, SN - PIPEIRO", 12, 57);
      doc.text("CEP: 13363-160 - CAPIVARI - SP", 12, 62);
      doc.text("FONE: (19) 3492-8400", 12, 67);
      
      // Caixa do DANFE
      doc.rect(95, 38, 45, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("DANFE", 108, 46);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text("Documento Auxiliar da", 103, 51);
      doc.text("Nota Fiscal Eletrônica", 103, 54);
      
      // Entrada/Saída Box
      doc.rect(112, 57, 12, 10);
      doc.setFontSize(5);
      doc.text("0 - Entrada\n1 - Saída", 113, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("1", 116, 65);
      
      doc.setFontSize(9);
      doc.text("Nº " + nfNum, 108, 73);
      doc.setFontSize(7);
      doc.text("SÉRIE 2", 112, 78);
      
      // Caixa do Controle / Chave de Acesso
      doc.rect(140, 38, 60, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text("CHAVE DE ACESSO", 142, 43);
      
      // Código de barras simulado (linhas desenhadas)
      let barX = 142;
      doc.setFillColor(0, 0, 0);
      for (let b = 0; b < 28; b++) {
        const w = (b % 3 === 0) ? 0.8 : 0.4;
        const g = (b % 4 === 0) ? 1.2 : 0.6;
        doc.rect(barX, 45, w, 15, 'F');
        barX += w + g;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(formattedKey, 142, 65, { maxWidth: 56 });
      
      doc.setFontSize(6);
      doc.text("Consulta de autenticidade no portal nacional da NF-e", 142, 73, { maxWidth: 56 });
      doc.text("www.nfe.fazenda.gov.br", 142, 78);
      
      // 3. Informações da Carga, AWB e Transporte
      doc.setFillColor(245, 245, 245);
      doc.rect(10, 86, 190, 6, 'F');
      doc.rect(10, 86, 190, 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text("DADOS DE TRANSPORTE & LOGÍSTICA (AWB)", 12, 90.5);
      
      doc.rect(10, 92, 190, 32);
      // Linhas de grid
      doc.line(10, 100, 200, 100);
      doc.line(10, 108, 200, 108);
      doc.line(10, 116, 200, 116);
      
      // Colunas
      doc.line(55, 92, 55, 124);
      doc.line(110, 92, 110, 124);
      doc.line(155, 92, 155, 124);
      
      doc.setFontSize(6.5);
      // Linha 1
      doc.setFont('helvetica', 'bold'); doc.text("AWB CONTROLE:", 12, 95); doc.setFont('helvetica', 'normal'); doc.text(awb, 12, 98.5);
      doc.setFont('helvetica', 'bold'); doc.text("MARCA / BRAND:", 57, 95); doc.setFont('helvetica', 'normal'); doc.text(marca, 57, 98.5);
      doc.setFont('helvetica', 'bold'); doc.text("TRANSPORTADORA:", 112, 95); doc.setFont('helvetica', 'normal'); doc.text(transp, 112, 98.5);
      doc.setFont('helvetica', 'bold'); doc.text("SITUAÇÃO / STATUS:", 157, 95); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.Status || 'EM TRÂNSITO'), 157, 98.5);
      
      // Linha 2
      doc.setFont('helvetica', 'bold'); doc.text("NOTAS FISCAIS (NFs):", 12, 103); doc.setFont('helvetica', 'normal'); doc.text(nfs, 12, 106.5);
      doc.setFont('helvetica', 'bold'); doc.text("DATA SAÍDA / ENTRADA:", 57, 103); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.Saida || 'N/A'), 57, 106.5);
      doc.setFont('helvetica', 'bold'); doc.text("MATERIAL PRINCIPAL:", 112, 103); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.Material || 'N/A'), 112, 106.5);
      doc.setFont('helvetica', 'bold'); doc.text("RASTREIO LINK:", 157, 103); doc.setFont('helvetica', 'normal'); doc.text(awbItem?.Rastreio ? "Disponível no sistema" : "N/A", 157, 106.5);
      
      // Linha 3
      doc.setFont('helvetica', 'bold'); doc.text("CÓDIGO DE RASTREIO:", 12, 111); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.RastreioCodigo || 'N/A'), 12, 114.5);
      doc.setFont('helvetica', 'bold'); doc.text("QUANTIDADE DE DOCS:", 57, 111); doc.setFont('helvetica', 'normal'); doc.text(String((awbItem?.DocList || []).length), 57, 114.5);
      doc.setFont('helvetica', 'bold'); doc.text("EMISSOR DO REGISTRO:", 112, 111); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.CriadoPor || 'SISTEMA PCP'), 112, 114.5);
      doc.setFont('helvetica', 'bold'); doc.text("DATA DE CADASTRO:", 157, 111); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.CriadoEm || new Date().toLocaleDateString('pt-BR')), 157, 114.5);
      
      // Linha 4
      doc.setFont('helvetica', 'bold'); doc.text("OBSERVAÇÕES DO REGISTRO:", 12, 119); doc.setFont('helvetica', 'normal'); doc.text(String(awbItem?.Observacao || 'Sem observações adicionais.'), 12, 122.5, { maxWidth: 180 });
      
      // 4. Detalhes dos Itens da NF (Tabela Simulada)
      doc.setFillColor(245, 245, 245);
      doc.rect(10, 131, 190, 6, 'F');
      doc.rect(10, 131, 190, 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text("DADOS DOS PRODUTOS / SERVIÇOS CONSTANTES NA DANFE", 12, 135.5);
      
      // Tabela de itens
      doc.rect(10, 137, 190, 45);
      // Linha cabeçalho tabela
      doc.setFillColor(250, 250, 250);
      doc.rect(10, 137, 190, 6, 'F');
      doc.rect(10, 137, 190, 6);
      
      // Colunas da tabela
      doc.line(30, 137, 30, 182);
      doc.line(110, 137, 110, 182);
      doc.line(125, 137, 125, 182);
      doc.line(138, 137, 138, 182);
      doc.line(155, 137, 155, 182);
      doc.line(175, 137, 175, 182);
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text("CÓD. PROD.", 12, 141);
      doc.text("DESCRIÇÃO DO PRODUTO / SERVIÇO", 32, 141);
      doc.text("NCM", 112, 141);
      doc.text("CST", 127, 141);
      doc.text("CFOP", 140, 141);
      doc.text("UNID.", 157, 141);
      doc.text("QUANT.", 177, 141);
      
      // Dados da linha 1
      doc.setFont('helvetica', 'normal');
      doc.text("000135575", 12, 148);
      doc.text(String(awbItem?.Material || "TECIDO SINTETICO DE REPOSICAO PREMIUM DASS").toUpperCase(), 32, 148, { maxWidth: 76 });
      doc.text("54075210", 112, 148);
      doc.text("000", 127, 148);
      doc.text("5101", 140, 148);
      doc.text("M²", 157, 148);
      doc.text("230.000", 177, 148);
      
      // Rodapé institucional
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text("Este é um Documento Auxiliar gerado automaticamente pelo Sistema de Gestão PCP Grupo Dass.", 15, 275);
      doc.setTextColor(0, 0, 0);
      
      doc.save(docName);
    } else {
      const fileContent = `CONTEÚDO DO DOCUMENTO: ${docName}\nAWB: ${awbItem?.Awb || 'N/A'}\nMARCA: ${awbItem?.Marca || 'N/A'}\nFORNECEDOR: ${awbItem?.Fornecedor || 'N/A'}\nNFs: ${awbItem?.NFs || 'N/A'}`;
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docName.endsWith('.pdf') ? docName.replace('.pdf', '_info.txt') : docName + '_info.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const [awbForm, setAwbForm] = useState({
    Marca: 'UMBRO',
    Fornecedor: '',
    Saida: '',
    NFs: '',
    Awb: '',
    Status: 'EM TRÂNSITO',
    Material: '',
    Observacao: '',
    Rastreio: 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO',
    DocList: [] as string[],
    Transportadora: 'LATAM',
    FileBinaries: {} as Record<string, string>,
    FileBinariesInfo: {} as Record<string, any>
  });

  const fetchAwbData = async () => {
    setLoadingAwb(true);
    try {
      const data = await api.post('getAwbData');
      if (Array.isArray(data)) {
        const normalized = data.map((item: any, idx: number) => {
          const id = item.id || item.ID || item.Awb || `awb-${idx}`;
          let rastreio = item.Rastreio || '';
          let transportadora = item.Transportadora;
          
          if (!transportadora) {
            if (rastreio.includes('gollog')) {
              transportadora = 'GOL';
            } else if (rastreio.includes('azullogistica')) {
              transportadora = 'AZUL';
            } else {
              transportadora = 'LATAM';
            }
          }

          if (!rastreio || rastreio.includes('dhl.com')) {
            if (transportadora === 'GOL') rastreio = 'https://servicos.gollog.com.br/app/site/tracking';
            else if (transportadora === 'AZUL') rastreio = 'https://www.azullogistica.com.br/Rastreio';
            else rastreio = 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO';
          }

          return {
            ...item,
            id: String(id),
            Rastreio: rastreio,
            Transportadora: transportadora
          };
        });
        setAwbList(normalized);
      } else {
        setAwbList([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de AWB:', error);
    } finally {
      setLoadingAwb(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'materias') {
      fetchMaterias();
    } else if (activeTab === 'awb') {
      fetchAwbData();
    }
  }, [activeTab]);

  const handleSaveAwb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awbForm.Marca || !awbForm.Awb) {
      alert('Marca e AWB/Tracking são campos obrigatórios.');
      return;
    }

    const payload = {
      ...awbForm,
      id: editingAwb ? editingAwb.id : undefined,
      Docs: awbForm.DocList.length || 1,
    };

    try {
      // Optimistic update for fluid UI responsiveness
      if (editingAwb) {
        setAwbList(prev => prev.map(item => item.id === editingAwb.id ? { ...item, ...payload } : item));
      } else {
        const tempId = 'temp_' + Date.now();
        setAwbList(prev => [{ ...payload, id: tempId }, ...prev]);
      }
      setIsAwbModalOpen(false);

      await api.post('saveAwbData', payload);
      fetchAwbData();
    } catch (error) {
      console.error('Erro ao salvar AWB:', error);
      fetchAwbData();
    }
  };

  const handleDeleteAwb = async (id: string) => {
    if (!confirm('Deseja realmente remover este embarque?')) return;
    try {
      setAwbList(prev => prev.filter(item => item.id !== id));
      await api.post('deleteAwbData', { id });
      fetchAwbData();
    } catch (error) {
      console.error('Erro ao excluir AWB:', error);
      fetchAwbData();
    }
  };

  const openNewAwbModal = () => {
    setEditingAwb(null);
    setAwbForm({
      Marca: 'UMBRO',
      Fornecedor: '',
      Saida: new Date().toISOString().split('T')[0],
      NFs: '',
      Awb: '',
      Status: 'EM TRÂNSITO',
      Material: '',
      Observacao: '',
      Rastreio: 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO',
      DocList: ['Invoice_' + Math.floor(Math.random() * 1000000) + '.pdf', 'Packing_List.pdf'],
      Transportadora: 'LATAM',
      FileBinaries: {},
      FileBinariesInfo: {}
    });
    setIsAwbModalOpen(true);
  };

  const openEditAwbModal = (item: any) => {
    setEditingAwb(item);
    
    let defaultTransportadora = item.Transportadora;
    if (!defaultTransportadora) {
      if (item.Rastreio?.includes('gollog')) {
        defaultTransportadora = 'GOL';
      } else if (item.Rastreio?.includes('azullogistica')) {
        defaultTransportadora = 'AZUL';
      } else {
        defaultTransportadora = 'LATAM';
      }
    }

    let resolvedRastreio = item.Rastreio;
    if (!resolvedRastreio || resolvedRastreio.includes('dhl.com')) {
      if (defaultTransportadora === 'GOL') resolvedRastreio = 'https://servicos.gollog.com.br/app/site/tracking';
      else if (defaultTransportadora === 'AZUL') resolvedRastreio = 'https://www.azullogistica.com.br/Rastreio';
      else resolvedRastreio = 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO';
    }

    setAwbForm({
      Marca: item.Marca || 'UMBRO',
      Fornecedor: item.Fornecedor || '',
      Saida: item.Saida || '',
      NFs: item.NFs || '',
      Awb: item.Awb || '',
      Status: item.Status || 'EM TRÂNSITO',
      Material: item.Material || '',
      Observacao: item.Observacao || '',
      Rastreio: resolvedRastreio,
      DocList: Array.isArray(item.DocList) ? item.DocList : ['Invoice_Anexo.pdf'],
      Transportadora: defaultTransportadora,
      FileBinaries: item.FileBinaries || {},
      FileBinariesInfo: item.FileBinariesInfo || {}
    });
    setIsAwbModalOpen(true);
  };

  const [copiedAwbId, setCopiedAwbId] = useState<string | null>(null);
  const copyAwbToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAwbId(id);
    setTimeout(() => setCopiedAwbId(null), 2000);
  };

  const handleSaveMateria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materiaForm.Produto || !materiaForm.Descrição) {
      alert('Código do produto e Descrição são campos obrigatórios.');
      return;
    }

    const isEditing = !!editingMateria;
    const targetId = isEditing ? editingMateria.id : 'm_' + Date.now();

    const payload = {
      id: targetId,
      Produto: materiaForm.Produto,
      Descrição: materiaForm.Descrição,
      Quantidade: Number(materiaForm.Quantidade || 0),
      Unidade: materiaForm.Unidade,
      Status: materiaForm.Status,
      Fornecedor: materiaForm.Fornecedor,
      Almox: materiaForm.Almox
    };

    try {
      // Sincroniza estado imediato
      setMateriaisList(prev => {
        if (isEditing) {
          return prev.map(m => m.id === targetId ? payload : m);
        } else {
          return [payload, ...prev];
        }
      });
      setIsMateriaModalOpen(false);

      // Salva no backend
      await api.post('saveMateriaData', payload);
    } catch (err) {
      console.error('Erro ao salvar matérias:', err);
    }
  };

  const handleDeleteMateria = async (id: string) => {
    if (!confirm('Deseja realmente remover esta Matéria-Prima?')) return;
    try {
      setMateriaisList(prev => prev.filter(m => m.id !== id));
      await api.post('deleteMateriaData', { id });
    } catch (err) {
      console.error('Erro ao deletar matéria-prima:', err);
    }
  };

  const handleUpdateMateriaObservacao = async (id: string, text: string) => {
    try {
      let updatedItem: any = null;
      setMateriaisList(prev => prev.map(m => {
        if (m.id === id) {
          updatedItem = { ...m, 'Observação': text };
          return updatedItem;
        }
        return m;
      }));

      const stored = localStorage.getItem('pcp_materias_data');
      if (stored) {
        let list = JSON.parse(stored);
        list = list.map((item: any) => {
          if (item.id === id) {
            return { ...item, 'Observação': text };
          }
          return item;
        });
        localStorage.setItem('pcp_materias_data', JSON.stringify(list));
      }

      if (updatedItem) {
        await api.post('saveMateriaData', updatedItem);
      }
    } catch (err) {
      console.error('Erro ao atualizar observação da matéria-prima:', err);
    }
  };

  const openNewMateriaModal = () => {
    setEditingMateria(null);
    setMateriaForm({
      Produto: '',
      Descrição: '',
      Quantidade: '',
      Unidade: 'M²',
      Status: 'MPOK',
      Fornecedor: '',
      Almox: 'CENTRAL-A'
    });
    setIsMateriaModalOpen(true);
  };

  const openEditMateriaModal = (materia: any) => {
    setEditingMateria(materia);
    setMateriaForm({
      Produto: materia.Produto || '',
      Descrição: materia['Descrição'] || materia.Descrição || '',
      Quantidade: String(materia.Quantidade || '0'),
      Unidade: materia.Unidade || 'M²',
      Status: materia.Status || 'MPOK',
      Fornecedor: materia.Fornecedor || '',
      Almox: materia.Almox || 'CENTRAL-A'
    });
    setIsMateriaModalOpen(true);
  };

  const filteredMaterias = useMemo(() => {
    return materias.filter(m => {
      const pCode = String(m.Produto || '').toLowerCase();
      const pDesc = String(m['Descrição'] || m.Descrição || '').toLowerCase();
      const pForn = String(m.Fornecedor || '').toLowerCase();
      const s = searchMateria.toLowerCase();

      const matchesSearch = pCode.includes(s) || pDesc.includes(s) || pForn.includes(s);
      const matchesStatus = materiaStatusFilter === 'ALL' || String(m.Status || '').toUpperCase() === materiaStatusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [materias, searchMateria, materiaStatusFilter]);

  const materiaStats = useMemo(() => {
    const total = materias.length;
    const ok = materias.filter(m => String(m.Status).toUpperCase() === 'MPOK').length;
    const transito = materias.filter(m => String(m.Status).toUpperCase() === 'MP TRÂNSITO' || String(m.Status).toUpperCase() === 'TRANSTIO').length;
    const critico = materias.filter(m => String(m.Status).toUpperCase() === 'CRÍTICO' || String(m.Status).toUpperCase() === 'CRITICO' || String(m.Status).toUpperCase() === 'MPNG' || Number(m.Quantidade || 0) === 0).length;

    return { total, ok, transito, critico };
  }, [materias]);

  const generateMateriasPdf = () => {
    const doc = new jsPDF();
    
    // Header do PDF
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setFillColor(249, 115, 22); // orange-500
    doc.rect(0, 40, 210, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("DASS - INVENTÁRIO DE MATÉRIA-PRIMA", 15, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text("Relatório gerado em tempo real pelo sistema de controle de PCP.", 15, 31);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`ITENS: ${filteredMaterias.length}`, 155, 22);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 155, 31);

    let currentY = 54;
    
    doc.setFillColor(241, 245, 249);
    doc.rect(10, currentY, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    
    doc.text("Código", 12, currentY + 5.5);
    doc.text("Descrição do Material", 35, currentY + 5.5);
    doc.text("Qtd.", 115, currentY + 5.5);
    doc.text("Un.", 130, currentY + 5.5);
    doc.text("Status", 142, currentY + 5.5);
    doc.text("Local (Almox)", 165, currentY + 5.5);
    
    currentY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    filteredMaterias.forEach((item) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
        
        doc.setFillColor(241, 245, 249);
        doc.rect(10, currentY, 190, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        
        doc.text("Código", 12, currentY + 5.5);
        doc.text("Descrição do Material", 35, currentY + 5.5);
        doc.text("Qtd.", 115, currentY + 5.5);
        doc.text("Un.", 130, currentY + 5.5);
        doc.text("Status", 142, currentY + 5.5);
        doc.text("Local (Almox)", 165, currentY + 5.5);
        
        currentY += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(10, currentY, 200, currentY);

      const codigo = String(item.Produto || '');
      const desc = String(item['Descrição'] || item.Descrição || '');
      const qtd = String(item.Quantidade || '0');
      const un = String(item.Unidade || 'M²');
      const status = String(item.Status || 'MPOK');
      const almox = String(item.Almox || '-');

      doc.text(codigo, 12, currentY + 5.5);
      doc.text(desc.substring(0, 48), 35, currentY + 5.5);
      doc.text(qtd, 115, currentY + 5.5);
      doc.text(un, 130, currentY + 5.5);
      doc.text(status, 142, currentY + 5.5);
      doc.text(almox, 165, currentY + 5.5);

      currentY += 8;
    });

    doc.save(`Inventario_Materias_Primas_${new Date().toLocaleDateString('pt-BR')}.pdf`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Usa cache de 20s compartilhado com o Painel
      const data = await dataCache.get('painelData', () => api.post('getPainelData'), 20000);
      const normalized = (data || []).map((order: any, idx: number) => {
        const id = order.id || order.ID || order['Ordem'] || order['ORDEM'] || (order._rowIndex ? `row-${order._rowIndex}` : `idx-${idx}`);
        return {
          ...order,
          id: String(id)
        };
      });
      setOrders(normalized);
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
    doc.text("DASS ITB - SOLICITAÇÃO DE COMPRA", 15, 22);
    
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
    doc.text("GRUPO DASS ITB - FOLLOW-UP", 15, 287);
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
    <div className="flex h-full w-full bg-slate-50 text-slate-850 font-sans" id="follow-up-viewport">
      {/* Inner Screen Sidebar - Desktop */}
      {isInnerSidebarOpen && (
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 flex-shrink-0 print:hidden hidden md:flex shadow-xl" id="inner-followup-sidebar">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="text-orange-500 w-5 h-5 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-orange-500">Módulos Follow-up</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Gestão de Produção & PCP</p>
              </div>
            </div>
            <button
              onClick={() => setIsInnerSidebarOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
              title="Ocultar Menu Lateral"
            >
              <Menu size={16} />
            </button>
          </div>
          <div className="p-4 flex-1 space-y-2">
            {perms.solicitacoes && (
              <button
                onClick={() => setActiveTab('solicitacoes')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'solicitacoes'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity size={18} />
                <span>Follow-up Solicitações</span>
              </button>
            )}
            
            {perms.materias && (
              <button
                onClick={() => setActiveTab('materias')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'materias'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box size={18} />
                <span>Matéria-Prima</span>
              </button>
            )}

            {perms.awb && (
              <button
                onClick={() => setActiveTab('awb')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'awb'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plane size={18} />
                <span>Follow - Up AWB</span>
              </button>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 justify-between">
              <span>Status do Banco</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <span className="text-[10px]">Planilha Conectada</span>
          </div>
        </div>
      )}

      {/* Mobile Top bar for switching screens */}
      <div className="md:hidden border-b border-gray-200 bg-white p-3 gap-2 sticky top-0 z-30 w-full print:hidden flex shrink-0">
        {perms.solicitacoes && (
          <button
            onClick={() => setActiveTab('solicitacoes')}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              activeTab === 'solicitacoes' ? 'bg-orange-600 text-white shadow' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Solicitações
          </button>
        )}
        {perms.materias && (
          <button
            onClick={() => setActiveTab('materias')}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              activeTab === 'materias' ? 'bg-orange-600 text-white shadow' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Matéria-Prima
          </button>
        )}
        {perms.awb && (
          <button
            onClick={() => setActiveTab('awb')}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold cursor-pointer ${
              activeTab === 'awb' ? 'bg-orange-600 text-white shadow' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Follow-Up AWB
          </button>
        )}
      </div>

      {/* Main Screen Panel with active sub-view */}
      <div className="flex-1 overflow-auto bg-gray-50 flex flex-col h-full">
        {activeTab === 'solicitacoes' ? (
          <div className="p-6 h-full bg-gray-50 flex flex-col relative w-full flex-1">
            <div className="max-w-full mx-auto w-full flex-1 flex flex-col">
        
        {/* Cabeçalho de Pesquisa e Filtros */}
        <div className="flex justify-between items-center mb-6" id="follow-up-header">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {!isInnerSidebarOpen && (
              <button
                onClick={() => setIsInnerSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors focus:outline-none flex items-center justify-center cursor-pointer mr-1 shadow-sm active:scale-95"
                title="Visualizar Menu Lateral"
              >
                <Menu size={18} />
              </button>
            )}
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
    </div>
  ) : activeTab === 'materias' ? (
    <div className="p-6 h-full bg-gray-50 flex flex-col relative w-full flex-1 min-h-0" id="materia-prima-viewport">
      {/* Header / Top de Matéria-Prima */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {!isInnerSidebarOpen && (
              <button
                onClick={() => setIsInnerSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors focus:outline-none flex items-center justify-center cursor-pointer mr-1 shadow-sm active:scale-95"
                title="Visualizar Menu Lateral"
              >
                <Menu size={18} />
              </button>
            )}
            <Box className="text-orange-600 w-6 h-6" />
            Matéria-Prima (Inventário & Estoque)
          </h1>
          <p className="text-sm text-gray-500 font-medium">Controle e consulta de disponibilidades físicas integrados do PCP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateMateriasPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold cursor-pointer"
          >
            <FileDown size={18} />
            Exportar PDF
          </button>
          <button
            onClick={openNewMateriaModal}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold cursor-pointer"
          >
            <Plus size={18} />
            Nova Matéria-Prima
          </button>
        </div>
      </div>

      {/* Tabela Dinâmica Pivotada */}
      <MateriaPrimaPivotTable 
        data={materias} 
        onRefresh={fetchMaterias} 
        isLoading={loadingMaterias} 
        onUpdateObservacao={handleUpdateMateriaObservacao}
      />

      {/* Modal de Cadastro/Edição de Matéria-Prima */}
      <AnimatePresence>
        {isMateriaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Box className="text-orange-500" />
                  {editingMateria ? 'Editar Matéria-Prima' : 'Nova Matéria-Prima'}
                </h3>
                <button
                  onClick={() => setIsMateriaModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveMateria} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-550 text-slate-500 uppercase mb-1">Código do Produto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1012560"
                    value={materiaForm.Produto}
                    onChange={(e) => setMateriaForm({ ...materiaForm, Produto: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: TECIDO MESH ESPORTIVO"
                    value={materiaForm.Descrição}
                    onChange={(e) => setMateriaForm({ ...materiaForm, Descrição: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={materiaForm.Quantidade}
                      onChange={(e) => setMateriaForm({ ...materiaForm, Quantidade: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medida</label>
                    <select
                      value={materiaForm.Unidade}
                      onChange={(e) => setMateriaForm({ ...materiaForm, Unidade: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer text-gray-700"
                    >
                      <option value="M²">M²</option>
                      <option value="M">M</option>
                      <option value="UN">UN</option>
                      <option value="PAR">PAR</option>
                      <option value="KG">KG</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={materiaForm.Status}
                      onChange={(e) => setMateriaForm({ ...materiaForm, Status: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer text-gray-700"
                    >
                      <option value="MPOK">MPOK</option>
                      <option value="MP TRÂNSITO">MP TRÂNSITO</option>
                      <option value="MPNG">MPNG</option>
                      <option value="CRÍTICO">CRÍTICO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Almoxarifado</label>
                    <input
                      type="text"
                      placeholder="Ex: CENTRAL-A"
                      value={materiaForm.Almox}
                      onChange={(e) => setMateriaForm({ ...materiaForm, Almox: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
                  <input
                    type="text"
                    placeholder="Ex: Textil Dass Ltda"
                    value={materiaForm.Fornecedor}
                    onChange={(e) => setMateriaForm({ ...materiaForm, Fornecedor: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => setIsMateriaModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  ) : (
    <div className="p-6 h-full bg-gray-50 flex flex-col relative w-full flex-1" id="awb-viewport">
      {/* Header / Top de AWB */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {!isInnerSidebarOpen && (
              <button
                onClick={() => setIsInnerSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors focus:outline-none flex items-center justify-center cursor-pointer mr-1 shadow-sm active:scale-95"
                title="Visualizar Menu Lateral"
              >
                <Menu size={18} />
              </button>
            )}
            <Plane className="text-blue-600 w-6 h-6 animate-pulse" />
            Follow-Up AWB (Controle de Cargas)
          </h1>
          <p className="text-sm text-gray-500 font-medium">Monitoramento em tempo real de embarques aéreos de matérias-primas e lotes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const doc = new jsPDF();
              doc.setFillColor(15, 23, 42); // slate-900
              doc.rect(0, 0, 210, 42, 'F');
              doc.setFillColor(59, 130, 246); // blue-500
              doc.rect(0, 40, 210, 2, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(20);
              doc.text("RELATÓRIO DE FOLLOW-UP AWB", 15, 22);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.text("Embarques aéreos de insumos e matérias-primas.", 15, 31);
              doc.text(`GERADO EM: ${new Date().toLocaleDateString('pt-BR')}`, 140, 22);
              
              let currentY = 54;
              doc.setFillColor(241, 245, 249);
              doc.rect(10, currentY, 190, 8, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(15, 23, 42);
              doc.text("Marca", 12, currentY + 5.5);
              doc.text("Fornecedor", 42, currentY + 5.5);
              doc.text("Awb/Tracking", 85, currentY + 5.5);
              doc.text("Material", 130, currentY + 5.5);
              doc.text("Status", 175, currentY + 5.5);
              
              currentY += 8;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(51, 65, 85);
              
              awbList.forEach((item) => {
                if (currentY > 270) {
                  doc.addPage();
                  currentY = 20;
                }
                doc.setDrawColor(226, 232, 240);
                doc.line(10, currentY, 200, currentY);
                doc.text(String(item.Marca || ''), 12, currentY + 5.5);
                doc.text(String(item.Fornecedor || '').substring(0, 22), 42, currentY + 5.5);
                doc.text(String(item.Awb || ''), 85, currentY + 5.5);
                doc.text(String(item.Material || '').substring(0, 24), 130, currentY + 5.5);
                doc.text(String(item.Status || ''), 175, currentY + 5.5);
                currentY += 8;
              });
              
              doc.save(`followup_awb_${new Date().toISOString().split('T')[0]}.pdf`);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold cursor-pointer"
          >
            <FileDown size={18} />
            Exportar PDF
          </button>
          {perms.awb_novo && (
            <button
              onClick={openNewAwbModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm text-sm font-bold cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Plus size={18} />
              Novo Embarque
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid de Indicadores de AWB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-100 rounded-lg text-slate-700">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Embarques</p>
            <h3 className="text-2xl font-bold text-slate-800 font-sans">{awbList.length}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-100 rounded-lg text-sky-600">
            <Plane size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Em Trânsito</p>
            <h3 className="text-2xl font-bold text-sky-700 font-sans">{awbList.filter(item => item.Status === 'EM TRÂNSITO').length}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100/40 rounded-lg text-emerald-600">
            <Check size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Disponível Central</p>
            <h3 className="text-2xl font-bold text-emerald-700 font-sans">{awbList.filter(item => item.Status === 'DISPONIVEL' || item.Status === 'DISPONÍVEL').length}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-100 rounded-lg text-rose-600">
            <X size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Aguardando / Crítico</p>
            <h3 className="text-2xl font-bold text-rose-700 font-sans">{awbList.filter(item => item.Status === 'CRÍTICO' || item.Status === 'AGUARDANDO').length}</h3>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-auto flex flex-1 gap-3">
          <div className="bg-gray-50 border border-gray-300 rounded-lg flex items-center px-3 py-2 w-full max-w-md focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por Marca, Fornecedor, NF, Material ou AWB..."
              value={searchAwb}
              onChange={(e) => setSearchAwb(e.target.value)}
              className="bg-transparent border-none outline-none ml-2 text-sm w-full text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="w-full md:w-auto flex gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
            <select
              value={awbStatusFilter}
              onChange={(e) => setAwbStatusFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-gray-700"
            >
              <option value="ALL">Todos os Status</option>
              <option value="EM TRÂNSITO">EM TRÂNSITO</option>
              <option value="DISPONIVEL">DISPONÍVEL</option>
              <option value="AGUARDANDO">AGUARDANDO</option>
              <option value="CRÍTICO">CRÍTICO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Embarques AWB */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-slate-700 text-sm">
                <th className="p-4 font-semibold whitespace-nowrap">Marca</th>
                <th className="p-4 font-semibold whitespace-nowrap">Fornecedor</th>
                <th className="p-4 font-semibold whitespace-nowrap">Saída</th>
                <th className="p-4 font-semibold whitespace-nowrap">NF's</th>
                <th className="p-4 font-semibold whitespace-nowrap">AWB / Tracking</th>
                <th className="p-4 font-semibold whitespace-nowrap">Status</th>
                <th className="p-4 font-semibold whitespace-nowrap text-center">Painel Rastreio</th>
                <th className="p-4 font-semibold whitespace-nowrap">Material</th>
                <th className="p-4 font-semibold whitespace-nowrap">Docs</th>
                {perms.awb_acoes && <th className="p-4 font-semibold whitespace-nowrap text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loadingAwb ? (
                <tr>
                  <td colSpan={perms.awb_acoes ? 10 : 9} className="p-12 text-center text-gray-400">
                    <Loader2 className="animate-spin inline-block mr-2 text-blue-500 w-6 h-6" />
                    Buscando dados de rastreamento...
                  </td>
                </tr>
              ) : awbList.filter(item => {
                const term = searchAwb.trim().toLowerCase();
                const matchSearch = !term || 
                  (item.Marca || '').toLowerCase().includes(term) ||
                  (item.Fornecedor || '').toLowerCase().includes(term) ||
                  (item.Awb || '').toLowerCase().includes(term) ||
                  (item.NFs || '').toLowerCase().includes(term) ||
                  (item.Material || '').toLowerCase().includes(term);
                
                const matchStatus = awbStatusFilter === 'ALL' || item.Status === awbStatusFilter;
                return matchSearch && matchStatus;
              }).length === 0 ? (
                <tr>
                  <td colSpan={perms.awb_acoes ? 10 : 9} className="p-12 text-center text-gray-400 font-semibold text-sm">
                    <Inbox className="mx-auto mb-2 text-gray-300" size={32} />
                    Nenhum embarque AWB correspondente encontrado.
                  </td>
                </tr>
              ) : (
                awbList.filter(item => {
                  const term = searchAwb.trim().toLowerCase();
                  const matchSearch = !term || 
                    (item.Marca || '').toLowerCase().includes(term) ||
                    (item.Fornecedor || '').toLowerCase().includes(term) ||
                    (item.Awb || '').toLowerCase().includes(term) ||
                    (item.NFs || '').toLowerCase().includes(term) ||
                    (item.Material || '').toLowerCase().includes(term);
                  
                  const matchStatus = awbStatusFilter === 'ALL' || item.Status === awbStatusFilter;
                  return matchSearch && matchStatus;
                }).map((item) => {
                  const statusColor = 
                    item.Status === 'DISPONIVEL' || item.Status === 'DISPONÍVEL' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    item.Status === 'EM TRÂNSITO' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    item.Status === 'AGUARDANDO' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                    'bg-red-50 text-red-700 border-red-100';

                  const brandBg = 
                    item.Marca === 'UMBRO' ? 'bg-blue-900/10 text-blue-800 border-blue-200' :
                    item.Marca === 'NIKE' ? 'bg-slate-900 text-white border-slate-900' :
                    item.Marca === 'ADIDAS' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                    item.Marca === 'FILA' ? 'bg-rose-900/10 text-rose-800 border-rose-200' :
                    'bg-gray-100 text-gray-800 border-gray-300';

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-all text-sm font-sans">
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded font-bold text-xs border ${brandBg}`}>
                          {item.Marca}
                        </span>
                      </td>
                      <td className="p-4 text-gray-800 font-medium max-w-[150px] truncate" title={item.Fornecedor}>
                        {item.Fornecedor || '-'}
                      </td>
                      <td className="p-4 text-slate-700 font-semibold text-xs whitespace-nowrap">
                        {item.Saida ? formatDate(item.Saida) : '-'}
                      </td>
                      <td className="p-4 max-w-[120px] truncate">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold font-mono">
                          {item.NFs || '-'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.Awb || '-'}</span>
                          <button
                            onClick={() => copyAwbToClipboard(item.Awb, item.id)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copiar AWB"
                          >
                            {copiedAwbId === item.id ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${statusColor}`}>
                          {item.Status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedTrackingAwb(item);
                            setTrackingModalOpen(true);
                          }}
                          className="px-3 py-1.5 border border-blue-500 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50 transition-all cursor-pointer flex items-center gap-1.5 mx-auto active:scale-95 shadow-sm"
                        >
                          <Plane size={14} className="animate-bounce" />
                          Rastrear
                        </button>
                      </td>
                      <td className="p-4 text-slate-700 max-w-[180px] truncate font-medium" title={item.Material}>
                        {item.Material || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedDocsAwb(item);
                            setDocsModalOpen(true);
                          }}
                          className="text-slate-500 hover:text-blue-600 transition-colors font-semibold flex items-center gap-1 justify-center bg-slate-50 border border-gray-200 px-2.5 py-1 rounded hover:border-blue-200"
                        >
                          <FileDown size={14} />
                          <span className="text-xs">{Array.isArray(item.DocList) ? item.DocList.length : 1}</span>
                        </button>
                      </td>
                      {perms.awb_acoes && (
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => openEditAwbModal(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Editar Embarque"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteAwb(item.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro/Edição de Embarque AWB */}
      <AnimatePresence>
        {isAwbModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plane className="text-blue-500" />
                  {editingAwb ? 'Editar Embarque AWB' : 'Novo Embarque AWB'}
                </h3>
                <button
                  onClick={() => setIsAwbModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAwb} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marca</label>
                    <select
                      value={awbForm.Marca}
                      onChange={(e) => setAwbForm({ ...awbForm, Marca: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-semibold"
                    >
                      <option value="UMBRO">UMBRO</option>
                      <option value="ASICS">ASICS</option>
                      <option value="FILA">FILA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: DHL Importadora"
                      value={awbForm.Fornecedor}
                      onChange={(e) => setAwbForm({ ...awbForm, Fornecedor: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Saída</label>
                    <input
                      type="date"
                      required
                      value={awbForm.Saida}
                      onChange={(e) => setAwbForm({ ...awbForm, Saida: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={awbForm.Status}
                      onChange={(e) => setAwbForm({ ...awbForm, Status: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-semibold"
                    >
                      <option value="EM TRÂNSITO">EM TRÂNSITO</option>
                      <option value="DISPONIVEL">DISPONÍVEL</option>
                      <option value="AGUARDANDO">AGUARDANDO</option>
                      <option value="CRÍTICO">CRÍTICO</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Transportadora</label>
                    <select
                      value={awbForm.Transportadora || 'LATAM'}
                      onChange={(e) => {
                        const val = e.target.value;
                        let trackingUrl = 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO';
                        if (val === 'GOL') {
                          trackingUrl = 'https://servicos.gollog.com.br/app/site/tracking';
                        } else if (val === 'AZUL') {
                          trackingUrl = 'https://www.azullogistica.com.br/Rastreio';
                        }
                        setAwbForm({ 
                          ...awbForm, 
                          Transportadora: val,
                          Rastreio: trackingUrl 
                        });
                      }}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-semibold"
                    >
                      <option value="LATAM">LATAM CARGO</option>
                      <option value="GOL">GOLLOG (GOL)</option>
                      <option value="AZUL">AZUL LOGÍSTICA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">AWB / Air Waybill</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: AWB892-90184"
                      value={awbForm.Awb}
                      onChange={(e) => setAwbForm({ ...awbForm, Awb: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold placeholder-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NFs Vinculadas</label>
                    <input
                      type="text"
                      placeholder="Ex: 89745, 89746"
                      value={awbForm.NFs}
                      onChange={(e) => setAwbForm({ ...awbForm, NFs: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição do Material</label>
                    <input
                      type="text"
                      placeholder="Ex: Palmilhas termomoldadas e solados Asics"
                      value={awbForm.Material}
                      onChange={(e) => setAwbForm({ ...awbForm, Material: e.target.value })}
                      className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                  <textarea
                    placeholder="Informações adicionais..."
                    value={awbForm.Observacao}
                    onChange={(e) => setAwbForm({ ...awbForm, Observacao: e.target.value })}
                    rows={2}
                    className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-medium placeholder-slate-400"
                  />
                </div>

                {/* Upload de PDFs */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Documentos & Anexos (PDF)</label>
                  
                  {/* Lista de Arquivos já anexados no formulário */}
                  {awbForm.DocList && awbForm.DocList.length > 0 && (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar mb-2">
                      {awbForm.DocList.map((docName, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <FileText size={14} className="text-blue-600 shrink-0" />
                            <span className="font-medium text-slate-800 truncate" title={docName}>{docName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAwbForm(prev => ({
                                ...prev,
                                DocList: prev.DocList.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                            title="Remover anexo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(true);
                    }}
                    onDragLeave={() => setIsDraggingPdf(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      handlePdfUpload(e.dataTransfer.files, true);
                    }}
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                      isDraggingPdf 
                        ? 'border-blue-500 bg-blue-50/50 scale-[0.98]' 
                        : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    <label className="cursor-pointer flex flex-col items-center justify-center gap-1">
                      <UploadCloud className={`w-8 h-8 ${isDraggingPdf ? 'text-blue-500 animate-bounce' : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold text-slate-700">
                        {isDraggingPdf ? 'Solte seus PDFs aqui!' : 'Arraste ou clique para enviar PDF'}
                      </span>
                      <span className="text-[10px] text-slate-400">Apenas arquivos .pdf</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => handlePdfUpload(e.target.files, true)}
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => setIsAwbModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Timeline Rastreio Visual */}
      <AnimatePresence>
        {trackingModalOpen && selectedTrackingAwb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-xl w-full overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Plane className="text-blue-500" />
                    Timeline de Rastreamento Aéreo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">AWB: {selectedTrackingAwb.Awb} | Marca: {selectedTrackingAwb.Marca}</p>
                </div>
                <button
                  onClick={() => setTrackingModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                <div className="flex justify-between items-center bg-slate-50 border border-gray-200 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Fornecedor Originário</span>
                    <span className="text-sm font-semibold text-gray-800 block">{selectedTrackingAwb.Fornecedor}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Estágio Atual</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border block mt-1 bg-blue-50 text-blue-700 border-blue-100">
                      {selectedTrackingAwb.Status}
                    </span>
                  </div>
                </div>

                {/* Linha de Progresso Visual Vertical */}
                <div className="relative pl-8 border-l-2 border-dashed border-blue-200 ml-4 space-y-8">
                  {/* Etapa 1 */}
                  <div className="relative">
                    <div className="absolute -left-[41px] top-0.5 bg-emerald-500 text-white p-1 rounded-full border-4 border-white shadow flex items-center justify-center">
                      <Check size={14} className="font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Coleta e Desembaraço Alfandegário na Origem</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Lote coletado e faturado na fábrica. NFs emitidas e validadas pela Receita.</p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        Realizado em: {selectedTrackingAwb.Saida ? new Date(new Date(selectedTrackingAwb.Saida).getTime() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Etapa 2 */}
                  <div className="relative">
                    <div className="absolute -left-[41px] top-0.5 bg-emerald-500 text-white p-1 rounded-full border-4 border-white shadow flex items-center justify-center">
                      <Check size={14} className="font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Encaminhado ao Aeroporto Internacional</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Transferência intermodal do terminal logístico ao aeroporto de origem concluída.</p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        Realizado em: {selectedTrackingAwb.Saida ? new Date(selectedTrackingAwb.Saida).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Etapa 3 */}
                  <div className="relative">
                    <div className={`absolute -left-[41px] top-0.5 p-1 rounded-full border-4 border-white shadow flex items-center justify-center ${
                      selectedTrackingAwb.Status === 'CRÍTICO' || selectedTrackingAwb.Status === 'AGUARDANDO' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                      {selectedTrackingAwb.Status === 'CRÍTICO' || selectedTrackingAwb.Status === 'AGUARDANDO' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Decolagem de Voo Aéreo (AWB Emitido)</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Voo regular de transporte de cargas decolado. Trânsito internacional em andamento.</p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        Status do Voo: {selectedTrackingAwb.Status === 'CRÍTICO' ? 'ATRASADO POR CLIMA' : 'EM ROTA REGULAR'}
                      </span>
                    </div>
                  </div>

                  {/* Etapa 4 */}
                  <div className="relative">
                    <div className={`absolute -left-[41px] top-0.5 p-1 rounded-full border-4 border-white shadow flex items-center justify-center ${
                      selectedTrackingAwb.Status === 'DISPONIVEL' || selectedTrackingAwb.Status === 'DISPONÍVEL' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {selectedTrackingAwb.Status === 'EM TRÂNSITO' ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Check size={14} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Desembaraço de Importação & Alfândega</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Parametrização fiscal e desembaraço de canais de importação.</p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        Estágio: {selectedTrackingAwb.Status === 'DISPONIVEL' || selectedTrackingAwb.Status === 'DISPONÍVEL' ? 'LIBERADO (CANAL VERDE)' : 'AGUARDANDO CHEGADA FÍSICA'}
                      </span>
                    </div>
                  </div>

                  {/* Etapa 5 */}
                  <div className="relative">
                    <div className={`absolute -left-[41px] top-0.5 p-1 rounded-full border-4 border-white shadow flex items-center justify-center ${
                      selectedTrackingAwb.Status === 'DISPONIVEL' || selectedTrackingAwb.Status === 'DISPONÍVEL' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {selectedTrackingAwb.Status === 'DISPONIVEL' || selectedTrackingAwb.Status === 'DISPONÍVEL' ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Entregue na Central de Distribuição Dass</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Estoque auditado, recebido fisicamente e liberado para consumo das marcas no PCP.</p>
                    </div>
                  </div>
                </div>

                {selectedTrackingAwb.Observacao && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs mt-4 italic">
                    <strong>Nota:</strong> {selectedTrackingAwb.Observacao}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-2">
                <a
                  href={selectedTrackingAwb.Rastreio || 'https://www.latamcargo.com/pt/trackshipment?docNumber=&docPrefix=&soType=SO'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  Rastrear via Operador Logístico
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setTrackingModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Gerenciamento de Documentos */}
      <AnimatePresence>
        {docsModalOpen && selectedDocsAwb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-xl shadow-2xl border border-gray-200 w-full overflow-hidden transition-all duration-300 ${
                previewedDocName ? 'max-w-6xl' : 'max-w-md'
              }`}
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileDown className="text-blue-500" />
                    Documentos e Anexos
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">AWB: {selectedDocsAwb.Awb}</p>
                </div>
                <button
                  onClick={closeDocsModal}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                {/* Painel Esquerdo: Lista de Documentos e Upload */}
                <div className={`${previewedDocName ? 'md:col-span-5' : 'md:col-span-12'} p-6 space-y-4 flex flex-col justify-between`}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-500 uppercase block">Anexos Vinculados ({Array.isArray(selectedDocsAwb.DocList) ? selectedDocsAwb.DocList.length : 1})</span>
                      <div className="space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                        {(() => {
                          const docs = Array.isArray(selectedDocsAwb.DocList) ? selectedDocsAwb.DocList : ['Invoice_Carga_Dass_Aerea.pdf', 'Packing_List_Aereo_UMBRO.pdf'];
                          return docs.map((docName: string, idx: number) => (
                            <div 
                              key={idx} 
                              className={`flex justify-between items-center border rounded-lg p-3 transition-colors ${
                                previewedDocName === docName 
                                  ? 'bg-blue-50/50 border-blue-300 shadow-xs' 
                                  : 'bg-slate-50 border-gray-200 hover:bg-slate-100/55'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden mr-2">
                                <FileText size={16} className="text-blue-600 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800 truncate" title={docName}>{docName}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => setPreviewedDocName(docName)}
                                  className="text-emerald-600 hover:text-emerald-700 text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={13} />
                                  Visualizar
                                </button>
                                <span className="text-slate-300 text-[10px]">|</span>
                                <button
                                  onClick={() => downloadDocument(docName, selectedDocsAwb)}
                                  className="text-blue-600 hover:text-blue-500 text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  Download
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {perms.awb_anexar && (
                      <div className="pt-4 border-t border-gray-200 space-y-2">
                        <span className="text-xs font-bold text-slate-500 uppercase block">Anexar Novo Documento (PDF)</span>
                        
                        {/* Drag and Drop Zone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingPdf(true);
                          }}
                          onDragLeave={() => setIsDraggingPdf(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingPdf(false);
                            handlePdfUpload(e.dataTransfer.files, false);
                          }}
                          className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                            isDraggingPdf 
                              ? 'border-blue-500 bg-blue-50/50 scale-[0.98]' 
                              : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <label className="cursor-pointer flex flex-col items-center justify-center gap-1">
                            <UploadCloud className={`w-7 h-7 ${isDraggingPdf ? 'text-blue-500 animate-bounce' : 'text-slate-400'}`} />
                            <span className="text-xs font-semibold text-slate-700">
                              {isDraggingPdf ? 'Solte seus PDFs aqui!' : 'Arraste ou clique para anexar PDF'}
                            </span>
                            <span className="text-[10px] text-slate-400">O arquivo será anexado a este embarque</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => handlePdfUpload(e.target.files, false)}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={closeDocsModal}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {/* Painel Direito: Preview de DANFE */}
                {previewedDocName && (
                  <div className="md:col-span-7 bg-slate-100 flex flex-col h-[650px] overflow-hidden">
                    {/* Header do Painel de Preview */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between shadow-xs">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate">
                        <Eye size={14} className="text-emerald-600 shrink-0" />
                        Pré-visualização da Nota Fiscal Eletrônica (DANFE)
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            const printContent = document.getElementById('danfe-preview-print-area')?.innerHTML;
                            if (printContent) {
                              const win = window.open('', '_blank');
                              if (win) {
                                win.document.write(`
                                  <html>
                                    <head>
                                      <title>DANFE - ${previewedDocName}</title>
                                      <script src="https://cdn.tailwindcss.com"></script>
                                      <style>
                                        @media print {
                                          body { padding: 0; margin: 0; }
                                          .no-print { display: none; }
                                        }
                                      </style>
                                    </head>
                                    <body class="bg-white p-4">
                                      <div class="max-w-[800px] mx-auto text-[10px] text-black">
                                        ${printContent}
                                      </div>
                                      <script>
                                        window.onload = function() {
                                          window.print();
                                        };
                                      </script>
                                    </body>
                                  </html>
                                `);
                                win.document.close();
                              }
                            }
                          }}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 rounded px-2.5 py-1 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Imprimir DANFE"
                        >
                          <Printer size={13} />
                          Imprimir
                        </button>
                        <button
                          onClick={() => setPreviewedDocName(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Área do Documento Scrollável */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-200/60 custom-scrollbar flex justify-center items-start">
                      <div id="danfe-preview-print-area" className="bg-white shadow-xl p-5 border border-gray-300 w-full max-w-[650px] text-[9px] leading-tight text-slate-950 font-sans select-none my-1">
                        {(() => {
                          let key = '35260243631191000100550020010732631165266879';
                          let nfNum = '1073263';
                          let supplier = selectedDocsAwb?.Fornecedor || 'BRANYL COM. IND. TEXTIL LTDA.';

                          // Tenta ler dados extraídos originalmente do arquivo
                          const parsedInfo = selectedDocsAwb?.FileBinariesInfo?.[previewedDocName] || onTheFlyParsedInfo[previewedDocName];
                          
                          if (parsedInfo) {
                            if (parsedInfo.ChaveDeAcesso) key = parsedInfo.ChaveDeAcesso;
                            if (parsedInfo.NumeroNF) nfNum = parsedInfo.NumeroNF;
                            if (parsedInfo.Fornecedor) supplier = parsedInfo.Fornecedor;
                          } else {
                            // Extrair dados da chave e número da NF a partir do nome do arquivo (fallback)
                            const digits = previewedDocName.replace(/\D/g, '');
                            if (digits.length >= 7) {
                              if (digits.length >= 44) {
                                key = digits.substring(0, 44);
                                nfNum = digits.substring(25, 34).replace(/^0+/, '') || '1073263';
                              } else {
                                nfNum = digits.substring(0, 7);
                              }
                            }
                          }
                          
                          const formattedKey = key.replace(/(.{4})/g, '$1 ').trim();

                          return (
                            <div className="space-y-2 text-black font-sans">
                              {/* Recibo de Entrega */}
                              <div className="border border-slate-950 p-1 flex justify-between gap-1">
                                <div className="flex-1 text-[7.5px]">
                                  <span>RECEBEMOS DE <strong>{supplier}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span>
                                  <div className="grid grid-cols-2 gap-2 mt-2 border-t border-slate-950 pt-1">
                                    <div><strong>DATA DE RECEBIMENTO:</strong></div>
                                    <div><strong>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR:</strong></div>
                                  </div>
                                </div>
                                <div className="w-[110px] border-l border-slate-950 pl-2 flex flex-col justify-center items-center text-center">
                                  <span className="font-bold text-xs">NF-e</span>
                                  <span className="font-bold text-[11px] text-blue-700">Nº {nfNum}</span>
                                  <span className="text-[7px]">SÉRIE 2 - FL 1/1</span>
                                </div>
                              </div>

                              {/* Cabeçalho Danfe Principal */}
                              <div className="grid grid-cols-12 border border-slate-950 divide-x divide-slate-950">
                                {/* Emitente */}
                                <div className="col-span-5 p-1.5 flex flex-col justify-between">
                                  <div>
                                    <span className="font-extrabold text-[10px] block leading-none">{supplier}</span>
                                    <span className="text-[6.5px] text-slate-800 uppercase block mt-1 leading-normal font-medium">
                                      RUA FLAVIO GIACOMINI, SN - PIPEIRO<br />
                                      CEP: 13363-160 - CAPIVARI - SP<br />
                                      FONE: (19) 3492-8400
                                    </span>
                                  </div>
                                </div>

                                {/* DANFE Info */}
                                <div className="col-span-3 p-1 flex flex-col items-center justify-center text-center">
                                  <span className="font-extrabold text-[11px]">DANFE</span>
                                  <span className="text-[6px] leading-tight block mt-0.5">Documento Auxiliar da<br />Nota Fiscal Eletrônica</span>
                                  <div className="grid grid-cols-2 border border-slate-950 text-[7px] w-full max-w-[80px] my-1 divide-x divide-slate-950">
                                    <div className="p-0.5">0-Entrada<br />1-Saída</div>
                                    <div className="p-0.5 font-bold flex items-center justify-center text-[10px]">1</div>
                                  </div>
                                  <span className="font-bold text-[10px] text-blue-700">Nº {nfNum}</span>
                                  <span className="font-bold text-[7px]">SÉRIE 2</span>
                                </div>

                                {/* Chave de Acesso */}
                                <div className="col-span-4 p-1.5 flex flex-col justify-between overflow-hidden">
                                  {/* Barcode Simulado */}
                                  <div className="flex h-6 w-full bg-white gap-[1px] items-stretch px-1 py-0.5 border border-gray-300">
                                    {Array.from({ length: 44 }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="bg-black"
                                        style={{
                                          width: `${(i % 3 === 0 ? 2 : (i % 2 === 0 ? 1 : 1.5))}px`,
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <div className="mt-1">
                                    <span className="text-[6px] font-bold block uppercase text-slate-500">CHAVE DE ACESSO</span>
                                    <span className="font-mono font-bold text-[7.5px] break-all block tracking-tight leading-none text-slate-900">{formattedKey}</span>
                                  </div>
                                  <div className="border-t border-slate-950 pt-1 mt-1 text-[6.5px] text-slate-700 text-center font-medium leading-none">
                                    Consulta no portal nacional da NF-e www.nfe.fazenda.gov.br
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )}
</div>

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
                  <div key={`${res.brand}-${index}`} className="bg-slate-50 border border-gray-200 rounded-xl p-5 space-y-4">
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
