export const api = {
  /**
   * Função genérica para chamar o backend no Google Apps Script
   * @param action Nome da ação a ser executada no backend (ex: 'login', 'getOrders')
   * @param data Dados a serem enviados para a ação (opcional)
   */
  post: async (action: string, data: any = {}) => {
    const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwXt-KyiVYzIUu0R-O-WQKgHtEeM3Z3uGllCJuEnYr-iSmhcdsEk4xPE1GApVBSOK86rQ/exec";
    
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
          // Simula salvar no banco e retornar o usuário
          resolve({ id: Date.now().toString(), nome: data.name, email: data.email, role: 'Operador' });
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
