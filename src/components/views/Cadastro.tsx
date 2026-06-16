'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Truck, Loader2, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

const InputField = ({
  label,
  value,
  onChange,
  readOnly = false
}: {
  label: string,
  value?: string,
  onChange?: (val: string) => void,
  readOnly?: boolean
}) => (
  <div className="flex border-b border-red-900/20 last:border-0 h-full">
    <div className="w-32 md:w-40 bg-orange-100/50 p-2 md:p-3 text-xs md:text-sm font-bold text-red-900 uppercase flex items-center">
      {label}
    </div>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={readOnly}
      className={`flex-1 p-2 md:p-3 bg-orange-50/30 text-sm md:text-base font-medium text-gray-900 min-h-[36px] md:min-h-[44px] outline-none focus:bg-white/80 transition-colors ${readOnly ? 'cursor-default' : 'cursor-text'}`}
    />
  </div>
);

const SectionHeader = ({ title }: { title: string }) => (
  <div className="w-40 md:w-48 bg-orange-200/60 p-4 text-sm md:text-base font-bold text-red-900 uppercase flex items-center justify-center text-center leading-tight border-r border-red-900/10">
    {title}
  </div>
);

export default function Cadastro() {
  const [loading, setLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [materiais, setMateriais] = useState(
    Array.from({ length: 10 }).map(() => ({
      id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
    }))
  );

  const [formData, setFormData] = useState({
    solicitante: {
      barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
    },
    destinatario: {
      barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
    },
    ordem: {
      pai: '', rep: '', req: '', prioridade: '', marca: '', modelo: '', cor: '', lote: '', tipo: '', dataFecha: '', semana: '', giro: '', construcao: ''
    },
    entrega: {
      barcode: '', nome: '', descCel: '', turno: '', funcao: ''
    }
  });

  const updateField = (section: keyof typeof formData, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const updateMaterial = (index: number, field: string, value: string) => {
    const newMateriais = [...materiais];
    newMateriais[index] = { ...newMateriais[index], [field]: value };
    setMateriais(newMateriais);
  };

  const formatNow = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `(${day}/${month}/${year}, ${hours}:${minutes}:${seconds})`;
  };

  const formatDate = (date: any) => {
    if (!date) return '';

    // Se já for uma string no formato DD/MM/YYYY, retorna ela mesma
    if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return date;
    }

    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
      // Tenta converter string (incluindo ISO) para Date
      d = new Date(date);

      // Se falhar, tenta tratar formatos comuns brasileiros ou americanos
      if (isNaN(d.getTime())) {
        // Tenta DD/MM/YYYY HH:mm:ss ou similar
        const parts = date.split(/[/\s-:]/);
        if (parts.length >= 3) {
          // Assume DD/MM/YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          d = new Date(year, month, day);
        }
      }

      if (isNaN(d.getTime())) {
        return date;
      }
    } else if (typeof date === 'number') {
      // Trata números (excel dates ou timestamps)
      // Se for um número grande, assume timestamp
      if (date > 1000000) {
        d = new Date(date);
      } else {
        // Se for número pequeno, pode ser data serial do Excel (aproximado)
        d = new Date((date - 25569) * 86400 * 1000);
      }
    } else {
      return String(date);
    }

    if (isNaN(d.getTime())) return String(date);

    // Usamos o fuso horário local para exibição amigável, 
    // ou UTC se a data vier com Z ou T
    const isISO = typeof date === 'string' && (date.includes('T') || date.includes('Z'));

    const day = String(isISO ? d.getUTCDate() : d.getDate()).padStart(2, '0');
    const month = String((isISO ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
    const year = isISO ? d.getUTCFullYear() : d.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const handleBuscaCracha = async (tipo: 'solicitante' | 'destinatario' | 'entrega', cracha: string) => {
    if (!cracha) return;
    setLoading(true);
    try {
      const user = await api.post('getUserByCracha', { cracha });
      if (user) {
        setFormData(prev => ({
          ...prev,
          [tipo]: {
            ...prev[tipo],
            nome: user['NOME'] || user['Nome'] || '',
            funcao: user['FUNCAO'] || user['Funcao'] || '',
            setor: user['SETOR'] || user['Setor'] || '',
            descCel: user['CEL_NOME'] || user['Cel_Nome'] || '',
            codCracha: user['CRACHA'] || user['Cracha'] || '',
            predio: user['PRÉDIO'] || user['PREDIO'] || user['Predio'] || user['predio'] || '',
            celula: user['CEL_CODIGO'] || user['Cel_Codigo'] || '',
            turno: user['TUR_CODIGO'] || user['Tur_Codigo'] || ''
          }
        }));
      }
    } catch (e) {
      console.error(e);
      alert(`Crachá não encontrado para ${tipo}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscaOrdem = async (ordem: string) => {
    if (!ordem) return;
    setLoading(true);
    try {
      // Fetch data with fallbacks for missing actions
      let wipData: any[] = [];
      let parametros: any[] = [];

      try {
        wipData = await api.post('getWipData');
      } catch (e) {
        console.warn('Erro ao buscar getWipData:', e);
      }

      try {
        parametros = await api.post('getParametros');
      } catch (e) {
        console.warn('Erro ao buscar getParametros:', e);
      }

      const findOrdem = (row: any) => {
        const o = row['Ordem'] || row['ORDEM'];
        return String(o) === String(ordem);
      };
      const ordemData = Array.isArray(wipData) ? wipData.find(findOrdem) : null;

      if (ordemData) {
        // Lógica para GIRO - O/S
        // Giro = SIM se Qtd a Cortar ou Almox forem 0
        const qtdACortar = Number(String(ordemData['Qtd a Cortar'] || ordemData['QTD A CORTAR'] || '0').replace(',', '.'));
        const almox = Number(String(ordemData['Almox'] || ordemData['ALMOX'] || '0').replace(',', '.'));
        const giro = (qtdACortar === 0 || almox === 0) ? 'SIM' : 'NÃO';

        // Lógica para TIPO (Busca na aba Parâmetros comparando o início do Lote com a coluna TIPO)
        const loteRaw = String(ordemData['Lote'] || ordemData['LOTE'] || ordemData['lote'] || '').trim();

        // Ordenamos os parâmetros pelo tamanho do TIPO (decrescente) para garantir o match mais específico primeiro
        const sortedParams = Array.isArray(parametros)
          ? [...parametros].sort((a, b) => {
            const keyA = String(a['TIPO'] || a['Tipo'] || '').trim();
            const keyB = String(b['TIPO'] || b['Tipo'] || '').trim();
            return keyB.length - keyA.length;
          })
          : [];

        const param = sortedParams.find(p => {
          const key = String(p['TIPO'] || p['Tipo'] || '').trim();
          return key && loteRaw.toUpperCase().startsWith(key.toUpperCase());
        });

        const tipo = param ? (param['Embarque'] || param['EMBARQUE'] || param['embarque'] || '') : '';

        setFormData(prev => ({
          ...prev,
          ordem: {
            ...prev.ordem,
            marca: ordemData['Marca'] || ordemData['MARCA'] || '',
            modelo: ordemData['Nome Produto'] || ordemData['NOME PRODUTO'] || ordemData['Nome_Produto'] || '',
            semana: ordemData['Semana'] || ordemData['SEMANA'] || '',
            cor: ordemData['Cor'] || ordemData['COR'] || '',
            construcao: ordemData['Construcao'] || ordemData['CONSTRUCAO'] || ordemData['Construção'] || ordemData['CONSTRUÇÃO'] || '',
            lote: loteRaw,
            giro: giro,
            tipo: tipo,
            dataFecha: formatDate(ordemData['DATA_EMBARQUE'] || ordemData['Data_Embarque'] || ordemData['Data Embarque'] || '')
          }
        }));
      } else {
        alert('Ordem não encontrada no WIP');
      }
    } catch (e) {
      console.error('Erro geral em handleBuscaOrdem:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscaProduto = async (index: number, produto: string) => {
    if (!produto) return;
    setLoading(true);
    try {
      const material = await api.post('getMaterialByProduto', { produto });
      if (material) {
        const descricao = material['Descrição'] || material['DESCRIÇÃO'] || material['Descricao'] || material['descricao'] || '';
        updateMaterial(index, 'descricao', descricao);
      }
    } catch (e) {
      console.error(e);
      // Opcional: alert(`Produto não encontrado`);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscaEntrega = async (barcode: string) => {
    if (!barcode) return;
    setLoading(true);
    try {
      // Tenta buscar como crachá primeiro (Usuário)
      const user = await api.post('getUserByCracha', { cracha: barcode });
      if (user) {
        setFormData(prev => ({
          ...prev,
          entrega: {
            ...prev.entrega,
            nome: user['NOME'] || user['Nome'] || '',
            descCel: user['CEL_NOME'] || user['Cel_Nome'] || '',
            funcao: user['FUNCAO'] || user['Funcao'] || '',
            turno: user['TUR_CODIGO'] || user['Tur_Codigo'] || ''
          }
        }));
        setLoading(false);
        return;
      }

      // Se não for crachá de usuário, tenta buscar no painel por Ord_Rep ou crachá já registrado
      const painelData = await dataCache.get('painelData', () => api.post('getPainelData'), 15000);
      const row = painelData.find((r: any) =>
        String(r['Ord_Rep']) === String(barcode) ||
        String(r['ORD_REP']) === String(barcode) ||
        String(r['entrega_barcode']) === String(barcode) ||
        String(r['destinatario_cracha']) === String(barcode)
      );

      if (row) {
        setFormData(prev => ({
          ...prev,
          entrega: {
            ...prev.entrega,
            nome: row['entrega_nome'] || row['destinatario_nome'] || row['NOME'] || row['Nome'] || '',
            descCel: row['entrega_descCel'] || row['destinatario_descCel'] || row['DESC.CEL'] || row['Desc.Cel'] || row['CEL_NOME'] || '',
            funcao: row['entrega_funcao'] || row['destinatario_funcao'] || row['FUNÇÃO'] || row['Função'] || row['FUNCAO'] || '',
            turno: row['entrega_turno'] || row['destinatario_turno'] || row['TURNO'] || row['Turno'] || ''
          }
        }));
      } else {
        // Se não encontrou nada, apenas mantém o barcode
        console.log('Nenhum dado encontrado para o barcode informado');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCadastrar = async () => {
    const validMaterials = materiais.filter(m => m.produto || m.descricao);
    if (validMaterials.length === 0) {
      alert('Preencha pelo menos um material para cadastrar.');
      return;
    }

    setLoading(true);
    try {
      // 1. Salva os materiais na aba Painel (status) com todos os dados do cabeçalho
      // Isso evita que os dados fiquem "quebrados" em linhas diferentes (uma para cabeçalho, outras para materiais)
      const rowsToSave = validMaterials.map(m => ({
        id: crypto.randomUUID(),
        // Dados do Solicitante
        solicitante_cracha: formData.solicitante.barcode,
        solicitante_nome: formData.solicitante.nome,
        funçao: formData.solicitante.funcao,
        solicitante_setor: formData.solicitante.setor,
        solicitante_descCel: formData.solicitante.descCel,
        solicitante_codCracha: formData.solicitante.codCracha,
        solicitante_predio: formData.solicitante.predio,
        solicitante_celula: formData.solicitante.celula,
        solicitante_turno: formData.solicitante.turno,

        // Dados do Destinatário
        destinatario_cracha: formData.destinatario.barcode,
        destinatario_nome: formData.destinatario.nome,
        destinatario_funcao: formData.destinatario.funcao,
        destinatario_setor: formData.destinatario.setor,
        destinatario_descCel: formData.destinatario.descCel,
        destinatario_codCracha: formData.destinatario.codCracha,
        destinatario_predio: formData.destinatario.predio,
        destinatario_celula: formData.destinatario.celula,
        destinatario_turno: formData.destinatario.turno,

        // Dados da Ordem (Campos com prefixo ordem_)
        ordem_pai: formData.ordem.pai,
        ordem_prioridade: formData.ordem.prioridade,
        ordem_modelo: formData.ordem.modelo,
        ordem_combinacao: formData.ordem.cor,
        ordem_documento: formData.ordem.lote,
        ordem_tipo: formData.ordem.tipo,
        ordem_dataFecha: formData.ordem.dataFecha,
        ordem_semana: formData.ordem.semana,
        ordem_giro: formData.ordem.giro,

        // Dados de Entrega
        entrega_barcode: formData.entrega.barcode,
        entrega_nome: formData.entrega.nome,
        entrega_descCel: formData.entrega.descCel,
        entrega_turno: formData.entrega.turno,
        entrega_funcao: formData.entrega.funcao,
        entrega_status: 'Pendente',

        // Metadados
        updatedAt: formatNow(),
        timestamp: new Date().toISOString(),

        // Dados dos Materiais (Colunas principais do Painel)
        'Ordem': formData.ordem.pai,
        'Ord_Rep': formData.ordem.rep,
        'N°_Req': formData.ordem.req,
        'Marca': formData.ordem.marca,
        'Produtos': m.produto,
        'Descrição': m.descricao,
        'Qtd.': m.qtd,
        'Medida': m.medida,
        'TAM.': m.tam,
        'Status': m.status,
        'Data_Reg_Central': formatNow(),
        'Data_Ent_Almox.': '',
        'Data_Entrega': '',
        'Data_Ent_Avi': '',
        'Data_Ent_Central': '',
        'Data_ Avali_Follow': '',
        'Observação': '',
        'Setor': formData.destinatario.setor
      }));

      // Salva múltiplos materiais de uma vez, cada um com os dados do cabeçalho
      await api.post('saveMultiplePainelData', rowsToSave);

      alert('Dados cadastrados com sucesso!');

      // Clear form and materials
      setFormData({
        solicitante: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        destinatario: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        ordem: {
          pai: '', rep: '', req: '', prioridade: '', marca: '', modelo: '', cor: '', lote: '', tipo: '', dataFecha: '', semana: '', giro: '', construcao: ''
        },
        entrega: {
          barcode: '', nome: '', descCel: '', turno: '', funcao: ''
        }
      });

      setMateriais(Array.from({ length: 10 }).map(() => ({
        id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
      })));

      setCurrentId(null);

    } catch (error) {
      alert('Erro ao cadastrar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlterar = async () => {
    const validMaterials = materiais.filter(m => (m.produto || m.descricao) && m.id);
    if (validMaterials.length === 0) {
      alert('Pesquise uma ordem e certifique-se de que há materiais para alterar.');
      return;
    }

    setLoading(true);
    try {
      const rowsToUpdate = validMaterials.map(m => ({
        id: m.id,
        // Dados do Solicitante
        solicitante_cracha: formData.solicitante.barcode,
        solicitante_nome: formData.solicitante.nome,
        funçao: formData.solicitante.funcao,
        solicitante_setor: formData.solicitante.setor,
        solicitante_descCel: formData.solicitante.descCel,
        solicitante_codCracha: formData.solicitante.codCracha,
        solicitante_predio: formData.solicitante.predio,
        solicitante_celula: formData.solicitante.celula,
        solicitante_turno: formData.solicitante.turno,

        // Dados do Destinatário
        destinatario_cracha: formData.destinatario.barcode,
        destinatario_nome: formData.destinatario.nome,
        destinatario_funcao: formData.destinatario.funcao,
        destinatario_setor: formData.destinatario.setor,
        destinatario_descCel: formData.destinatario.descCel,
        destinatario_codCracha: formData.destinatario.codCracha,
        destinatario_predio: formData.destinatario.predio,
        destinatario_celula: formData.destinatario.celula,
        destinatario_turno: formData.destinatario.turno,

        // Dados da Ordem
        ordem_pai: formData.ordem.pai,
        ordem_prioridade: formData.ordem.prioridade,
        ordem_modelo: formData.ordem.modelo,
        ordem_combinacao: formData.ordem.cor,
        ordem_documento: formData.ordem.lote,
        ordem_tipo: formData.ordem.tipo,
        ordem_dataFecha: formData.ordem.dataFecha,
        ordem_semana: formData.ordem.semana,
        ordem_giro: formData.ordem.giro,

        // Dados de Entrega
        entrega_barcode: formData.entrega.barcode,
        entrega_nome: formData.entrega.nome,
        entrega_descCel: formData.entrega.descCel,
        entrega_turno: formData.entrega.turno,
        entrega_funcao: formData.entrega.funcao,

        updatedAt: formatNow(),

        // Dados dos Materiais
        'Ordem': formData.ordem.pai,
        'Ord_Rep': formData.ordem.rep,
        'N°_Req': formData.ordem.req,
        'Produtos': m.produto,
        'Descrição': m.descricao,
        'Qtd.': m.qtd,
        'Medida': m.medida,
        'TAM.': m.tam,
        'Status': m.status,
        'Setor': formData.destinatario.setor
      }));

      await api.post('updateMultiplePainelData', rowsToUpdate);
      alert('Dados alterados com sucesso no Painel de Status!');

      // Clear form and materials after update
      setFormData({
        solicitante: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        destinatario: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        ordem: {
          pai: '', rep: '', req: '', prioridade: '', marca: '', modelo: '', cor: '', lote: '', tipo: '', dataFecha: '', semana: '', giro: '', construcao: ''
        },
        entrega: {
          barcode: '', nome: '', descCel: '', turno: '', funcao: ''
        }
      });

      setMateriais(Array.from({ length: 10 }).map(() => ({
        id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
      })));

      setCurrentId(null);
    } catch (error) {
      alert('Erro ao alterar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async () => {
    const validMaterials = materiais.filter(m => (m.produto || m.descricao) && m.id);
    if (validMaterials.length === 0) {
      alert('Pesquise uma ordem e certifique-se de que há materiais para excluir.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir os materiais desta ordem?')) return;

    setLoading(true);
    try {
      const rowsToDelete = validMaterials.map(m => ({ id: m.id }));
      await api.post('deleteMultiplePainelData', rowsToDelete);
      alert('Materiais excluídos com sucesso!');

      // Limpar tabela
      setMateriais(Array.from({ length: 10 }).map(() => ({
        id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
      })));
    } catch (error) {
      alert('Erro ao excluir dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntrega = async () => {
    const validMaterials = materiais.filter(m => m.id);
    if (validMaterials.length === 0) {
      alert('Pesquise uma ordem e certifique-se de que há materiais carregados para entrega.');
      return;
    }

    if (!confirm('Deseja registrar a entrega de todos os materiais desta ordem?')) return;

    setLoading(true);
    try {
      const now = formatNow();
      const rowsToUpdate = validMaterials.map(m => ({
        id: m.id,
        Status: 'ENTREGUE',
        Data_Entrega: now,
        entrega_barcode: formData.entrega.barcode || formData.destinatario.barcode,
        entrega_nome: formData.entrega.nome || formData.destinatario.nome,
        entrega_descCel: formData.entrega.descCel || formData.destinatario.descCel,
        entrega_turno: formData.entrega.turno || formData.destinatario.turno,
        entrega_funcao: formData.entrega.funcao || formData.destinatario.funcao,
        updatedAt: now
      }));

      await api.post('updateMultiplePainelData', rowsToUpdate);
      alert('Entrega registrada com sucesso no Painel de Status!');

      // Limpar formulário após entrega
      setFormData({
        solicitante: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        destinatario: {
          barcode: '', nome: '', funcao: '', setor: '', descCel: '', codCracha: '', predio: '', celula: '', turno: ''
        },
        ordem: {
          pai: '', rep: '', req: '', prioridade: '', marca: '', modelo: '', cor: '', lote: '', tipo: '', dataFecha: '', semana: '', giro: '', construcao: ''
        },
        entrega: {
          barcode: '', nome: '', descCel: '', turno: '', funcao: ''
        }
      });

      setMateriais(Array.from({ length: 10 }).map(() => ({
        id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
      })));

      setCurrentId(null);
    } catch (error) {
      alert('Erro ao registrar entrega');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePesquisar = async () => {
    const ordemPai = formData.ordem.pai;
    const barcodeEntrega = formData.entrega.barcode;

    if (!ordemPai && !barcodeEntrega) {
      alert('Informe a ORDEM PAI ou o CÓD. BARRA ENTREGA para pesquisar.');
      return;
    }

    setLoading(true);
    try {
      const data = await dataCache.get('painelData', () => api.post('getPainelData'), 15000);
      let materiaisEncontrados = [];

      if (barcodeEntrega) {
        // Pesquisa por Crachá do Destinatário ou Barcode de Entrega ou Ord_Rep
        materiaisEncontrados = data.filter((row: any) =>
          String(row['entrega_barcode']) === String(barcodeEntrega) ||
          String(row['destinatario_cracha']) === String(barcodeEntrega) ||
          String(row['Ord_Rep']) === String(barcodeEntrega) ||
          String(row['ORD_REP']) === String(barcodeEntrega)
        );
        setPendingItems(materiaisEncontrados);
      } else {
        // Pesquisa por Ordem Pai
        materiaisEncontrados = data.filter((row: any) => String(row['Ordem']) === String(ordemPai));
        setPendingItems([]);
      }

      if (materiaisEncontrados && materiaisEncontrados.length > 0) {
        // Se pesquisou por Ordem Pai, já carrega direto. 
        // Se pesquisou por crachá, carrega o primeiro mas mantém a lista para seleção.
        const itemsToLoad = barcodeEntrega
          ? materiaisEncontrados.filter((m: any) => String(m['Ordem']) === String(materiaisEncontrados[0]['Ordem']))
          : materiaisEncontrados;

        // Preencher a tabela de materiais
        const novosMateriais = Array.from({ length: 10 }).map((_, i) => {
          if (i < itemsToLoad.length) {
            const mat = itemsToLoad[i];
            return {
              id: mat.id || mat.ID || '',
              produto: mat['Produtos'] || '',
              descricao: mat['Descrição'] || '',
              qtd: mat['Qtd.'] || '',
              medida: mat['Medida'] || '',
              tam: mat['TAM.'] || '',
              status: mat['Status'] || ''
            };
          }
          return { id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: '' };
        });

        setMateriais(novosMateriais);

        // Preencher os dados da ordem e pessoas com o primeiro material encontrado
        const firstMat = itemsToLoad[0];
        setFormData({
          solicitante: {
            barcode: firstMat.solicitante_cracha || '',
            nome: firstMat.solicitante_nome || '',
            funcao: firstMat.funçao || '',
            setor: firstMat.solicitante_setor || '',
            descCel: firstMat.solicitante_descCel || '',
            codCracha: firstMat.solicitante_codCracha || '',
            predio: firstMat.solicitante_predio || '',
            celula: firstMat.solicitante_celula || '',
            turno: firstMat.solicitante_turno || ''
          },
          destinatario: {
            barcode: firstMat.destinatario_cracha || '',
            nome: firstMat.destinatario_nome || '',
            funcao: firstMat.destinatario_funcao || '',
            setor: firstMat.destinatario_setor || '',
            descCel: firstMat.destinatario_descCel || '',
            codCracha: firstMat.destinatario_codCracha || '',
            predio: firstMat.destinatario_predio || '',
            celula: firstMat.destinatario_celula || '',
            turno: firstMat.destinatario_turno || ''
          },
          ordem: {
            pai: firstMat.ordem_pai || firstMat.Ordem || '',
            rep: firstMat.Ord_Rep || '',
            req: firstMat['N°_Req'] || '',
            prioridade: firstMat.ordem_prioridade || '',
            marca: firstMat.Marca || '',
            modelo: firstMat.ordem_modelo || '',
            cor: firstMat.ordem_combinacao || '',
            lote: firstMat.ordem_documento || '',
            tipo: firstMat.ordem_tipo || '',
            dataFecha: firstMat.ordem_dataFecha || '',
            semana: firstMat.ordem_semana || '',
            giro: firstMat.ordem_giro || '',
            construcao: firstMat.ordem_construcao || firstMat.construcao || firstMat.CONSTRUCAO || ''
          },
          entrega: {
            barcode: firstMat.entrega_barcode || '',
            nome: firstMat.entrega_nome || '',
            descCel: firstMat.entrega_descCel || '',
            turno: firstMat.entrega_turno || '',
            funcao: firstMat.entrega_funcao || ''
          }
        });

        if (!barcodeEntrega) {
          alert(`${materiaisEncontrados.length} materiais encontrados para esta ordem.`);
        }
      } else {
        setMateriais(Array.from({ length: 10 }).map(() => ({
          id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: ''
        })));
        setPendingItems([]);
        alert('Nenhum material encontrado.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao pesquisar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPendingItem = (item: any) => {
    setLoading(true);
    try {
      // Quando seleciona um item pendente, carrega todos os materiais da mesma Ordem Pai
      const itemsToLoad = pendingItems.filter((m: any) => String(m['Ordem']) === String(item['Ordem']));

      const novosMateriais = Array.from({ length: 10 }).map((_, i) => {
        if (i < itemsToLoad.length) {
          const mat = itemsToLoad[i];
          return {
            id: mat.id || mat.ID || '',
            produto: mat['Produtos'] || '',
            descricao: mat['Descrição'] || '',
            qtd: mat['Qtd.'] || '',
            medida: mat['Medida'] || '',
            tam: mat['TAM.'] || '',
            status: mat['Status'] || ''
          };
        }
        return { id: '', produto: '', descricao: '', qtd: '', medida: '', tam: '', status: '' };
      });

      setMateriais(novosMateriais);

      setFormData({
        solicitante: {
          barcode: item.solicitante_cracha || '',
          nome: item.solicitante_nome || '',
          funcao: item.funçao || '',
          setor: item.solicitante_setor || '',
          descCel: item.solicitante_descCel || '',
          codCracha: item.solicitante_codCracha || '',
          predio: item.solicitante_predio || '',
          celula: item.solicitante_celula || '',
          turno: item.solicitante_turno || ''
        },
        destinatario: {
          barcode: item.destinatario_cracha || '',
          nome: item.destinatario_nome || '',
          funcao: item.destinatario_funcao || '',
          setor: item.destinatario_setor || '',
          descCel: item.destinatario_descCel || '',
          codCracha: item.destinatario_codCracha || '',
          predio: item.destinatario_predio || '',
          celula: item.destinatario_celula || '',
          turno: item.destinatario_turno || ''
        },
        ordem: {
          pai: item.ordem_pai || item.Ordem || '',
          rep: item.Ord_Rep || '',
          req: item['N°_Req'] || '',
          prioridade: item.ordem_prioridade || '',
          marca: item.Marca || '',
          modelo: item.ordem_modelo || '',
          cor: item.ordem_combinacao || '',
          lote: item.ordem_documento || '',
          tipo: item.ordem_tipo || '',
          dataFecha: item.ordem_dataFecha || '',
          semana: item.ordem_semana || '',
          giro: item.ordem_giro || '',
          construcao: item.ordem_construcao || item.construcao || item.CONSTRUCAO || ''
        },
        entrega: {
          barcode: item.entrega_barcode || '',
          nome: item.entrega_nome || '',
          descCel: item.entrega_descCel || '',
          turno: item.entrega_turno || '',
          funcao: item.entrega_funcao || ''
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F0F4F8] p-4 md:p-8 flex flex-col items-center justify-center overflow-y-auto">
      <div className="w-full max-w-[1800px] space-y-4 relative">
        {loading && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-xl">
            <Loader2 className="animate-spin text-white w-12 h-12" />
          </div>
        )}

        {/* Solicitante Section */}
        <div className="flex flex-col md:flex-row bg-[#E5D1C1] overflow-hidden shadow-xl rounded-t-lg">
          <SectionHeader title="CÓD. BARRA SOLICITANTE" />
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-red-900/10 bg-white/5">
              <input
                type="text"
                placeholder="Escaneie aqui..."
                value={formData.solicitante.barcode}
                onChange={(e) => updateField('solicitante', 'barcode', e.target.value)}
                onBlur={(e) => handleBuscaCracha('solicitante', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscaCracha('solicitante', e.currentTarget.value)}
                className="text-2xl md:text-3xl font-mono tracking-widest text-gray-800 bg-transparent border-b-2 border-red-900/30 w-full text-center outline-none focus:border-red-900 transition-colors py-2"
              />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-red-900/10 flex flex-col">
                <InputField label="NOME" value={formData.solicitante.nome} onChange={(v) => updateField('solicitante', 'nome', v)} />
                <InputField label="FUNÇÃO" value={formData.solicitante.funcao} onChange={(v) => updateField('solicitante', 'funcao', v)} />
                <InputField label="SETOR" value={formData.solicitante.setor} onChange={(v) => updateField('solicitante', 'setor', v)} />
                <InputField label="DESC.CEL" value={formData.solicitante.descCel} onChange={(v) => updateField('solicitante', 'descCel', v)} />
              </div>
              <div className="flex flex-col">
                <InputField label="CÓD_CRACHA" value={formData.solicitante.codCracha} onChange={(v) => updateField('solicitante', 'codCracha', v)} />
                <InputField label="PRÉDIO" value={formData.solicitante.predio} onChange={(v) => updateField('solicitante', 'predio', v)} />
                <InputField label="CELULA" value={formData.solicitante.celula} onChange={(v) => updateField('solicitante', 'celula', v)} />
                <InputField label="TURNO" value={formData.solicitante.turno} onChange={(v) => updateField('solicitante', 'turno', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Destinatario Section */}
        <div className="flex flex-col md:flex-row bg-[#E5D1C1] overflow-hidden shadow-xl">
          <SectionHeader title="CÓD. BARRA DESTINATÁRIO" />
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-red-900/10 bg-white/10">
              <input
                type="text"
                placeholder="Escaneie aqui..."
                value={formData.destinatario.barcode}
                onChange={(e) => updateField('destinatario', 'barcode', e.target.value)}
                onBlur={(e) => handleBuscaCracha('destinatario', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscaCracha('destinatario', e.currentTarget.value)}
                className="text-2xl md:text-3xl font-mono tracking-widest text-gray-800 bg-transparent border-b-2 border-red-900/30 w-full text-center outline-none focus:border-red-900 transition-colors py-2"
              />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-red-900/10 flex flex-col">
                <InputField label="NOME" value={formData.destinatario.nome} onChange={(v) => updateField('destinatario', 'nome', v)} />
                <InputField label="FUNÇÃO" value={formData.destinatario.funcao} onChange={(v) => updateField('destinatario', 'funcao', v)} />
                <InputField label="SETOR" value={formData.destinatario.setor} onChange={(v) => updateField('destinatario', 'setor', v)} />
                <InputField label="DESC.CEL" value={formData.destinatario.descCel} onChange={(v) => updateField('destinatario', 'descCel', v)} />
              </div>
              <div className="flex flex-col">
                <InputField label="CÓD_CRACHA" value={formData.destinatario.codCracha} onChange={(v) => updateField('destinatario', 'codCracha', v)} />
                <InputField label="PRÉDIO" value={formData.destinatario.predio} onChange={(v) => updateField('destinatario', 'predio', v)} />
                <InputField label="CELULA" value={formData.destinatario.celula} onChange={(v) => updateField('destinatario', 'celula', v)} />
                <InputField label="TURNO" value={formData.destinatario.turno} onChange={(v) => updateField('destinatario', 'turno', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Ordem Section */}
        <div className="flex flex-col md:flex-row bg-[#E5D1C1] overflow-hidden shadow-xl">
          <div className="w-full md:w-48 bg-orange-200/60 p-4 text-xs md:text-sm font-bold text-red-900 uppercase flex flex-row md:flex-col justify-between border-b md:border-b-0 md:border-r border-red-900/10 gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] md:text-xs">ORDEM PAI</span>
              <input
                className="bg-white/50 text-sm md:text-base p-1.5 md:p-2 outline-none focus:bg-white transition-colors rounded-sm font-medium text-gray-900 w-full"
                value={formData.ordem.pai}
                onChange={(e) => updateField('ordem', 'pai', e.target.value)}
                onBlur={(e) => handleBuscaOrdem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuscaOrdem(e.currentTarget.value)}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] md:text-xs">REP. ORDEM</span>
              <input
                className="bg-white/50 text-sm md:text-base p-1.5 md:p-2 outline-none focus:bg-white transition-colors rounded-sm font-medium text-gray-900 w-full"
                value={formData.ordem.rep}
                onChange={(e) => updateField('ordem', 'rep', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] md:text-xs">N° REQ</span>
              <input
                className="bg-white/50 text-sm md:text-base p-1.5 md:p-2 outline-none focus:bg-white transition-colors rounded-sm font-medium text-gray-900 w-full"
                value={formData.ordem.req}
                onChange={(e) => updateField('ordem', 'req', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] md:text-xs">PRIORIDADE</span>
              <select
                className="bg-white/50 text-sm md:text-base p-1.5 md:p-2 outline-none focus:bg-white transition-colors rounded-sm font-medium text-gray-900 w-full appearance-none cursor-pointer"
                value={formData.ordem.prioridade}
                onChange={(e) => updateField('ordem', 'prioridade', e.target.value)}
              >
                <option value=""></option>
                <option value="baixa">Baixa</option>
                <option value="média">Média</option>
                <option value="alta">Alta</option>
                <option value="embarque">Embarque</option>
              </select>
            </div>
          </div>
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="hidden md:block w-1/3 p-4 border-r border-red-900/10 bg-white/10">
              {/* Empty area to align with barcodes above */}
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-red-900/10 flex flex-col">
                <InputField label="MARCA" value={formData.ordem.marca} onChange={(v) => updateField('ordem', 'marca', v)} />
                <InputField label="MODELO" value={formData.ordem.modelo} onChange={(v) => updateField('ordem', 'modelo', v)} />
                <InputField label="CONSTRUÇÃO" value={formData.ordem.construcao} onChange={(v) => updateField('ordem', 'construcao', v)} />
                <InputField label="LOTE" value={formData.ordem.lote} onChange={(v) => updateField('ordem', 'lote', v)} />
              </div>
              <div className="flex flex-col">
                <InputField label="TIPO" value={formData.ordem.tipo} onChange={(v) => updateField('ordem', 'tipo', v)} />
                <InputField label="DADOS_EMBARQUE" value={formData.ordem.dataFecha} onChange={(v) => updateField('ordem', 'dataFecha', v)} />
                <InputField label="SEMANA" value={formData.ordem.semana} onChange={(v) => updateField('ordem', 'semana', v)} />
                <InputField label="GIRO - O/S" value={formData.ordem.giro} onChange={(v) => updateField('ordem', 'giro', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Materiais Table Section */}
        <div className="bg-[#E5D1C1] overflow-hidden shadow-xl rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-xs md:text-sm">
                  <th className="p-2 md:p-3 font-bold uppercase border-r border-white/20">Produto</th>
                  <th className="p-2 md:p-3 font-bold uppercase border-r border-white/20">Descrição</th>
                  <th className="p-2 md:p-3 font-bold uppercase border-r border-white/20">Qtd</th>
                  <th className="p-2 md:p-3 font-bold uppercase border-r border-white/20">Und_Méd</th>
                  <th className="p-2 md:p-3 font-bold uppercase border-r border-white/20">Tamanho</th>
                  <th className="p-2 md:p-3 font-bold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((mat, i) => (
                  <tr key={i} className="border-b border-red-900/10 hover:bg-white/20 transition-colors">
                    <td className="p-1 border-r border-red-900/10">
                      <input
                        type="text"
                        value={mat.produto}
                        onChange={(e) => updateMaterial(i, 'produto', e.target.value)}
                        onBlur={(e) => handleBuscaProduto(i, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBuscaProduto(i, e.currentTarget.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800"
                      />
                    </td>
                    <td className="p-1 border-r border-red-900/10">
                      <input
                        type="text"
                        value={mat.descricao}
                        onChange={(e) => updateMaterial(i, 'descricao', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800"
                      />
                    </td>
                    <td className="p-1 border-r border-red-900/10">
                      <input
                        type="text"
                        value={mat.qtd}
                        onChange={(e) => updateMaterial(i, 'qtd', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800"
                      />
                    </td>
                    <td className="p-1 border-r border-red-900/10">
                      <select
                        value={mat.medida}
                        onChange={(e) => updateMaterial(i, 'medida', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800 appearance-none cursor-pointer"
                      >
                        <option value=""></option>
                        <option value="PAR">PAR</option>
                        <option value="UN">UN</option>
                        <option value="KG">KG</option>
                        <option value="M">M</option>
                        <option value="M²">M²</option>
                        <option value="MIL">MIL</option>
                      </select>
                    </td>
                    <td className="p-1 border-r border-red-900/10">
                      <select
                        value={mat.tam}
                        onChange={(e) => updateMaterial(i, 'tam', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800 appearance-none cursor-pointer"
                      >
                        <option value=""></option>
                        <option value="75cm">75cm</option>
                        <option value="80cm">80cm</option>
                        <option value="85cm">85cm</option>
                        <option value="90cm">90cm</option>
                        <option value="95cm">95cm</option>
                        <option value="100cm">100cm</option>
                        <option value="105cm">105cm</option>
                        <option value="110cm">110cm</option>
                        <option value="115cm">115cm</option>
                        <option value="120cm">120cm</option>
                        <option value="125cm">125cm</option>
                        <option value="130cm">130cm</option>
                        <option value="135cm">135cm</option>
                        <option value="140cm">140cm</option>
                        <option value="T8">T8</option>
                        <option value="T7">T7</option>
                        <option value="T6">T6</option>
                        <option value="T5">T5</option>
                        <option value="T4">T4</option>
                        <option value="T3">T3</option>
                        <option value="T2">T2</option>
                        <option value="T1">T1</option>
                        <option value="33">33</option>
                        <option value="34">34</option>
                        <option value="35">35</option>
                        <option value="36">36</option>
                        <option value="37">37</option>
                        <option value="38">38</option>
                        <option value="39">39</option>
                        <option value="40">40</option>
                        <option value="41">41</option>
                        <option value="42">42</option>
                        <option value="43">43</option>
                        <option value="44">44</option>
                        <option value="45">45</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        value={mat.status}
                        onChange={(e) => updateMaterial(i, 'status', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1 text-sm text-gray-800 appearance-none cursor-pointer"
                      >
                        <option value=""></option>
                        <option value="VRMP">VRMP</option>                    
                        <option value="MPNG">MPNG</option>
                        <option value="SEPARAÇÃO M²">SEPARAÇÃO M²</option>
                        <option value="SEPARAÇÃO AVIAMENTOS">SEPARAÇÃO AVIAMENTOS</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Items Table (Linked to Badge) */}
        {pendingItems.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl border border-red-900/10 overflow-hidden mt-4">
            <div className="bg-slate-800 p-4 text-white flex items-center gap-2">
              <FileText size={20} className="text-orange-400" />
              <h2 className="text-lg font-bold uppercase tracking-wider">Itens Pendentes para Entrega (Vinculados ao Crachá)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-orange-50 text-red-900 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold border-b border-red-900/10">Selecionar</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Ord_Rep</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Ordem Pai</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Produto</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Descrição</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Qtd.</th>
                    <th className="p-4 font-bold border-b border-red-900/10">TAM.</th>
                    <th className="p-4 font-bold border-b border-red-900/10">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-900/5">
                  {pendingItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-orange-100/50 transition-colors cursor-pointer ${formData.ordem.rep === item.Ord_Rep ? 'bg-orange-100' : ''}`}
                      onClick={() => handleSelectPendingItem(item)}
                    >
                      <td className="p-4">
                        <div className={`w-5 h-5 rounded-full border-2 border-red-900 flex items-center justify-center ${formData.ordem.rep === item.Ord_Rep ? 'bg-red-900' : 'bg-transparent'}`}>
                          {formData.ordem.rep === item.Ord_Rep && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-800">{item.Ord_Rep || item.ORD_REP}</td>
                      <td className="p-4 text-sm text-gray-600">{item.Ordem || item.ordem_pai}</td>
                      <td className="p-4 text-sm text-gray-600">{item.Produtos}</td>
                      <td className="p-4 text-sm text-gray-600">{item['Descrição']}</td>
                      <td className="p-4 text-sm text-gray-600">{item['Qtd.']}</td>
                      <td className="p-4 text-sm text-gray-600">{item['TAM.']}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.Status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                          {item.Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Entrega Section (Now at the bottom) */}
        <div className="flex flex-col md:flex-row bg-[#E5D1C1] overflow-hidden shadow-xl rounded-xl mt-4 border border-red-900/10">
          <SectionHeader title="CÓD. BARRA ENTREGA" />
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-red-900/10 bg-white/10 relative">
              <input
                type="text"
                placeholder="Escaneie aqui..."
                value={formData.entrega.barcode}
                onChange={(e) => updateField('entrega', 'barcode', e.target.value)}
                onBlur={(e) => handleBuscaEntrega(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBuscaEntrega(e.currentTarget.value);
                    setTimeout(handlePesquisar, 100);
                  }
                }}
                className="text-2xl md:text-3xl font-mono tracking-widest text-gray-800 bg-transparent border-b-2 border-red-900/30 w-full text-center outline-none focus:border-red-900 transition-colors py-2 pr-10"
              />
              <button
                onClick={handlePesquisar}
                className="absolute right-8 p-2 text-red-900 hover:text-red-700 transition-colors"
                title="Pesquisar materiais"
              >
                <Search size={24} />
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-red-900/10 flex flex-col">
                <InputField label="NOME" value={formData.entrega.nome} onChange={(v) => updateField('entrega', 'nome', v)} />
                <InputField label="DESC.CEL" value={formData.entrega.descCel} onChange={(v) => updateField('entrega', 'descCel', v)} />
              </div>
              <div className="flex flex-col">
                <InputField label="TURNO" value={formData.entrega.turno} onChange={(v) => updateField('entrega', 'turno', v)} />
                <InputField label="FUNÇÃO" value={formData.entrega.funcao} onChange={(v) => updateField('entrega', 'funcao', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-8 flex flex-wrap gap-4 justify-center md:justify-between">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCadastrar}
            disabled={loading}
            className="flex-1 min-w-[160px] bg-[#00FF00] text-black font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(0,255,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,255,0,0.23)] flex items-center justify-center gap-3 uppercase text-base md:text-lg disabled:opacity-50 transition-all"
          >
            <Plus size={24} />
            Cadastrar
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePesquisar}
            disabled={loading}
            className="flex-1 min-w-[160px] bg-[#1E90FF] text-white font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(30,144,255,0.39)] hover:shadow-[0_6px_20px_rgba(30,144,255,0.23)] flex items-center justify-center gap-3 uppercase text-base md:text-lg disabled:opacity-50 transition-all"
          >
            <Search size={24} />
            Pesquisar
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAlterar}
            disabled={loading}
            className="flex-1 min-w-[160px] bg-[#FFA500] text-white font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(255,165,0,0.39)] hover:shadow-[0_6px_20px_rgba(255,165,0,0.23)] flex items-center justify-center gap-3 uppercase text-base md:text-lg disabled:opacity-50 transition-all"
          >
            <Edit size={24} />
            Alterar
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExcluir}
            disabled={loading}
            className="flex-1 min-w-[160px] bg-[#FF0000] text-white font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(255,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(255,0,0,0.23)] flex items-center justify-center gap-3 uppercase text-base md:text-lg disabled:opacity-50 transition-all"
          >
            <Trash2 size={24} />
            Excluir
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEntrega}
            disabled={loading}
            className="flex-1 min-w-[160px] bg-[#483D8B] text-white font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(72,61,139,0.39)] hover:shadow-[0_6px_20px_rgba(72,61,139,0.23)] flex items-center justify-center gap-3 uppercase text-base md:text-lg disabled:opacity-50 transition-all"
          >
            <Truck size={24} />
            Entrega
          </motion.button>
        </div>

      </div>
    </div>
  );
}
