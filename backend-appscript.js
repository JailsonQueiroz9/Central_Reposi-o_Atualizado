function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var data = body.data;
    var result = null;

    switch (action) {
      case 'login':
        result = login(data);
        break;
      case 'register':
        result = register(data);
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
      case 'savePCPData':
        result = savePCPData(data);
        break;
      case 'reorderPCPRows':
        result = reorderRows(data.sheetName || 'Wip042', data.idList);
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
  var users = getSheetData('Usuário (cracha)');
  var searchTerm = String(data.cracha).trim();
  
  for (var i = 0; i < users.length; i++) {
    // Busca pelo CRACHA ou CHAPA
    if (String(users[i]['CRACHA']) === searchTerm || String(users[i]['CHAPA']) === searchTerm) {
      return users[i];
    }
  }
  throw new Error("Usuário não encontrado com este crachá/chapa");
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
  var materias = getSheetData('Matérias');
  var searchTerm = String(data.produto).trim().toLowerCase();
  
  for (var i = 0; i < materias.length; i++) {
    var prod = String(materias[i]['Produto'] || materias[i]['PRODUTO'] || materias[i]['produto'] || '').trim().toLowerCase();
    if (prod === searchTerm) {
      return materias[i];
    }
  }
  throw new Error("Material não encontrado");
}

function savePCPData(data) {
  var flatData = {
    id: data.id || Utilities.getUuid(),
    solicitante_barcode: data.solicitante.barcode,
    solicitante_nome: data.solicitante.nome,
    solicitante_funcao: data.solicitante.funcao,
    solicitante_setor: data.solicitante.setor,
    solicitante_descCel: data.solicitante.descCel,
    solicitante_codCracha: data.solicitante.codCracha,
    solicitante_predio: data.solicitante.predio,
    solicitante_celula: data.solicitante.celula,
    solicitante_turno: data.solicitante.turno,
    destinatario_barcode: data.destinatario.barcode,
    destinatario_nome: data.destinatario.nome,
    destinatario_funcao: data.destinatario.funcao,
    destinatario_setor: data.destinatario.setor,
    destinatario_descCel: data.destinatario.descCel,
    destinatario_codCracha: data.destinatario.codCracha,
    destinatario_predio: data.destinatario.predio,
    destinatario_celula: data.destinatario.celula,
    destinatario_turno: data.destinatario.turno,
    ordem_pai: data.ordem.pai,
    ordem_rep: data.ordem.rep,
    ordem_req: data.ordem.req,
    ordem_prioridade: data.ordem.prioridade,
    ordem_marca: data.ordem.marca,
    ordem_modelo: data.ordem.modelo,
    ordem_combinacao: data.ordem.combinacao,
    ordem_documento: data.ordem.documento,
    ordem_tipo: data.ordem.tipo,
    ordem_dataFecha: data.ordem.dataFecha,
    ordem_semana: data.ordem.semana,
    ordem_giro: data.ordem.giro,
    entrega_barcode: data.entrega.barcode,
    entrega_nome: data.entrega.nome,
    entrega_descCel: data.entrega.descCel,
    entrega_turno: data.entrega.turno,
    entrega_funcao: data.entrega.funcao
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
  
  if (idColumnIndex === -1) throw new Error("Coluna de ID não encontrada");
  
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(id)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) throw new Error("Registro não encontrado");
  
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
  
  if (idColumnIndex === -1) throw new Error("Coluna de ID não encontrada");
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  throw new Error("Registro não encontrado");
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
