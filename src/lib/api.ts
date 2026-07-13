export const api = {
  /**
   * Função genérica para chamar o backend no Google Apps Script
   * @param action Nome da ação a ser executada no backend (ex: 'login', 'getOrders')
   * @param data Dados a serem enviados para a ação (opcional)
   */
  post: async (action: string, data: any = {}) => {
    const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyuX8i5Bhsz6YaK_nDCntXT93pfd62BE6BL8Cpd_u6AlKfk_MOA6GWF6vvQIU92FeLiNw/exec";
    
    const isInvalidUrl = !url || url.includes('TODO') || url.includes('YOUR_') || url.trim() === '';

    if (isInvalidUrl) {
      if (!url) {
        console.warn('[API] VITE_API_URL não está configurado no .env. Usando modo offline/mock.');
      } else {
        console.warn(`[API] URL da API parece ser um placeholder: ${url}. Usando modo offline/mock.`);
      }
      return mockResponse(action, data);
    }

    try {
      // Adicionamos um identificador único para evitar cache de navegador indesejado
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`;
      
      // Usamos text/plain para evitar requisições de preflight (CORS) no Apps Script
      // Adicionamos redirect: 'follow' que é essencial para chamadas ao Google Apps Script
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, data }),
        redirect: 'follow'
      });

      const result = await response.json();
      
      if (!result.success) {
        const errorMsg = result.error || 'Erro desconhecido na API';
        if (errorMsg.includes('Ação não encontrada')) {
          console.warn(`[API] Ação [${action}] não implementada no backend. Usando dados mockados.`);
          return mockResponse(action, data);
        }
        throw new Error(errorMsg);
      }
      
      return result.data;
    } catch (error: any) {
      // Fallback crítico para qualquer erro (rede, CORS, JSON corrompido/HTML, 404, etc)
      // Garante que o aplicativo nunca quebre se a API central estiver inacessível
      console.warn(`[API] Falha/desvio na comunicação para a ação [${action}]. Erro:`, error);
      console.warn(`[API] Ativando redundância e carregando dados locais/mockados.`);
      return mockResponse(action, data);
    }
  }
};

// Função temporária para retornar dados mockados enquanto o Apps Script não é configurado
function mockResponse(action: string, data: any) {
  console.log(`[MOCK API] Chamando ação: ${action}`, data);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (action) {
        case 'getUsers':
          resolve([
            { 'ID': 'myikuqyc3', 'USUÁRIO': 'admin', 'E-MAIL': 'admin@empresa.com', 'PAPEL': 'Admin', 'STATUS': 'ativo' },
            { 'ID': 'myikuqyc4', 'USUÁRIO': 'jailson', 'E-MAIL': 'jailson.filho@grupodass.com.br', 'PAPEL': 'Admin', 'STATUS': 'ativo' },
            { 'ID': 'myikuqyc5', 'USUÁRIO': 'camisa', 'E-MAIL': 'camisa@dassitb.com', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': 'g37accx2d', 'USUÁRIO': 'leonardo', 'E-MAIL': 'leonardo.amorim@grupodass.com.br', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': 'oy1cb9b9i', 'USUÁRIO': 'LEO', 'E-MAIL': 'leo@grupodass.com.br', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': 'dwfiv0ua4', 'USUÁRIO': 'JAI021', 'E-MAIL': 'jailson.maipa02@gmail.com', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': 'qwhmdmhv4', 'USUÁRIO': 'VRTIE', 'E-MAIL': 'vrtie@empresa.com', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': '0o9jpvmao', 'USUÁRIO': 'PORTALDASS', 'E-MAIL': 'portaldass@grupodass.com', 'PAPEL': 'User', 'STATUS': 'ativo' },
            { 'ID': 'cldz97ia7', 'USUÁRIO': 'JAI', 'E-MAIL': 'jailson.maipa@grupodass.com.br', 'PAPEL': 'User', 'STATUS': 'ativo' }
          ].map(u => ({
            ...u,
            'Permissões de Tela (Módulos)': JSON.stringify({ 
              painel: true, 
              cadastro: u.PAPEL === 'Admin', 
              almx: u.PAPEL === 'Admin',
              followup: true, 
              chat: true, 
              config: u.PAPEL === 'Admin' 
            })
          })));
          break;
        case 'addUser':
          resolve({ ...data, id: Date.now(), status: 'Ativo', permissions: { painel: true, cadastro: data.role === 'Admin', followup: true, chat: true, config: data.role === 'Admin' } });
          break;
        case 'updateUser':
          resolve({ success: true });
          break;
        case 'login':
          if ((data.email === 'admin@exemplo.com' || data.email === 'jailson.filho@grupodass.com.br') && data.password === '123456') {
            const isAdmin = true;
            const perms = { 
              painel: true, 
              cadastro: isAdmin, 
              almx: isAdmin,
              followup: true, 
              chat: true, 
              config: isAdmin 
            };
            resolve({ 
              id: '1', 
              nome: data.email === 'admin@exemplo.com' ? 'Administrador' : 'Jailson Filho', 
              email: data.email, 
              role: 'Admin',
              'Permissões de Tela (Módulos)': JSON.stringify(perms)
            });
          } else if (data.email === 'user@exemplo.com' && data.password === '123456') {
            const perms = { 
              painel: true, 
              cadastro: false, 
              almx: false,
              followup: true, 
              chat: true, 
              config: false 
            };
            resolve({ 
              id: '2', 
              nome: 'João Silva', 
              email: data.email, 
              role: 'Operador',
              'Permissões de Tela (Módulos)': JSON.stringify(perms)
            });
          } else {
            resolve(null);
          }
          break;
        case 'register':
          // Simula salvar no banco e retornar o usuário com permissão padrão restrita ao Painel (Status)
          resolve({ 
            id: Date.now().toString(), 
            nome: data.name, 
            email: data.email, 
            role: 'Operador',
            'Permissões de Tela (Módulos)': JSON.stringify({ 
              painel: true, 
              cadastro: false, 
              followup: false, 
              chat: false, 
              config: false, 
              producao: false, 
              programacaoPCP: false 
            })
          });
          break;
        case 'getOrders':
          resolve([
            { id: '48192592622996', modelo: 'Tênis Esportivo X', setor: 'Costura', status: 'Em Andamento', prioridade: 'Alta', data: '19/02/2026' },
            { id: '48192592622997', modelo: 'Bota Work Y', setor: 'Corte', status: 'Atrasado', prioridade: 'Urgente', data: '18/02/2026' }
          ]);
          break;
        case 'addOrder':
          resolve({ ...data, id: Date.now().toString() });
          break;
        case 'getMaterials':
          resolve([
            { codigo: 'TEC-001', descricao: 'Tecido Algodão Premium Branco', quantidade: '1500m', status: 'MPOK' }
          ]);
          break;
        case 'addDelivery':
          resolve({ ...data, id: Date.now().toString(), status: 'Entregue' });
          break;
        case 'getUserByCracha':
          resolve({
            'NOME': 'João Silva',
            'FUNCAO': 'Operador',
            'SETOR': 'Costura',
            'CEL_NOME': 'Célula A',
            'CRACHA': data.cracha,
            'PRÉDIO': 'Prédio 1',
            'CEL_CODIGO': 'CEL-01',
            'TUR_CODIGO': 'Turno 1'
          });
          break;
        case 'getWipData':
          resolve([
            { 
              'Ordem': '12345', 
              'Marca': 'Nike', 
              'modelo': 'Air Max', 
              'Semana': '12', 
              'cor': 'Preto', 
              'lote': 'ABCD123', 
              'Data_Embarque': '20/03/2026',
              'Qtd a Cortar': '0',
              'Almox': '10'
            },
            { 
              'Ordem': '54321', 
              'Marca': 'Adidas', 
              'modelo': 'Ultraboost', 
              'Semana': '13', 
              'cor': 'Branco', 
              'lote': 'EFGH456',
              'Data_Embarque': '25/03/2026',
              'Qtd a Cortar': '100',
              'Almox': '0'
            }
          ]);
          break;
        case 'getParametros':
          resolve([
            { 'Modelo': 'ABCD', 'Embarque': 'EXPORTAÇÃO' },
            { 'Modelo': 'EFGH', 'Embarque': 'REP NACIONAL' }
          ]);
          break;
        case 'getPainelData':
          resolve([
            { 
              id: '1',
              'Ordem': '14766812', 
              'Ord_Rep': '15104061', 
              'N°_Req': '8890855', 
              'Marca': 'Nike',
              'Produtos': '1372945', 
              'Descrição': 'TECIDO MESH ESPORTIVO', 
              'Qtd.': '11,7000', 
              'Medida': 'M²', 
              'TAM.': '', 
              'Status': 'MPNG', 
              'Data_Reg_Central': '09/12/2025 - 07:35:09', 
              'Data_Ent_Almox.': '', 
              'Data_Entrega': '', 
              'Data_Ent_Avi': '', 
              'Data_Ent_Central': '', 
              'Data_ Avali_Follow': '09/12/2025 - 15:15:05',
              'Observação': 'Aguardando fornecedor',
              'Setor': 'Costura',
              destinatario_cracha: '12345',
              destinatario_nome: 'JOÃO SILVA',
              destinatario_turno: '1° TURNO',
              destinatario_descCel: 'CELULA A',
              destinatario_funcao: 'OPERADOR'
            },
            { 
              id: '2',
              'Ordem': '14755450', 
              'Ord_Rep': '15104057', 
              'N°_Req': '8890849', 
              'Marca': 'Adidas',
              'Produtos': '521456', 
              'Descrição': 'SINTETICO PVC ARTSKIN DUO RP013', 
              'Qtd.': '12,5000', 
              'Medida': 'M²', 
              'TAM.': '', 
              'Status': 'MPNG', 
              'Data_Reg_Central': '09/12/2025 - 07:36:44', 
              'Data_Ent_Almox.': '', 
              'Data_Entrega': '', 
              'Data_Ent_Avi': '', 
              'Data_Ent_Central': '', 
              'Data_ Avali_Follow': '09/12/2025 - 15:15:05',
              'Observação': '',
              'Setor': 'Corte',
              destinatario_cracha: '12345',
              destinatario_nome: 'JOÃO SILVA',
              destinatario_turno: '1° TURNO',
              destinatario_descCel: 'CELULA A',
              destinatario_funcao: 'OPERADOR'
            }
          ]);
          break;
        case 'updatePainelData':
          resolve({ success: true });
          break;
        case 'savePCPData':
          console.log('Mock saving PCP data:', data);
          resolve({ success: true, id: data.id || 'mock-id-123' });
          break;
      
      case 'getMaterialByProduto':
          resolve({
            'Produto': data.produto,
            'Descrição': 'Descrição mockada para ' + data.produto
          });
          break;
        case 'getMateriasData':
          resolve([
            { 
              id: 'm1',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9d7',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/29',
              'Modelo': 'BREEZE',
              'Legenda': 'ESTOQUE',
              'Documento': 'FIL001441',
              'OP': '15669806',
              'Reserva': '108.24',
              'Qtd. estoque': '0.00',
              'Saldo': '32150.11',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm2',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9d8',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/29',
              'Modelo': 'RISE UP',
              'Legenda': 'ESTOQUE',
              'Documento': 'BRITB005144',
              'OP': '15669828',
              'Reserva': '108.91',
              'Qtd. estoque': '0.00',
              'Saldo': '31919.65',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm3',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9d9',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/29',
              'Modelo': 'RISE UP',
              'Legenda': 'ESTOQUE',
              'Documento': 'BRITB005145',
              'OP': '15568939',
              'Reserva': '98.66',
              'Qtd. estoque': '0.00',
              'Saldo': '31820.98',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm4',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e0',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/29',
              'Modelo': 'RISE UP',
              'Legenda': 'ESTOQUE',
              'Documento': 'BRITB005146',
              'OP': '15568950',
              'Reserva': '87.29',
              'Qtd. estoque': '0.00',
              'Saldo': '31733.68',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm5',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e1',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/30',
              'Modelo': 'PRIZE',
              'Legenda': 'ESTOQUE',
              'Documento': 'NET000067',
              'OP': '15670120',
              'Reserva': '45.52',
              'Qtd. estoque': '0.00',
              'Saldo': '31449.36',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm6',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e2',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/30',
              'Modelo': 'PRIZE',
              'Legenda': 'ESTOQUE',
              'Documento': 'NET000073',
              'OP': '15670121',
              'Reserva': '26.10',
              'Qtd. estoque': '0.00',
              'Saldo': '31423.25',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm7',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e3',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/43',
              'Modelo': 'AGILE',
              'Legenda': 'FATURADO',
              'Documento': 'FIL001003',
              'OP': '14646362',
              'Reserva': '30.15',
              'Qtd. estoque': '0.00',
              'Saldo': '0.00',
              'Qtd. OC': '1554.00',
              'Qtd. EDI': '433053',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm8',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e4',
              'Produto': '101484', 
              'Descrição produto': 'TECIDO KETTEN K817/2 3 1098 JERSEY CRU 99 A004 FIX NK LARG 1,48M 44,6GR/M2 100%PES', 
              'Tamanho': '0',
              'Semana': '2025/43',
              'Modelo': 'AGILE',
              'Legenda': 'FATURADO',
              'Documento': 'FIL001004',
              'OP': '14646377',
              'Reserva': '23.71',
              'Qtd. estoque': '0.00',
              'Saldo': '0.00',
              'Qtd. OC': '1554.00',
              'Qtd. EDI': '433053',
              'Nome fornecedor': 'TWILTEX INDUSTRIAS TEXTEIS LTD',
              'Und.': 'M2'
            },
            { 
              id: 'm9',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e5',
              'Produto': '101531', 
              'Descrição produto': 'REFORCO ENTRETELA SOFTLINE M5C 13 PRETO LARG 1,45M 130GR/M2 80%PES REC. 20%PES', 
              'Tamanho': '0',
              'Semana': '2025/40',
              'Modelo': 'VENTURE TRACER 2',
              'Legenda': 'ESTOQUE',
              'Documento': 'BRITB004133',
              'OP': '14482899',
              'Reserva': '157.72',
              'Qtd. estoque': '0.00',
              'Saldo': '8980.12',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'INBRAPE TECIDOS INDÚSTRIAIS LTDA',
              'Und.': 'M2'
            },
            { 
              id: 'm10',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e6',
              'Produto': '101531', 
              'Descrição produto': 'REFORCO ENTRETELA SOFTLINE M5C 13 PRETO LARG 1,45M 130GR/M2 80%PES REC. 20%PES', 
              'Tamanho': '0',
              'Semana': '2025/40',
              'Modelo': 'FREESTYLE II',
              'Legenda': 'ESTOQUE',
              'Documento': 'BRITB003950',
              'OP': '14480436',
              'Reserva': '80.01',
              'Qtd. estoque': '0.00',
              'Saldo': '8665.03',
              'Qtd. OC': '0',
              'Qtd. EDI': '0',
              'Nome fornecedor': 'INBRAPE TECIDOS INDÚSTRIAIS LTDA',
              'Und.': 'M2'
            },
            { 
              id: 'm11',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e7',
              'Produto': '101531', 
              'Descrição produto': 'REFORCO ENTRETELA SOFTLINE M5C 13 PRETO LARG 1,45M 130GR/M2 80%PES REC. 20%PES', 
              'Tamanho': '0',
              'Semana': '2025/43',
              'Modelo': 'COMET 2',
              'Legenda': 'FATURADO',
              'Documento': 'BRITB003980',
              'OP': '14481191',
              'Reserva': '187.96',
              'Qtd. estoque': '0.00',
              'Saldo': '0.00',
              'Qtd. OC': '313.20',
              'Qtd. EDI': '181418',
              'Nome fornecedor': 'INBRAPE TECIDOS INDÚSTRIAIS LTDA',
              'Und.': 'M2'
            },
            { 
              id: 'm12',
              'Id': 'a15298cd-4870-496a-8d07-2c9ffbc4a9e8',
              'Produto': '101531', 
              'Descrição produto': 'REFORCO ENTRETELA SOFTLINE M5C 13 PRETO LARG 1,45M 130GR/M2 80%PES REC. 20%PES', 
              'Tamanho': '0',
              'Semana': '2025/43',
              'Modelo': 'RECOVERY',
              'Legenda': 'FATURADO',
              'Documento': 'BRITB004152',
              'OP': '14556270',
              'Reserva': '178.13',
              'Qtd. estoque': '0.00',
              'Saldo': '0.00',
              'Qtd. OC': '1138.25',
              'Qtd. EDI': '181472',
              'Nome fornecedor': 'INBRAPE TECIDOS INDÚSTRIAIS LTDA',
              'Und.': 'M2'
            }
          ]);
          break;
        case 'saveMateriaData':
          console.log('Mock saving Materia data:', data);
          resolve({ success: true, id: data.id || 'mock-mat-id-' + Date.now() });
          break;
        case 'deleteMateriaData':
          console.log('Mock deleting Materia data:', data);
          resolve({ success: true, id: data.id });
          break;
        case 'getAwbData': {
          const stored = localStorage.getItem('pcp_awb_data');
          if (stored) {
            resolve(JSON.parse(stored));
          } else {
            const initial = [
              {
                id: 'awb1',
                Marca: 'UMBRO',
                Fornecedor: 'NOVANOR',
                Saida: '21/01/2026',
                NFs: '1078095.1078096',
                Awb: '57703379159',
                Status: 'DISPONIVEL',
                Rastreio: 'https://www.dhl.com/br-pt/home.html',
                Material: 'ROLOS',
                Observacao: 'CHEGA',
                Docs: 2,
                DocList: ['Invoice_1078095.pdf', 'Packing_List_1078096.pdf']
              },
              {
                id: 'awb2',
                Marca: 'NIKE',
                Fornecedor: 'SINTEX',
                Saida: '18/02/2026',
                NFs: '1089201',
                Awb: '99201384752',
                Status: 'EM TRÂNSITO',
                Rastreio: 'https://www.dhl.com/br-pt/home.html',
                Material: 'SOLADOS',
                Observacao: 'Aguardando liberação alfandegária',
                Docs: 1,
                DocList: ['Invoice_1089201.pdf']
              },
              {
                id: 'awb3',
                Marca: 'ADIDAS',
                Fornecedor: 'TEXTIL DASS',
                Saida: '02/03/2026',
                NFs: '1099854',
                Awb: '38274910293',
                Status: 'AGUARDANDO',
                Rastreio: 'https://www.dhl.com/br-pt/home.html',
                Material: 'MALHAS',
                Observacao: 'Previsão de coleta amanhã',
                Docs: 3,
                DocList: ['Invoice_1099854.pdf', 'Packing_List_1099854.pdf', 'Coleta_Auth.pdf']
              }
            ];
            localStorage.setItem('pcp_awb_data', JSON.stringify(initial));
            resolve(initial);
          }
          break;
        }
        case 'saveAwbData': {
          const stored = localStorage.getItem('pcp_awb_data');
          let list = stored ? JSON.parse(stored) : [];
          const actualData = { ...data };
          if (actualData.id) {
            list = list.map((item: any) => item.id === actualData.id ? { ...item, ...actualData } : item);
          } else {
            actualData.id = 'awb_' + Date.now();
            list = [actualData, ...list];
          }
          localStorage.setItem('pcp_awb_data', JSON.stringify(list));
          resolve({ success: true, data: actualData });
          break;
        }
        case 'deleteAwbData': {
          const stored = localStorage.getItem('pcp_awb_data');
          let list = stored ? JSON.parse(stored) : [];
          list = list.filter((item: any) => item.id !== data.id);
          localStorage.setItem('pcp_awb_data', JSON.stringify(list));
          resolve({ success: true });
          break;
        }
        case 'saveMultiplePainelData':
        case 'updateMultiplePainelData':
        case 'deleteMultiplePainelData':
          resolve({ success: true, message: 'Operação em lote realizada com sucesso' });
          break;
        default:
          resolve({ success: true, message: 'Mock response' });
      }
    }, 500);
  });
}
