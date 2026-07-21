function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var data = body.data || {};
    var result = null;

    // Normalização da ação para garantir compatibilidade entre versões da API
    var actionNormalized = String(action).toUpperCase().trim();
    if (actionNormalized === 'CREATE' || actionNormalized === 'UPDATE') actionNormalized = 'SAVE';
    if (actionNormalized === 'READ') actionNormalized = 'GET';

    // Mapeamento compatível para as ações legadas e novas
    if (actionNormalized === 'UPLOAD' || actionNormalized === 'UPLOAD_PDF' || actionNormalized === 'UPLOADFILETODRIVE') {
      action = 'uploadFileToDrive';
    } else if (actionNormalized === 'BUSCAR_DOCUMENTOS' || actionNormalized === 'BUSCARDOCUMENTOSPORNOTAFISCAL') {
      action = 'buscarDocumentosPorNotaFiscal';
    } else if (actionNormalized === 'STATUS_BUSCA' || actionNormalized === 'OBTERSTATUSBUSCA') {
      action = 'statusBusca';
    }

    switch (action) {
      case 'login':
        result = login(data);
        break;
      case 'register':
        result = register(data);
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'addUser':
        result = addUser(data);
        break;
      case 'updateUser':
        result = updateUser(data);
        break;
      case 'getUserByCracha':
        result = getUserByCracha(data);
        break;
      case 'getBDAsicsNovoData':
      case 'get042BDData':
        result = getSheetData042BD();
        break;
      case 'getWipData':
        result = getMergedPCPData();
        break;
      case 'savePainelData':
        result = appendRow('Painel (status)', data);
        break;
      case 'saveMultiplePainelData':
        result = saveMultiplePainelData(data);
        break;
      case 'getPainelData':
        result = getSheetData('Painel (status)');
        break;
      case 'updatePainelData':
        result = updateRow('Painel (status)', data.id, data);
        break;
      case 'updateMultiplePainelData':
        result = updateMultiplePainelData(data);
        break;
      case 'deletePainelData':
        result = deleteRow('Painel (status)', data.id);
        break;
      case 'deleteMultiplePainelData':
        result = deleteMultiplePainelData(data);
        break;
      case 'getMaterialByProduto':
        result = getMaterialByProduto(data);
        break;
      case 'getMateriasData':
        result = getSheetData('Follow Material Prima');
        break;
      case 'saveMateriaData':
        if (data.id) {
          result = updateRow('Follow Material Prima', data.id, data);
        } else {
          data.id = Utilities.getUuid();
          result = appendRow('Follow Material Prima', data);
        }
        break;
      case 'deleteMateriaData':
        result = deleteRow('Follow Material Prima', data.id);
        break;
      case 'getAwbData':
        result = getAwbData();
        break;
      case 'saveAwbData':
        result = saveAwbData(data);
        break;
      case 'sendAwbEmail':
        enviarEmailPersonalizado(data.awb, data.to, data.cc, data.bcc, data.body, 'Follow-Up AWB');
        result = { success: true, message: "E-mail enviado com sucesso!" };
        break;
      case 'deleteAwbData':
        result = deleteAwbData(data);
        break;
      case 'uploadFileToDrive':
        // Oferece suporte para as duas estruturas de parâmetros
        var uploadPayload = {
          filename: data.filename || data.fileName || 'arquivo.pdf',
          base64Data: data.base64Data || data.base64 || data.base64Data
        };
        result = uploadFileToDrive(uploadPayload);
        break;
      case 'buscarDocumentosPorNotaFiscal':
        result = buscarDocumentosPorNotaFiscal();
        break;
      case 'statusBusca':
        result = { status: obterStatusBusca() };
        break;
      case 'getParametros':
        result = getParametros();
        break;
      case 'savePCPData':
        result = savePCPData(data);
        break;
      case 'reorderPCPRows':
        result = reorderRows(data.sheetName || 'Wip042', data.idList);
        break;
      case 'importSheetData':
        result = importSheetData(data);
        break;
      default:
        throw new Error("Ação não encontrada: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "API PCP System Online!" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// FUNÇÕES DE AUTENTICAÇÃO E USUÁRIOS
// ==========================================

function login(data) {
  data = data || {};
  var users = getSheetData('Cadastro de usuário');
  for (var i = 0; i < users.length; i++) {
    // As colunas na planilha são: ID, USUÁRIO, E-MAIL, SENHA, PAPEL, STATUS
    if (users[i]['E-MAIL'] === data.email && String(users[i]['SENHA']) === String(data.password)) {
      if (users[i]['STATUS'] !== 'ativo') {
        throw new Error("Usuário inativo");
      }
      return {
        id: users[i]['ID'],
        nome: users[i]['USUÁRIO'],
        email: users[i]['E-MAIL'],
        funcao: users[i]['PAPEL'],
        'Permissões de Tela (Módulos)': users[i]['Permissões de Tela (Módulos)'] || '{"painel":true,"cadastro":false,"followup":false,"chat":false,"config":false,"producao":false,"programacaoPCP":false}'
      };
    }
  }
  throw new Error("Credenciais inválidas");
}

function register(data) {
  data = data || {};
  var users = getSheetData('Cadastro de usuário');
  for (var i = 0; i < users.length; i++) {
    if (users[i]['E-MAIL'] === data.email) {
      throw new Error("E-mail já cadastrado");
    }
  }
  
  var newUser = {
    'ID': Utilities.getUuid(),
    'USUÁRIO': data.name,
    'E-MAIL': data.email,
    'SENHA': data.password,
    'PAPEL': data.role || 'User',
    'STATUS': 'ativo',
    'Permissões de Tela (Módulos)': '{"painel":true,"cadastro":false,"followup":false,"chat":false,"config":false,"producao":false,"programacaoPCP":false}',
    'Bio': '',
    'Location': '',
    'Img': '',
    'Cargo': ''
  };
  
  appendRow('Cadastro de usuário', newUser);
  
  return {
    id: newUser['ID'],
    nome: newUser['USUÁRIO'],
    email: newUser['E-MAIL'],
    funcao: newUser['PAPEL'],
    'Permissões de Tela (Módulos)': newUser['Permissões de Tela (Módulos)']
  };
}

function getUserByCracha(data) {
  data = data || {};
  var users = getSheetData('Usuário (cracha)');
  var searchTerm = String(data.cracha || '').trim();
  
  for (var i = 0; i < users.length; i++) {
    // Busca pelo CRACHA ou CHAPA
    if (String(users[i]['CRACHA']) === searchTerm || String(users[i]['CHAPA']) === searchTerm) {
      return users[i];
    }
  }
  throw new Error("Usuário não encontrado com este crachá/chapa");
}

function getUsers() {
  return getSheetData('Cadastro de usuário');
}

function addUser(data) {
  data = data || {};
  var users = getSheetData('Cadastro de usuário');
  for (var i = 0; i < users.length; i++) {
    if (users[i]['E-MAIL'] === data.email) {
      throw new Error("E-mail já cadastrado");
    }
  }
  
  var newUser = {
    'ID': Utilities.getUuid(),
    'USUÁRIO': data.name,
    'E-MAIL': data.email,
    'SENHA': data.password || '123456',
    'PAPEL': data.role || 'User',
    'STATUS': 'ativo',
    'Permissões de Tela (Módulos)': data['Permissões de Tela (Módulos)'] || '{"painel":true,"cadastro":false,"followup":false,"chat":false,"config":false,"producao":false,"programacaoPCP":false}',
    'Bio': '',
    'Location': '',
    'Img': '',
    'Cargo': ''
  };
  
  appendRow('Cadastro de usuário', newUser);
  
  return {
    id: newUser['ID'],
    ID: newUser['ID'],
    nome: newUser['USUÁRIO'],
    'USUÁRIO': newUser['USUÁRIO'],
    email: newUser['E-MAIL'],
    'E-MAIL': newUser['E-MAIL'],
    funcao: newUser['PAPEL'],
    'PAPEL': newUser['PAPEL'],
    'Permissões de Tela (Módulos)': newUser['Permissões de Tela (Módulos)'],
    'STATUS': 'ativo'
  };
}

function updateUser(data) {
  data = data || {};
  var id = data.id || data.ID;
  if (!id) throw new Error("ID do usuário não fornecido");
  
  var updateData = {};
  for (var key in data) {
    updateData[key] = data[key];
  }
  
  if (data.name && !updateData['USUÁRIO']) {
    updateData['USUÁRIO'] = data.name;
  }
  if (data.email && !updateData['E-MAIL']) {
    updateData['E-MAIL'] = data.email;
  }
  if (data.role && !updateData['PAPEL']) {
    updateData['PAPEL'] = data.role;
  }
  
  return updateRow('Cadastro de usuário', id, updateData);
}

function getAwbData() {
  var list = getSheetData('Follow-Up AWB');
  for (var i = 0; i < list.length; i++) {
    var docListVal = list[i]['DocList'] || list[i]['docList'] || '';
    if (typeof docListVal === 'string' && docListVal.trim()) {
      try {
        list[i]['DocList'] = JSON.parse(docListVal);
      } catch (e) {
        list[i]['DocList'] = docListVal.split(',').map(function(s) { return s.trim(); });
      }
    } else if (!list[i]['DocList']) {
      list[i]['DocList'] = [];
    }
    
    // Parse DriveUrls if present
    var driveUrlsVal = list[i]['DriveUrls'] || list[i]['driveUrls'] || '';
    if (typeof driveUrlsVal === 'string' && driveUrlsVal.trim()) {
      try {
        list[i]['DriveUrls'] = JSON.parse(driveUrlsVal);
      } catch (e) {
        list[i]['DriveUrls'] = {};
      }
    } else if (!list[i]['DriveUrls']) {
      list[i]['DriveUrls'] = {};
    }

    // Parse FileBinariesInfo if present
    var fileBinariesInfoVal = list[i]['FileBinariesInfo'] || list[i]['fileBinariesInfo'] || '';
    if (typeof fileBinariesInfoVal === 'string' && fileBinariesInfoVal.trim()) {
      try {
        list[i]['FileBinariesInfo'] = JSON.parse(fileBinariesInfoVal);
      } catch (e) {
        list[i]['FileBinariesInfo'] = {};
      }
    } else if (!list[i]['FileBinariesInfo']) {
      list[i]['FileBinariesInfo'] = {};
    }

    // Parse FileBinaries if present
    var fileBinariesVal = list[i]['FileBinaries'] || list[i]['fileBinaries'] || '';
    if (typeof fileBinariesVal === 'string' && fileBinariesVal.trim()) {
      try {
        list[i]['FileBinaries'] = JSON.parse(fileBinariesVal);
      } catch (e) {
        list[i]['FileBinaries'] = {};
      }
    } else if (!list[i]['FileBinaries']) {
      list[i]['FileBinaries'] = {};
    }
  }
  return list;
}

function saveAwbData(data) {
  data = data || {};
  var id = data.id || data.ID;
  
  var formattedData = {};
  for (var key in data) {
    formattedData[key] = data[key];
  }
  
  // Limpa o FileBinaries gigante para evitar estourar o limite de 50.000 caracteres das células do Sheets
  formattedData['FileBinaries'] = '{}';
  
  if (Array.isArray(formattedData['DocList'])) {
    formattedData['DocList'] = JSON.stringify(formattedData['DocList']);
  }
  if (formattedData['DriveUrls'] && typeof formattedData['DriveUrls'] === 'object') {
    formattedData['DriveUrls'] = JSON.stringify(formattedData['DriveUrls']);
  }
  if (formattedData['FileBinariesInfo'] && typeof formattedData['FileBinariesInfo'] === 'object') {
    formattedData['FileBinariesInfo'] = JSON.stringify(formattedData['FileBinariesInfo']);
  }
  
  // Captura dinâmica de parâmetros de e-mail enviados pelo formulário React
  var sendEmail = data.send_email || data.sendEmail;
  var emailTo = data.email_to || data.emailTo;
  var emailCc = data.email_cc || data.emailCc;
  var emailBcc = data.email_bcc || data.emailBcc;
  var emailBody = data.email_body || data.emailBody;
  
  // Limpeza de payload antes de salvar na tabela para não encher com campos auxiliares
  var cleanPayload = {};
  for (var k in formattedData) {
    if (['send_email', 'sendEmail', 'email_to', 'emailTo', 'email_cc', 'emailCc', 'email_bcc', 'emailBcc', 'email_body', 'emailBody'].indexOf(k) === -1) {
      cleanPayload[k] = formattedData[k];
    }
  }
  
  var result;
  if (id) {
    result = updateRow('Follow-Up AWB', id, cleanPayload);
  } else {
    cleanPayload.id = Utilities.getUuid();
    result = appendRow('Follow-Up AWB', cleanPayload);
  }
  
  // Dispara o envio de e-mail se solicitado
  if (sendEmail && emailTo) {
    try {
      enviarEmailPersonalizado(cleanPayload, emailTo, emailCc, emailBcc, emailBody, 'Follow-Up AWB');
    } catch (e) {
      console.error("❌ Falha no envio do e-mail:", e.toString());
    }
  }
  
  // Busca automática de PDFs baseados em Notas Fiscais
  try {
    buscarDocumentosPorNotaFiscal();
  } catch (e) {
    console.warn("⚠️ Falha na busca automática de PDFs:", e.toString());
  }
  
  return result;
}

function uploadFileToDrive(data) {
  if (!data) {
    console.log("A função uploadFileToDrive foi executada diretamente pelo editor de scripts (sem dados).");
    return { success: false, error: "Nenhum dado recebido. Esta função deve ser chamada pelo aplicativo." };
  }
  var filename = data.filename || data.fileName || 'arquivo.pdf';
  var base64Data = data.base64Data || data.base64;
  var folderId = "0AOXxdWFOmscbUk9PVA"; // Hardcoded Google Drive folder ID requested by user
  
  if (!filename || !base64Data) {
    throw new Error("Missing filename or base64Data");
  }
  
  // Se contiver o cabeçalho Data URL, remova-o
  if (base64Data.indexOf(',') !== -1) {
    base64Data = base64Data.split(',')[1];
  }
  
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, "application/pdf", filename);
  
  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    // Fallback: se a pasta por ID falhar (restrições ou compartilhamento), tenta localizar ou criar a pasta "PCP_PDFs" no Meu Drive
    var folders = DriveApp.getFoldersByName("PCP_PDFs");
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("PCP_PDFs");
    }
  }
  var file = folder.createFile(blob);
  
  // Define o arquivo como acessível a qualquer pessoa com o link
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {
    // Caso ocorra algum erro por restrição de domínio, ignora
  }
  
  var fileUrl = file.getUrl();
  
  // LOGICA PARA SALVAR O LINK DIRETAMENTE NO BANCO DE DADOS (PLANILHA GOOGLE SHEETS)
  try {
    var awbId = data.awbId || data.id || data.ID;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follow-Up AWB');
    if (sheet) {
      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var dataRange = sheet.getDataRange();
        var values = dataRange.getValues();
        var headers = values[0];
        
        var idCol = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
        var driveUrlsCol = headers.indexOf('DriveUrls') !== -1 ? headers.indexOf('DriveUrls') : headers.indexOf('driveUrls');
        var docListCol = headers.indexOf('DocList') !== -1 ? headers.indexOf('DocList') : headers.indexOf('docList');
        
        var targetRowIndex = -1;
        
        // 1. Se recebemos o ID da AWB na requisição, busca por ele
        if (awbId && idCol !== -1) {
          for (var i = 1; i < values.length; i++) {
            if (String(values[i][idCol]) === String(awbId)) {
              targetRowIndex = i + 1;
              break;
            }
          }
        }
        
        // 2. Se não encontramos por ID, tenta buscar por Nota Fiscal / AWB contida no nome do arquivo
        if (targetRowIndex === -1) {
          var nfCol = headers.indexOf('NFs') !== -1 ? headers.indexOf('NFs') : headers.indexOf('NFS');
          var awbNumCol = headers.indexOf('Awb') !== -1 ? headers.indexOf('Awb') : headers.indexOf('AWB');
          
          for (var i = 1; i < values.length; i++) {
            // Verifica se a NF está contida no nome do arquivo
            if (nfCol !== -1 && values[i][nfCol]) {
              var nfValue = String(values[i][nfCol]).trim();
              if (nfValue && filename.indexOf(nfValue) !== -1) {
                targetRowIndex = i + 1;
                break;
              }
            }
            // Verifica se o número AWB está contido no nome do arquivo
            if (awbNumCol !== -1 && values[i][awbNumCol]) {
              var awbValue = String(values[i][awbNumCol]).trim();
              if (awbValue && filename.indexOf(awbValue) !== -1) {
                targetRowIndex = i + 1;
                break;
              }
            }
          }
        }
        
        // Se encontramos uma linha correspondente, atualizamos suas colunas DriveUrls e DocList diretamente
        if (targetRowIndex !== -1 && driveUrlsCol !== -1) {
          // Atualiza DriveUrls (JSON)
          var currentDriveUrls = {};
          var driveUrlsCellVal = values[targetRowIndex - 1][driveUrlsCol];
          if (driveUrlsCellVal) {
            try {
              currentDriveUrls = JSON.parse(driveUrlsCellVal);
            } catch (e) {
              currentDriveUrls = {};
            }
          }
          currentDriveUrls[filename] = fileUrl;
          sheet.getRange(targetRowIndex, driveUrlsCol + 1).setValue(JSON.stringify(currentDriveUrls));
          
          // Atualiza DocList (JSON ou string de nomes de arquivos)
          var currentDocList = [];
          if (docListCol !== -1) {
            var docListCellVal = values[targetRowIndex - 1][docListCol];
            if (docListCellVal) {
              try {
                currentDocList = JSON.parse(docListCellVal);
                if (!Array.isArray(currentDocList)) currentDocList = [];
              } catch (e) {
                if (typeof docListCellVal === 'string') {
                  currentDocList = docListCellVal.split(',').map(function(s) { return s.trim(); });
                } else {
                  currentDocList = [];
                }
              }
            }
            if (currentDocList.indexOf(filename) === -1) {
              currentDocList.push(filename);
            }
            sheet.getRange(targetRowIndex, docListCol + 1).setValue(JSON.stringify(currentDocList));
          }
          
          // Atualiza a coluna 'Docs' se houver, contendo a contagem de documentos
          var docsCol = headers.indexOf('Docs') !== -1 ? headers.indexOf('Docs') : headers.indexOf('DOCS');
          if (docsCol !== -1 && currentDocList) {
            sheet.getRange(targetRowIndex, docsCol + 1).setValue(currentDocList.length);
          }
          
          console.log("Banco de dados atualizado diretamente com o link do Drive para a linha: " + targetRowIndex);
        }
      }
    }
  } catch (dbErr) {
    console.error("Erro ao atualizar banco de dados diretamente em uploadFileToDrive:", dbErr.toString());
  }
  
  // 3. Executa a busca automática de PDFs baseados em Notas Fiscais para atualizar PDF_1 a PDF_11
  try {
    buscarDocumentosPorNotaFiscal();
  } catch (e) {
    console.warn("⚠️ Falha na busca automática de PDFs:", e.toString());
  }
  
  return {
    name: filename,
    id: file.getId(),
    url: fileUrl,
    success: true
  };
}

