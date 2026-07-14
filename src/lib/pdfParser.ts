// Client-side PDF Parser using PDF.js

export interface ParsedPdfData {
  ChaveDeAcesso: string;
  NumeroNF: string;
  Fornecedor: string;
  Transportadora: string;
  Material: string;
  DataSaida: string;
  Awb: string;
  Observacao: string;
}

const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const parsePdfContent = async (pdfDataUrl: string, fileName: string): Promise<ParsedPdfData> => {
  const result: ParsedPdfData = {
    ChaveDeAcesso: '',
    NumeroNF: '',
    Fornecedor: '',
    Transportadora: 'LATAM',
    Material: '',
    DataSaida: '',
    Awb: '',
    Observacao: 'Importado via PDF'
  };

  try {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      console.warn("PDF.js library not found on window. Falling back to filename extraction.");
      return extractFromFilename(fileName);
    }

    // Set worker source to CDN matching the library version in index.html
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const arrayBuffer = dataUrlToArrayBuffer(pdfDataUrl);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    // Limit to parsing the first 3 pages to avoid performance issues
    const pagesToParse = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= pagesToParse; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    console.log("Parsed PDF Text Content Length:", fullText.length);

    // 1. CHAVE DE ACESSO (44 consecutive digits, or spaces/dots separated)
    // Clean spaces, dots, dashes first to find 44 digits
    const cleanedForChave = fullText.replace(/[\s\.\-\/]+/g, '');
    const chaveMatch = cleanedForChave.match(/\d{44}/);
    if (chaveMatch) {
      result.ChaveDeAcesso = chaveMatch[0];
      // 2. NÚMERO NF (extracted directly and accurately from Chave de Acesso)
      // Digits 25 to 34 (0-indexed) are the NF-e number
      result.NumeroNF = result.ChaveDeAcesso.substring(25, 34).replace(/^0+/, '');
    }

    // Fallback NF extraction if Chave is not found
    if (!result.NumeroNF) {
      const nfMatch = fullText.match(/(?:NF-e\s*Nº|Nº|Numero|Número|Nota\s*Fiscal)\s*:?\s*(\d+)/i);
      if (nfMatch) {
        result.NumeroNF = nfMatch[1];
      }
    }

    // 3. FORNECEDOR (Emitente)
    let foundFornecedor = '';

    // First attempt: match standard receipt box ("canhoto") of the DANFE
    const receiptMatch = fullText.match(/RECEBEMOS\s+DE\s+(.+?)\s+(?:OS\s+PRODUTOS|OS\s+SERVICOS|OS\s+SERVIÇOS|OS\s+PROD|E\/OU)/i);
    if (receiptMatch) {
      const candidate = receiptMatch[1].trim();
      if (candidate.length > 3 && candidate.length < 100) {
        const cleaned = candidate
          .replace(/https?:\/\/\S+/gi, '')
          .replace(/www\.\S+/gi, '')
          .replace(/^[\s\.\-\/]+|[\s\.\-\/]+$/g, '')
          .trim();
        if (cleaned && !/\b(?:CEP|RUA|AV|AVENIDA|FONE|TELEFONE|CNPJ|IE)\b/i.test(cleaned)) {
          foundFornecedor = cleaned;
        }
      }
    }

    // Second attempt: scan lines with robust filters if receipt match is not found
    if (!foundFornecedor) {
      const lines = fullText.split('\n');
      for (const line of lines) {
        // Skip URLs, email addresses and receipt noises
        if (/https?:\/\/|www\.|\.com|\.net|\.org|@|duplicata|consulta/i.test(line)) {
          continue;
        }

        // Look for Brazilian corporate suffix
        if (/\b(?:LTDA|S\/A|S\.A\.|LIMITADA|EIRELI|COOPERATIVA|IND\.|COM\.)\b/i.test(line)) {
          // Remove common noises
          let cleaned = line
            .replace(/(?:EMITENTE|NOME|RAZÃO SOCIAL|RAZAO SOCIAL|DESTINATÁRIO|TRANSPORTADOR|PRODUTO|SERVIÇO)\s*:?/i, '')
            .replace(/[^A-Za-z0-9\s\.\&\-\/]/g, '')
            .trim();
          
          // Remove leading/trailing dashes or symbols
          cleaned = cleaned.replace(/^[\s\.\-\/]+|[\s\.\-\/]+$/g, '').trim();

          // Check if length is appropriate for a company name
          if (cleaned.length > 5 && cleaned.length < 80) {
            // Exclude lines that are clearly addresses or other noise
            if (!/\b(?:CEP|RUA|AV|AVENIDA|FONE|TELEFONE|CNPJ|IE|CONTRA|VALOR|DUPLICATA)\b/i.test(cleaned)) {
              foundFornecedor = cleaned;
              break;
            }
          }
        }
      }
    }

    result.Fornecedor = foundFornecedor || extractCompanyNameFromText(fullText) || "Fornecedor PDF";

    // 4. DATA DE EMISSÃO / SAÍDA
    // Look for a date near emission/saida keywords
    const emissionMatch = fullText.match(/(?:EMISSÃO|EMISSAO|SAÍDA|SAIDA|DATA|EMITIDO)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (emissionMatch) {
      // Convert to standard YYYY-MM-DD input format
      const parts = emissionMatch[1].split('/');
      if (parts.length === 3) {
        result.DataSaida = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    } else {
      // General date pattern fallback
      const generalDateMatch = fullText.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      if (generalDateMatch) {
        result.DataSaida = `${generalDateMatch[3]}-${generalDateMatch[2]}-${generalDateMatch[1]}`;
      }
    }

    // 5. TRANSPORTADORA
    if (/LATAM|TAM/i.test(fullText)) {
      result.Transportadora = 'LATAM';
    } else if (/GOL|GOLLOG/i.test(fullText)) {
      result.Transportadora = 'GOL';
    } else if (/AZUL/i.test(fullText)) {
      result.Transportadora = 'AZUL';
    }

    // 6. MATERIAL
    // Look for product/item keywords or extract a general material type
    if (/ROLOS|BOBINAS|TECIDO|MALHA/i.test(fullText)) {
      result.Material = 'BOBINAS E ROLOS DE MALHA';
    } else if (/SOLADO|BORRACHA|PVC/i.test(fullText)) {
      result.Material = 'SOLADOS E ACESSÓRIOS';
    } else if (/PALMILHA|TERMOMOLD/i.test(fullText)) {
      result.Material = 'PALMILHAS TERMOMOLDADAS';
    } else if (/LINHA|FIOS|CORDÕES/i.test(fullText)) {
      result.Material = 'LINHAS E AVIAMENTOS';
    } else {
      // Try to find a line with product descriptions
      const descMatch = fullText.match(/(?:DESCRIÇÃO DOS PRODUTOS|DESCRIÇÃO DO PRODUTO|DADOS DOS PRODUTOS|PRODUTOS)\s+(.+?)(?:DADOS ADICIONAIS|INFORMAÇÕES COMPLEMENTARES|$)/i);
      if (descMatch && descMatch[1].trim().length > 5) {
        result.Material = descMatch[1].trim().substring(0, 50).toUpperCase();
      } else {
        result.Material = 'MATÉRIA PRIMA';
      }
    }

    // 7. AWB / Air Waybill
    const awbMatch = fullText.match(/(?:AWB|CONHECIMENTO|AIR\s*WAYBILL|HWB|Nº\s*CONHECIMENTO)\s*:?\s*([A-Z0-9\-]{6,15})/i);
    if (awbMatch) {
      result.Awb = awbMatch[1];
    } else {
      // Use numeric code from filename or general 11-digit patterns
      const codeMatch = fileName.match(/\b\d{11}\b/);
      if (codeMatch) {
        result.Awb = codeMatch[0];
      }
    }

  } catch (error) {
    console.error("Error parsing PDF via PDF.js:", error);
    return extractFromFilename(fileName);
  }

  return result;
};

// Helper to extract company name from top lines of the PDF text
function extractCompanyNameFromText(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  // Scan first 10 non-empty lines for potential company name
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (/\b(?:SA|LTDA|S\.A|LTD|CORP|INC|LIMITADA)\b/i.test(line)) {
      return line.substring(0, 50);
    }
  }
  return null;
}

