/**
 * Document and PDF Text Extractor
 * Uses PDF.js for reliable extraction from compressed/modern PDFs.
 */

let pdfjsLib = null;

async function getPdfjsLib() {
  if (pdfjsLib) return pdfjsLib;

  // Load PDF.js from local extension copy
  const pdfJsUrl = browser.runtime.getURL('src/utils/pdfjs/pdf.min.js');
  await import(pdfJsUrl);

  pdfjsLib = window['pdfjs-dist/build/pdf'];
  if (!pdfjsLib) {
    // fallback global name used by some builds
    pdfjsLib = window.pdfjsLib;
  }

  if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      browser.runtime.getURL('src/utils/pdfjs/pdf.worker.min.js');
  }

  return pdfjsLib;
}

export class DocumentReader {
  /**
   * Reads a file and extracts its readable text content
   * @param {File} file
   * @returns {Promise<{ name, type, size, text, preview }>}
   */
  static async readFile(file) {
    const fileName = file.name;
    const fileType = file.type || '';
    const fileSize = file.size;

    let text = '';

    if (
      fileType.includes('text') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.csv')
    ) {
      text = await this.readAsText(file);
    } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
      text = await this.extractPdfText(file);
    } else {
      text = await this.readAsText(file).catch(
        () => 'Binary content: text extraction not supported.'
      );
    }

    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return {
      name: fileName,
      type: fileType || 'application/octet-stream',
      size: fileSize,
      text: cleanText,
      preview: cleanText,
      uploadedAt: new Date().toISOString()
    };
  }

  static readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  }

  static readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read array buffer'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extracts text from a PDF using PDF.js, with regex fallback for old/simple PDFs.
   */
  static async extractPdfText(file) {
    // --- Try PDF.js first (handles compressed streams, modern PDFs) ---
    try {
      const lib = await getPdfjsLib();
      if (lib) {
        const buffer = await this.readAsArrayBuffer(file);
        const pdf = await lib.getDocument({ data: buffer }).promise;
        const pageTexts = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          if (pageText.trim()) pageTexts.push(pageText.trim());
        }

        if (pageTexts.length > 0) {
          return pageTexts.join('\n\n');
        }
      }
    } catch (err) {
      console.warn('[PDF.js] Extraction failed, trying regex fallback:', err.message);
    }

    // --- Regex fallback for simple/uncompressed PDFs ---
    try {
      const buffer = await this.readAsArrayBuffer(file);
      const content = new TextDecoder('latin1').decode(new Uint8Array(buffer));
      const words = [];

      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let m;
      while ((m = tjRegex.exec(content)) !== null) {
        const s = m[1].replace(/\\([()\\])/g, '$1').trim();
        if (s.length > 0) words.push(s);
      }

      const arrayRegex = /\[(.*?)\]\s*TJ/g;
      while ((m = arrayRegex.exec(content)) !== null) {
        const inner = m[1];
        const innerRegex = /\(([^)]+)\)/g;
        let im, line = '';
        while ((im = innerRegex.exec(inner)) !== null) {
          line += im[1].replace(/\\([()\\])/g, '$1') + ' ';
        }
        if (line.trim()) words.push(line.trim());
      }

      if (words.length > 0) return words.join(' ');
    } catch (err) {
      console.warn('[PDF regex fallback] failed:', err.message);
    }

    return `[PDF: ${file.name} — text extraction failed. Please upload a TXT or MD version of your resume for best results.]`;
  }
}