function deleteAwbData(data) {
  return deleteRow('Follow-Up AWB', data.id);
}

function getParametros() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Parâmetros') || ss.getSheetByName('Parametros');
  if (!sheet) return [];
  return getSheetData(sheet.getName());
}

// ==========================================
// FUNÇÕES UTILITÁRIAS PARA O GOOGLE SHEETS
// ==========================================

function saveMultiplePainelData(dataArray) {
  var results = [];
  for (var i = 0; i < dataArray.length; i++) {
    results.push(appendRow('Painel (status)', dataArray[i]));
  }
  return results;
}

function updateMultiplePainelData(dataArray) {
  var results = [];
  for (var i = 0; i < dataArray.length; i++) {
    results.push(updateRow('Painel (status)', dataArray[i].id, dataArray[i]));
  }
  return results;
}

function deleteMultiplePainelData(dataArray) {
  var results = [];
  for (var i = 0; i < dataArray.length; i++) {
    results.push(deleteRow('Painel (status)', dataArray[i].id));
  }
  return results;
}

function getMaterialByProduto(data) {
  data = data || {};
  var searchTerm = String(data.produto || '').trim().toLowerCase();
  
  // 1. Procurar primeiro na aba 'Follow Material Prima'
  var materiasFollow = getSheetData('Follow Material Prima');
  if (materiasFollow && materiasFollow.length > 0) {
    for (var i = 0; i < materiasFollow.length; i++) {
      var prod = String(materiasFollow[i]['Produto'] || materiasFollow[i]['PRODUTO'] || materiasFollow[i]['produto'] || '').trim().toLowerCase();
      if (prod === searchTerm) {
        return materiasFollow[i];
      }
    }
  }
  
  // 2. Se não encontrou, procurar na aba 'Matérias'
  var materiasMain = getSheetData('Matérias');
  if (materiasMain && materiasMain.length > 0) {
    for (var i = 0; i < materiasMain.length; i++) {
      var prod = String(materiasMain[i]['Produto'] || materiasMain[i]['PRODUTO'] || materiasMain[i]['produto'] || '').trim().toLowerCase();
      if (prod === searchTerm) {
        return materiasMain[i];
      }
    }
  }
  
  throw new Error("Material não encontrado");
}