// Resilient fallback: parse filename to extract fields if PDF parsing fails
export const extractFromFilename = (fileName: string): ParsedPdfData => {
  const result: ParsedPdfData = {
    ChaveDeAcesso: '',
    NumeroNF: '',
    Fornecedor: '',
    Transportadora: 'LATAM',
    Material: 'MATÉRIA PRIMA',
    DataSaida: new Date().toISOString().substring(0, 10),
    Awb: '',
    Observacao: 'Importado do arquivo ' + fileName
  };

  // Strip digits
  const digits = fileName.replace(/\D/g, '');

  if (digits.length >= 44) {
    result.ChaveDeAcesso = digits.substring(0, 44);
    result.NumeroNF = result.ChaveDeAcesso.substring(25, 34).replace(/^0+/, '');
  } else if (digits.length >= 6) {
    result.NumeroNF = digits.substring(0, 9);
  }

  // Parse supplier/material guesses from filename keywords
  const nameUpper = fileName.toUpperCase();
  if (nameUpper.includes('LATAM')) result.Transportadora = 'LATAM';
  else if (nameUpper.includes('GOL') || nameUpper.includes('GOLLOG')) result.Transportadora = 'GOL';
  else if (nameUpper.includes('AZUL')) result.Transportadora = 'AZUL';

  if (nameUpper.includes('BRANYL')) result.Fornecedor = 'BRANYL COM. IND. TEXTIL LTDA.';
  else if (nameUpper.includes('NOVANOR')) result.Fornecedor = 'NOVANOR';
  else if (nameUpper.includes('SINTEX')) result.Fornecedor = 'SINTEX TEXTIL LTDA';
  else if (nameUpper.includes('DASS')) result.Fornecedor = 'DASS PRINT LTDA';
  else result.Fornecedor = 'FORNECEDOR IMPORTADO';

  if (nameUpper.includes('INVOICE')) {
    result.Material = 'MATERIAIS IMPORTADOS';
  } else if (nameUpper.includes('PACKING')) {
    result.Material = 'EMBALAGENS / SOLADOS';
  }

  return result;
};