function savePCPData(data) {
  // If editing/saving a WIP row (PCP) in 'Wip042'
  if (data && (data.sheetName || data.data)) {
    var sheetName = data.sheetName || 'Wip042';
    var actualData = data.data || data;
    var id = data.id || actualData.id || actualData.ID;
    return updateRow(sheetName, id, actualData);
  }

  var flatData = {
    id: (data && data.id) || Utilities.getUuid(),
    solicitante_barcode: (data && data.solicitante) ? data.solicitante.barcode : '',
    solicitante_nome: (data && data.solicitante) ? data.solicitante.nome : '',
    solicitante_funcao: (data && data.solicitante) ? data.solicitante.funcao : '',
    solicitante_setor: (data && data.solicitante) ? data.solicitante.setor : '',
    solicitante_descCel: (data && data.solicitante) ? data.solicitante.descCel : '',
    solicitante_codCracha: (data && data.solicitante) ? data.solicitante.codCracha : '',
    solicitante_predio: (data && data.solicitante) ? data.solicitante.predio : '',
    solicitante_celula: (data && data.solicitante) ? data.solicitante.celula : '',
    solicitante_turno: (data && data.solicitante) ? data.solicitante.turno : '',
    destinatario_barcode: (data && data.destinatario) ? data.destinatario.barcode : '',
    destinatario_nome: (data && data.destinatario) ? data.destinatario.nome : '',
    destinatario_funcao: (data && data.destinatario) ? data.destinatario.funcao : '',
    destinatario_setor: (data && data.destinatario) ? data.destinatario.setor : '',
    destinatario_descCel: (data && data.destinatario) ? data.destinatario.descCel : '',
    destinatario_codCracha: (data && data.destinatario) ? data.destinatario.codCracha : '',
    destinatario_predio: (data && data.destinatario) ? data.destinatario.predio : '',
    destinatario_celula: (data && data.destinatario) ? data.destinatario.celula : '',
    destinatario_turno: (data && data.destinatario) ? data.destinatario.turno : '',
    ordem_pai: (data && data.ordem) ? data.ordem.pai : '',
    ordem_rep: (data && data.ordem) ? data.ordem.rep : '',
    ordem_req: (data && data.ordem) ? data.ordem.req : '',
    ordem_prioridade: (data && data.ordem) ? data.ordem.prioridade : '',
    ordem_marca: (data && data.ordem) ? data.ordem.marca : '',
    ordem_modelo: (data && data.ordem) ? data.ordem.modelo : '',
    ordem_combinacao: (data && data.ordem) ? data.ordem.combinacao : '',
    ordem_documento: (data && data.ordem) ? data.ordem.documento : '',
    ordem_tipo: (data && data.ordem) ? data.ordem.tipo : '',
    ordem_dataFecha: (data && data.ordem) ? data.ordem.dataFecha : '',
    ordem_semana: (data && data.ordem) ? data.ordem.semana : '',
    ordem_giro: (data && data.ordem) ? data.ordem.giro : '',
    entrega_barcode: (data && data.entrega) ? data.entrega.barcode : '',
    entrega_nome: (data && data.entrega) ? data.entrega.nome : '',
    entrega_descCel: (data && data.entrega) ? data.entrega.descCel : '',
    entrega_turno: (data && data.entrega) ? data.entrega.turno : '',
    entrega_funcao: (data && data.entrega) ? data.entrega.funcao : ''
  };
  
  return appendRow('PCP_Data', flatData);
}

function getSheetData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    // Adiciona o número da linha para facilitar updates/deletes
    obj._rowIndex = i + 1;
    result.push(obj);
  }
  
  return result;
}

function appendRow(sheetName, dataObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = [];
  
  if (values.length === 0 || (values.length === 1 && values[0].join('') === '')) {
    headers = Object.keys(dataObj).filter(k => k !== '_rowIndex');
    sheet.appendRow(headers);
  } else {
    headers = values[0];
  }
  
  // Se não tiver ID, gera um
  if (!dataObj.id && !dataObj.ID && headers.indexOf('id') !== -1) {
    dataObj.id = Utilities.getUuid();
  }
  
  var rowToInsert = [];
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    rowToInsert.push(dataObj[header] !== undefined ? dataObj[header] : '');
  }
  
  var newKeys = Object.keys(dataObj).filter(function(key) { 
    return key !== '_rowIndex' && headers.indexOf(key) === -1; 
  });
  
  if (newKeys.length > 0) {
    for (var k = 0; k < newKeys.length; k++) {
      headers.push(newKeys[k]);
      sheet.getRange(1, headers.length).setValue(newKeys[k]);
      rowToInsert.push(dataObj[newKeys[k]]);
    }
  }
  
  sheet.appendRow(rowToInsert);
  return dataObj;
}

function updateRow(sheetName, id, dataObj) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Planilha não encontrada");
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idColumnIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
  
  var rowIndex = -1;
  if (idColumnIndex !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColumnIndex]).trim() === String(id).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
  } else {
    // Tenta usar _rowIndex diretamente se disponível
    if (dataObj && dataObj._rowIndex) {
      var rIndex = Number(dataObj._rowIndex);
      if (rIndex > 1 && rIndex <= data.length) {
        rowIndex = rIndex;
      }
    }
    
    // Se não encontrou por _rowIndex, tenta buscar por Lote, LOTE ou Ordem
    if (rowIndex === -1) {
      var possibleKeys = ['Lote', 'LOTE', 'Ordem', 'ORDEM', 'Cod Produto', 'COD. PRODUTO', 'CÓD. PRODUTO'];
      for (var k = 0; k < possibleKeys.length; k++) {
        var colIdx = headers.indexOf(possibleKeys[k]);
        if (colIdx !== -1) {
          for (var i = 1; i < data.length; i++) {
            if (String(data[i][colIdx]) === String(id)) {
              rowIndex = i + 1;
              break;
            }
          }
          if (rowIndex !== -1) break;
        }
      }
    }
  }
  
  if (rowIndex === -1) {
    // Se ainda assim não encontrou e o id começa com wip-
    if (String(id).indexOf('wip-') === 0) {
      var idxFromId = parseInt(String(id).substring(4));
      if (!isNaN(idxFromId) && (idxFromId + 2) <= data.length) {
        rowIndex = idxFromId + 2; // w + 2
      }
    }
  }
  
  if (rowIndex === -1) throw new Error("Registro não encontrado para id: " + id);
  
  for (var key in dataObj) {
    if (key === 'id' || key === 'ID' || key === '_rowIndex') continue;
    
    var colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(dataObj[key]);
    } else {
      // Adiciona nova coluna se não existir
      headers.push(key);
      sheet.getRange(1, headers.length).setValue(key);
      sheet.getRange(rowIndex, headers.length).setValue(dataObj[key]);
    }
  }
  
  return { success: true, id: id };
}

function deleteRow(sheetName, id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Planilha não encontrada");
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idColumnIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
  
  var rowIndex = -1;
  if (idColumnIndex !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColumnIndex]).trim() === String(id).trim()) {
        rowIndex = i + 1;
        break;
      }
    }
  } else {
    // Tenta buscar por Lote, LOTE ou Ordem
    var possibleKeys = ['Lote', 'LOTE', 'Ordem', 'ORDEM', 'Cod Produto', 'COD. PRODUTO', 'CÓD. PRODUTO'];
    for (var k = 0; k < possibleKeys.length; k++) {
      var colIdx = headers.indexOf(possibleKeys[k]);
      if (colIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][colIdx]) === String(id)) {
            rowIndex = i + 1;
            break;
          }
        }
        if (rowIndex !== -1) break;
      }
    }
  }
  
  if (rowIndex === -1) {
    if (String(id).indexOf('wip-') === 0) {
      var idxFromId = parseInt(String(id).substring(4));
      if (!isNaN(idxFromId) && (idxFromId + 2) <= data.length) {
        rowIndex = idxFromId + 2;
      }
    }
  }
  
  if (rowIndex === -1) throw new Error("Registro não encontrado para exclusão");
  
  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ==========================================
// JUNÇÃO E PROCESSAMENTO PCP (Wip042, Follow Asics, 139 BD)
// ==========================================

function getColumnLetter(colIndex) {
  var letter = "";
  var temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function getSheetData139() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('139 BD');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  // Linha 2 contém cabecalho (index 1)
  var headers = data[1];
  var result = [];
  
  for (var i = 2; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = String(headers[j]).trim();
      var colLetter = getColumnLetter(j);
      var val = data[i][j];
      
      if (headerName) {
        obj[headerName] = val;
      }
      obj[colLetter] = val;
    }
    obj._rowIndex = i + 1;
    result.push(obj);
  }
  return result;
}

function getSheetData042BD() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BD ASICS NOVO') || ss.getSheetByName('042 BD');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = String(headers[j]).trim();
      var colLetter = getColumnLetter(j);
      var val = data[i][j];
      
      if (headerName) {
        obj[headerName] = val;
      }
      obj[colLetter] = val;
    }
    obj._rowIndex = i + 1;
    result.push(obj);
  }
  return result;
}

// Helper para ler valores de forma robusta e tolerante a acentos e espaços vazios
function getValFromRow(row, keyName) {
  if (!row) return '';
  if (row[keyName] !== undefined && row[keyName] !== null) {
    return String(row[keyName]);
  }
  
  var normKey = String(keyName).toLowerCase()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
    
  for (var actualKey in row) {
    var normActual = String(actualKey).toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');
      
    if (normKey === normActual) {
      return String(row[actualKey]);
    }
  }
  return '';
}

function getMergedPCPData() {
  var wipData = getSheetData('Wip042');
  var followData = getSheetData('Follow Asics');
  var bdData = getSheetData139();
  var b042Data = getSheetData042BD();
  
  var followMap = {};
  for (var f = 0; f < followData.length; f++) {
    var flote = String(getValFromRow(followData[f], 'Lote') || '').trim().toUpperCase();
    if (flote) {
      followMap[flote] = followData[f];
    }
  }
  
  var bdMap = {};
  for (var b = 0; b < bdData.length; b++) {
    var blote = String(getValFromRow(bdData[b], 'Lote') || getValFromRow(bdData[b], 'Ordem') || '').trim().toUpperCase();
    if (blote) {
      bdMap[blote] = bdData[b];
    }
  }
  
  var b042Map = {};
  for (var k = 0; k < b042Data.length; k++) {
    var keyLote = String(b042Data[k]['N'] || '').trim().toUpperCase();
    if (keyLote) {
      b042Map[keyLote] = b042Data[k];
    }
  }
  
  var merged = [];
  
  for (var w = 0; w < wipData.length; w++) {
    var row = wipData[w];
    var wlote = String(getValFromRow(row, 'Lote') || '').trim().toUpperCase();
    
    var followRow = wlote ? followMap[wlote] : null;
    var bdRow = wlote ? bdMap[wlote] : null;
    
    var pcpRow = {};
    pcpRow['id'] = row['id'] || row['ID'] || getValFromRow(row, 'Ordem') || ("wip-" + w);
    pcpRow['_rowIndex'] = row._rowIndex;
    
    // Mapeamentos estritos conforme solicitação do usuário
    pcpRow['LINHA / FÁBRICA'] = getValFromRow(row, 'LINHA APOIO') || getValFromRow(row, 'LINHA / FÁBRICA') || '';
    pcpRow['LINHAS ANTIGAS'] = getValFromRow(row, 'LINHAS ANTIGAS') || '';
    pcpRow['LINHA SERIG'] = getValFromRow(row, 'LINHA SERIGRAFIA') || getValFromRow(row, 'LINHA SERIG') || '';
    pcpRow['FALTAS'] = getValFromRow(row, 'FALTAS') || '';
    pcpRow['ABAST PRÉ'] = getValFromRow(row, 'ABAST PRÉ') || getValFromRow(row, 'ABAST PRE') || '';
    pcpRow['GIRO FAB'] = getValFromRow(row, 'GIRO FAB') || '';
    pcpRow['SOLA EXTERIOR OK'] = getValFromRow(row, 'SOLA EXTERIOR OK') || '';
    pcpRow['CÓD. PRODUTO'] = getValFromRow(row, 'Cod Produto') || getValFromRow(row, 'CÓD. PRODUTO') || '';
    pcpRow['MARCA'] = getValFromRow(row, 'Marca') || getValFromRow(row, 'MARCA') || '';
    pcpRow['FAMÍLIA MONTAGEM'] = getValFromRow(row, 'FAMÍLIA MONTAGEM') || getValFromRow(row, 'FAMILIA MONTAGEM') || '';
    pcpRow['SEMANA ORIGINAL'] = getValFromRow(row, 'Semana Original') || getValFromRow(row, 'SEMANA ORIGINAL') || '';
    pcpRow['DT. EMBARQUE'] = getValFromRow(row, 'DATA_EMBARQUE') || getValFromRow(row, 'DT. EMBARQUE') || '';
    pcpRow['SEMANA PRODUÇÃO'] = getValFromRow(row, 'Semana') || getValFromRow(row, 'SEMANA PRODUÇÃO') || '';
    pcpRow['NOME PRODUTO'] = getValFromRow(row, 'Nome Produto') || getValFromRow(row, 'NOME PRODUTO') || '';
    pcpRow['LOTE'] = getValFromRow(row, 'Lote') || getValFromRow(row, 'LOTE') || '';
    pcpRow['COR (COR DO TALÃO)'] = getValFromRow(row, 'Cor') || getValFromRow(row, 'COR (COR DO TALÃO)') || '';
    pcpRow['QTD. PROGRAMADA'] = getValFromRow(row, 'Qtd. Programada') || getValFromRow(row, 'QTD. PROGRAMADA') || '';
    pcpRow['STATUS DA OPERAÇÃO'] = getValFromRow(row, 'STATUS DA OPERAÇÃO') || '';
    
    // FOLLOW M2 e FOLLOW UND: PROCV na aba Follow Asics, traz coluna IMPORT 042 (se retornar 1-MPOK é OK, se não FALTA MP)
    var import042 = '';
    if (followRow) {
      import042 = String(getValFromRow(followRow, 'IMPORT 042') || '').trim();
    }
    
    var followVal = '';
    if (!wlote) {
      followVal = '';
    } else {
      var normImport = import042.toUpperCase().replace(/\s+/g, '');
      var isMpokOk = (normImport === '1-MPOK' || normImport.indexOf('1-MPOK') !== -1 || normImport.indexOf('MPOK') !== -1);
      followVal = isMpokOk ? 'OK' : 'FALTA MP';
    }
    
    pcpRow['FOLLOW M2'] = followVal;
    pcpRow['FOLLOW UND'] = followVal;
    
    pcpRow['FOLLOW SOLA'] = getValFromRow(row, 'FOLLOW SOLA') || '';
    pcpRow['SEPAR. SERIGRAFIA'] = getValFromRow(row, 'SEPAR. SERIGRAFIA') || '';
    
    // Trazendo dados do 139 BD
    if (bdRow) {
      pcpRow['ESTOQUE'] = bdRow['ESTOQUE M²'] || bdRow['AH'] || '';
      pcpRow['CONJUNTO'] = bdRow['CONJUNTO'] || '';
      pcpRow['ABAST DUB'] = bdRow['DUBLAGEM'] || bdRow['ABAST_DUBLAGEM'] || bdRow['AJ'] || '';
      pcpRow['DUB LAGOA'] = bdRow['DUB LAGOA'] || '';
      pcpRow['QT CONTE'] = bdRow['QT CONTE'] || '';
      pcpRow['ENFESTO'] = bdRow['ENFESTO REALIZADO'] || bdRow['AM'] || '';
      pcpRow['CORTE'] = bdRow['CORTE'] || '';
      pcpRow['CARIMBO'] = bdRow['CARIMBO'] || '';
      pcpRow['LIN ATOM'] = bdRow['ENF ATOM'] || bdRow['AN'] || '';
      pcpRow['CONTRAFORT'] = bdRow['CONTRAFORTE'] || bdRow['AN'] || '';
      pcpRow['ATACADOR'] = bdRow['ATACADOR'] || bdRow['AQ'] || '';
      pcpRow['ENV AVIAMENTO'] = bdRow['ABAST_AVIAM'] || bdRow['AR'] || '';
      pcpRow['POSTE'] = bdRow['CORTE PONTE'] || bdRow['AS'] || '';
      pcpRow['AUTOMATICO'] = bdRow['ATOM'] || bdRow['AT'] || '';
      pcpRow['LECTRA'] = bdRow['LECTRA'] || bdRow['AU'] || '';
      pcpRow['REC SUPER'] = bdRow['REC_SUPER'] || bdRow['AW'] || '';
      pcpRow['KANBAN APOLO'] = bdRow['KANBAN APOIO'] || bdRow['AX'] || '';
    } else {
      pcpRow['ESTOQUE'] = getValFromRow(row, 'ESTOQUE') || '';
      pcpRow['CONJUNTO'] = getValFromRow(row, 'CONJUNTO') || '';
      pcpRow['ABAST DUB'] = getValFromRow(row, 'ABAST DUB') || '';
      pcpRow['DUB LAGOA'] = getValFromRow(row, 'DUB LAGOA') || '';
      pcpRow['QT CONTE'] = getValFromRow(row, 'QT CONTE') || '';
      pcpRow['ENFESTO'] = getValFromRow(row, 'ENFESTO') || '';
      pcpRow['CORTE'] = getValFromRow(row, 'CORTE') || '';
      pcpRow['CARIMBO'] = getValFromRow(row, 'CARIMBO') || '';
      pcpRow['LIN ATOM'] = getValFromRow(row, 'LIN ATOM') || '';
      pcpRow['CONTRAFORT'] = getValFromRow(row, 'CONTRAFORT') || '';
      pcpRow['ATACADOR'] = getValFromRow(row, 'ATACADOR') || '';
      pcpRow['ENV AVIAMENTO'] = getValFromRow(row, 'ENV AVIAMENTO') || '';
      pcpRow['POSTE'] = getValFromRow(row, 'POSTE') || '';
      pcpRow['AUTOMATICO'] = getValFromRow(row, 'AUTOMATICO') || '';
      pcpRow['LECTRA'] = getValFromRow(row, 'LECTRA') || '';
      pcpRow['REC SUPER'] = getValFromRow(row, 'REC SUPER') || '';
      pcpRow['KANBAN APOLO'] = getValFromRow(row, 'KANBAN APOLO') || '';
    }
    
    // SERIG CARROSSEL
    var val20_raw = getValFromRow(row, 'Serig Giro') || getValFromRow(row, 'SERIG GIRO') || '';
    var rawVal20 = String(val20_raw).trim();
    var serigCarrossel = (rawVal20 === '0' || rawVal20 === '' || rawVal20 === '-') ? 'OK' : val20_raw;
    pcpRow['SERIG CARROSSEL'] = serigCarrossel;
    
    pcpRow['DATA M2'] = getValFromRow(row, 'DATA M2') || '';
    pcpRow['DATA AVIAMENTOS'] = getValFromRow(row, 'DATA AVIAMENTOS') || '';
    pcpRow['DATA SERIGRAFIA'] = getValFromRow(row, 'DATA SERIGRAFIA') || '';
    pcpRow['INICIO CORTE / CORTE AUTO'] = getValFromRow(row, 'INICIO CORTE / CORTE AUTO') || '';
    pcpRow['DATA SUPERMERCADO'] = getValFromRow(row, 'DATA SUPERMERCADO') || '';
    pcpRow['DATA ORIGINAL'] = getValFromRow(row, 'DATA ORIGINAL') || '';
    pcpRow['TIPO DE MATERIAL'] = getValFromRow(row, 'TIPO DE MATERIAL') || '';
    pcpRow['"RETORNO" ALINHAMENTO'] = getValFromRow(row, '"RETORNO" ALINHAMENTO') || '';
    pcpRow['TURNO'] = getValFromRow(row, 'TURNO') || '';
    pcpRow['HORÁRIO'] = getValFromRow(row, 'HORÁRIO') || '';
    pcpRow['OBS'] = getValFromRow(row, 'OBS') || '';
    pcpRow['STATUS PUXADA'] = getValFromRow(row, 'STATUS PUXADA') || '';
    
    // STATUS SERIGRAFIA: SE(AD335=""; "Filtrar"; SE(AND(val20=0; val8=0); "SERIGRAFIA OK"; SE(AND(BB335<>"OK"; val8>0); "GIRO SERIGRAFIA"; "FALTA SERIGRAFIA")))
    // AD335 = Lote (wlote), BB335 = SERIG CARROSSEL, col20 = Serig Giro, col8 = Giro_Prod Cost
    
    var val20Str = '';
    var val8Str = '';
    
    // PROCV na aba BD ASICS NOVO / 042 BD
    if (wlote && b042Map[wlote]) {
      val20Str = b042Map[wlote]['AG'] !== undefined ? String(b042Map[wlote]['AG']) : '';
      val8Str = b042Map[wlote]['U'] !== undefined ? String(b042Map[wlote]['U']) : '';
    }
    
    // Fallback se não localizado na aba de apoio
    if (val20Str === '') {
      val20Str = String(getValFromRow(row, 'Serig Giro') || getValFromRow(row, 'SERIG GIRO') || '0');
    }
    if (val8Str === '') {
      val8Str = String(getValFromRow(row, 'Giro_Prod Cost') || getValFromRow(row, 'GIRO_PROD COST') || '0');
    }
    
    var cleanVal20 = val20Str.trim();
    var cleanVal8 = val8Str.trim();
    if (cleanVal20 === '' || cleanVal20 === '-') cleanVal20 = '0';
    if (cleanVal8 === '' || cleanVal8 === '-') cleanVal8 = '0';
    
    var val20Num = parseFloat(cleanVal20) || 0;
    var val8Num = parseFloat(cleanVal8) || 0;
    
    var statusSerigrafia = '';
    if (!wlote) {
      statusSerigrafia = 'Filtrar';
    } else if (val20Num === 0 && val8Num === 0) {
      statusSerigrafia = 'SERIGRAFIA OK';
    } else if (serigCarrossel !== 'OK' && val8Num > 0) {
      statusSerigrafia = 'GIRO SERIGRAFIA';
    } else {
      statusSerigrafia = 'FALTA SERIGRAFIA';
    }
    pcpRow['STATUS SERIGRAFIA'] = statusSerigrafia;
    
    // RETORNO NF / OBS GERAIS / DATA DE CHEGADA: PROCV retornando a coluna IMPORT 042 pura
    pcpRow['RETORNO NF / OBS GERAIS / DATA DE CHEGADA'] = import042;
    
    for (var colKey in row) {
      if (pcpRow[colKey] === undefined) {
        pcpRow[colKey] = row[colKey];
      }
    }
    
    merged.push(pcpRow);
  }
  
  return merged;
}

function reorderRows(sheetName, idList) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Planilha não encontrada: " + sheetName);
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  if (values.length <= 1) return { success: true };
  
  var headers = values[0];
  var idColumnIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
  if (idColumnIndex === -1) throw new Error("Coluna de ID não encontrada na planilha " + sheetName);
  
  // Mapeia linhas existentes por ID
  var rowMap = {};
  for (var i = 1; i < values.length; i++) {
    var idVal = String(values[i][idColumnIndex]);
    rowMap[idVal] = values[i];
  }
  
  // Re-monta os dados de acordo com a lista de IDs recebida
  var newValues = [headers];
  var matchedIds = {};
  
  for (var j = 0; j < idList.length; j++) {
    var reqId = String(idList[j]);
    if (rowMap[reqId]) {
      newValues.push(rowMap[reqId]);
      matchedIds[reqId] = true;
    }
  }
  
  // Mantém quaisquer outras linhas que não estavam na lista enviada para evitar perda de dados
  for (var i = 1; i < values.length; i++) {
    var idVal = String(values[i][idColumnIndex]);
    if (!matchedIds[idVal]) {
      newValues.push(values[i]);
    }
  }
  
  // Limpa e sobrescreve a planilha com os novos valores reordenados
  sheet.clearContents();
  sheet.getRange(1, 1, newValues.length, headers.length).setValues(newValues);
  
  return { success: true };
}

// ==========================================
// INTEGRADO: MOTOR DE BUSCA DE DOCUMENTOS E E-MAIL ROBUSTO
// ==========================================

var DRIVE_CONFIG = {
  PASTA_DOCUMENTOS: '0AOXxdWFOmscbUk9PVA',
  COLUNA_NOTAS_FISCAIS: 4,
  COLUNA_DOCUMENTOS: 12,
  COLUNA_INICIO_PDFS: 15,
  NUM_COLUNAS_PDFS: 11
};

function buscarDocumentosPorNotaFiscal() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follow-Up AWB') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AWB');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var fileLinks = carregarDicionarioArquivos(DRIVE_CONFIG.PASTA_DOCUMENTOS);
  var rangeBusca = sheet.getRange(2, 1, lastRow - 1, DRIVE_CONFIG.COLUNA_DOCUMENTOS);
  var valoresBusca = rangeBusca.getValues();
  var rangeLinksAtuais = sheet.getRange(2, DRIVE_CONFIG.COLUNA_INICIO_PDFS, lastRow - 1, DRIVE_CONFIG.NUM_COLUNAS_PDFS);
  var linksAtuais = rangeLinksAtuais.getValues();

  var totalLinksNovos = 0;

  for (var i = 0; i < valoresBusca.length; i++) {
    var nfTexto = String(valoresBusca[i][DRIVE_CONFIG.COLUNA_NOTAS_FISCAIS - 1]);
    var statusDoc = String(valoresBusca[i][DRIVE_CONFIG.COLUNA_DOCUMENTOS - 1]).trim();

    if (statusDoc === "" && nfTexto !== "") {
      var nfs = nfTexto.split(/[\s\/,|-]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n.length >= 3; });
      var rowLinks = [];

      for (var k = 0; k < nfs.length; k++) {
        var nf = nfs[k];
        for (var fileName in fileLinks) {
          if (fileName.indexOf(nf) !== -1 && rowLinks.indexOf(fileLinks[fileName]) === -1) {
            rowLinks.push(fileLinks[fileName]);
            if (rowLinks.length >= DRIVE_CONFIG.NUM_COLUNAS_PDFS) break;
          }
        }
      }

      if (rowLinks.length > 0) {
        for (var j = 0; j < DRIVE_CONFIG.NUM_COLUNAS_PDFS; j++) {
          linksAtuais[i][j] = rowLinks[j] || "";
        }
        totalLinksNovos += rowLinks.length;
      }
    }
  }

  rangeLinksAtuais.setValues(linksAtuais);
  atualizarStatusProcessamento(sheet, totalLinksNovos);
}

function carregarDicionarioArquivos(folderId) {
  var dict = {};
  try {
    var files = DriveApp.getFolderById(folderId).getFilesByType(MimeType.PDF);
    while (files.hasNext()) {
      var f = files.next();
      dict[f.getName()] = f.getUrl();
    }
  } catch (e) {
    console.error("Erro ao carregar dicionário de arquivos:", e.toString());
  }
  return dict;
}

function atualizarStatusProcessamento(sheet, total) {
  try {
    var status = "Sincronizado: " + new Date().toLocaleString('pt-BR') + " | +" + total + " links";
    sheet.getRange(1, DRIVE_CONFIG.COLUNA_INICIO_PDFS).setValue(status);
  } catch (e) {
    console.error("Erro ao atualizar status de processamento:", e.toString());
  }
}

function obterStatusBusca() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Follow-Up AWB') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AWB');
    return sheet.getRange(1, DRIVE_CONFIG.COLUNA_INICIO_PDFS).getValue();
  } catch (e) {
    return "Indisponível";
  }
}

function enviarEmailPersonalizado(awb, to, cc, bcc, customBody, sourceSheet) {
  if (!to) return;

  // Formatação de destinatários
  if (Array.isArray(to)) to = to.join(',');
  if (Array.isArray(cc)) cc = cc.join(',');
  if (Array.isArray(bcc)) bcc = bcc.join(',');

  var isPre = sourceSheet === 'PRÉ' || sourceSheet === 'PRÉ' || sourceSheet === 'PRE' || sourceSheet === 'PRÉ (novos)';
  var labelId = isPre ? "NF's" : "AWB NUMBER";
  var valueId = isPre 
    ? (awb["NF's"] || awb.nfs || awb.NFs || "N/A") 
    : (awb.AWB || awb.awbNumber || awb.Awb || awb.awb || "N/A");

  var brandName = awb.Marca || awb.marca || "N/A";
  var carrierName = awb.Transportadora || awb.transportadora || "LATAM CARGO";
  var materialDesc = awb.Material || awb.material || "Insumos/Matéria-Prima";
  var linkedNFs = awb.NFs || awb.nfs || "N/A";

  var subject = "Novo Embarque AWB - " + labelId + ": " + valueId + " (" + brandName + ")";
  var bodyText = customBody || awb.Observação || awb.observacao || awb.Observacao || "Sem observações adicionais.";
  
  // Link de rastreamento dinâmico e correto com base na transportadora / registro
  var trackingLink = awb.Rastreio || awb.rastreio || "https://aereodasspcpfollow.netlify.app/";

  // Cor do status dinâmica
  var statusText = awb.Status || awb.status || "EM TRÂNSITO";
  var statusColor = "#3b82f6"; // Azul para trânsito
  var statusBg = "#eff6ff";
  
  var statusUpper = String(statusText).toUpperCase().trim();
  if (statusUpper.indexOf("DISPONIVEL") !== -1 || statusUpper.indexOf("DISPONÍVEL") !== -1) {
    statusColor = "#10b981"; // Verde
    statusBg = "#ecfdf5";
  } else if (statusUpper.indexOf("CRITICO") !== -1 || statusUpper.indexOf("CRÍTICO") !== -1) {
    statusColor = "#ef4444"; // Vermelho
    statusBg = "#fef2f2";
  } else if (statusUpper.indexOf("AGUARDANDO") !== -1) {
    statusColor = "#f59e0b"; // Laranja
    statusBg = "#fffbeb";
  }

  var htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
      
      <!-- Header Corporativo -->
      <div style="background-color: #0f172a; padding: 36px 32px; color: white; border-bottom: 4px solid #f97316;">
        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #f97316; display: block; margin-bottom: 6px;">Notificação Automática</span>
        <h2 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Novo Embarque AWB</h2>
        <p style="margin: 6px 0 0 0; font-size: 12px; opacity: 0.75;">Portal de Logística & PCP - Grupo Dass</p>
      </div>
      
      <div style="padding: 32px; background-color: #ffffff;">
        
        <!-- Grid de Informações Detalhadas -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${labelId}</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: #0f172a; font-size: 15px; font-family: monospace;">${valueId}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Marca</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">${brandName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Fornecedor</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #334155; font-size: 13px;">${awb.Fornecedor || awb.fornecedor || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Transportadora</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #334155; font-size: 13px;">${carrierName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Notas Fiscais (NFs)</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #334155; font-size: 13px; font-family: monospace;">${linkedNFs}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Material Principal</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600; color: #334155; font-size: 13px;">${materialDesc}</td>
          </tr>
          <tr>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Status Atual</td>
            <td style="padding: 14px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">
              <span style="display: inline-block; background-color: ${statusBg}; color: ${statusColor}; padding: 6px 14px; border-radius: 99px; font-weight: 800; font-size: 11px; border: 1px solid ${statusColor}40; letter-spacing: 0.02em;">
                ${statusText}
              </span>
            </td>
          </tr>
        </table>
        
        <!-- Observações / Instruções Especiais -->
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 28px;">
          <h4 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Observações do Follow-UP</h4>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${bodyText}</p>
        </div>
        
        <!-- Ação Principal -->
        <div style="text-align: center; margin-top: 12px;">
          <a href="${trackingLink}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 13px; letter-spacing: 0.02em; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); transition: background-color 0.2s;">
            RASTREAR NA TRANSPORTADORA
          </a>
        </div>
        
      </div>
      
      <!-- Rodapé -->
      <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-t: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        Este é um e-mail automático enviado pelo Portal de Logística e Planejamento e Controle de Produção (PCP) do Grupo Dass. Por favor, não responda diretamente a este remetente.
      </div>
      
    </div>
  `;

  // Processamento de Anexos
  var attachments = [];
  var docLinks = [];
  
  // Coleta links do campo "Documentos" e colunas PDF_1 a PDF_11
  var rawDocs = awb.Documentos || awb.documentos;
  if (rawDocs) {
    String(rawDocs).split('|').forEach(function(l) { 
      if (l.indexOf("http") !== -1) docLinks.push(l.trim()); 
    });
  }
  
  for (var i = 1; i <= 11; i++) {
    var val = awb["PDF_" + i];
    if (val && String(val).indexOf("http") !== -1) {
      docLinks.push(String(val).trim());
    }
  }

  // Remove duplicados de links
  var uniqueLinks = [];
  for (var k = 0; k < docLinks.length; k++) {
    if (uniqueLinks.indexOf(docLinks[k]) === -1) {
      uniqueLinks.push(docLinks[k]);
    }
  }

  uniqueLinks.forEach(function(link) {
    try {
      var fileId = '';
      if (link.indexOf("/d/") !== -1) {
        fileId = link.split("/d/")[1].split("/")[0];
      } else if (link.indexOf("id=") !== -1) {
        fileId = link.split("id=")[1].split("&")[0];
      }
      if (fileId) {
        attachments.push(DriveApp.getFileById(fileId).getBlob());
      }
    } catch (e) { 
      console.warn("Erro ao anexar arquivo: " + link + " | Erro: " + e.toString()); 
    }
  });

  try {
    MailApp.sendEmail({
      to: to, 
      cc: cc || "", 
      bcc: bcc || "",
      subject: subject, 
      htmlBody: htmlBody, 
      attachments: attachments
    });
    console.log("✅ E-mail enviado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao enviar e-mail com MailApp:", err.toString());
  }
}

function importSheetData(data) {
  var sheetName = data.sheetName;
  var rows = data.rows;
  
  if (!sheetName) throw new Error("Nome da aba não fornecido");
  if (!rows || !Array.isArray(rows)) throw new Error("Dados de linhas inválidos");
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }
  
  if (rows.length === 0) {
    return { success: true, count: 0 };
  }
  
  // Extrai cabeçalhos de todas as linhas
  var headersSet = {};
  for (var i = 0; i < rows.length; i++) {
    var keys = Object.keys(rows[i]);
    for (var k = 0; k < keys.length; k++) {
      if (keys[k] !== '_rowIndex' && keys[k] !== '') {
        headersSet[keys[k]] = true;
      }
    }
  }
  var headers = Object.keys(headersSet);
  
  // Garante ID na primeira coluna se existir
  var idIdx = headers.indexOf('id');
  if (idIdx === -1) idIdx = headers.indexOf('ID');
  if (idIdx !== -1) {
    var idName = headers[idIdx];
    headers.splice(idIdx, 1);
    headers.unshift(idName);
  } else {
    headers.unshift('id');
  }
  
  var writeValues = [headers];
  for (var i = 0; i < rows.length; i++) {
    var rowObj = rows[i];
    var rowValues = [];
    
    // Auto-gera ID se estiver vazio
    if (!rowObj.id && !rowObj.ID) {
      rowObj.id = Utilities.getUuid();
    }
    
    for (var h = 0; h < headers.length; h++) {
      var header = headers[h];
      var val = rowObj[header];
      if (val === undefined || val === null) {
        val = '';
      }
      rowValues.push(val);
    }
    writeValues.push(rowValues);
  }
  
  sheet.getRange(1, 1, writeValues.length, headers.length).setValues(writeValues);
  return { success: true, count: rows.length };
}

