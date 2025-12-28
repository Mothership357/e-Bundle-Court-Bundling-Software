
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BundleConfig, BundleDocument, BundleSection, IndexLayout } from '../types';

export async function generateBundle(config: BundleConfig): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
  
  // Default positions if not provided (relative to bottom-left 0,0)
  const defaultLayout: IndexLayout = {
    caseName: { x: 50, y: 760 },
    caseNumber: { x: 50, y: 745 },
    courtName: { x: 50, y: 730 }
  };
  const layout = config.indexLayout || defaultLayout;

  // 1. Calculate Page Numbers for Index
  let currentPage = 1;
  const estimatedIndexPages = Math.ceil((config.sections.reduce((acc, s) => acc + s.documents.length + 1, 0) + 5) / 25) || 1;
  currentPage = estimatedIndexPages + 1;

  const processedSections: { section: BundleSection; docsWithPages: { doc: BundleDocument; startPage: number }[] }[] = [];

  for (const section of config.sections) {
    const sectionDocs: { doc: BundleDocument; startPage: number }[] = [];
    currentPage++; // Section separator page
    for (const doc of section.documents) {
      sectionDocs.push({ doc, startPage: currentPage });
      currentPage += doc.pageCount;
    }
    processedSections.push({ section, docsWithPages: sectionDocs });
  }

  // 2. Generate Index Page(s)
  for (let i = 0; i < estimatedIndexPages; i++) {
    const indexPage = mergedPdf.addPage([595.28, 841.89]); // A4
    const { width, height } = indexPage.getSize();
    
    if (i === 0) {
      indexPage.drawText('INDEX', { x: width / 2 - 20, y: height - 50, size: 16, font: boldFont });
      
      // Use custom layout positions
      indexPage.drawText(`Case: ${config.caseName}`, { x: layout.caseName.x, y: layout.caseName.y, size: 10, font });
      indexPage.drawText(`Case No: ${config.caseNumber}`, { x: layout.caseNumber.x, y: layout.caseNumber.y, size: 10, font });
      indexPage.drawText(`Court: ${config.courtName}`, { x: layout.courtName.x, y: layout.courtName.y, size: 10, font });
      
      indexPage.drawText('Document Name', { x: 50, y: 680, size: 10, font: boldFont });
      indexPage.drawText('Date', { x: 400, y: 680, size: 10, font: boldFont });
      indexPage.drawText('Page', { x: 500, y: 680, size: 10, font: boldFont });
    }

    let yOffset = i === 0 ? 655 : height - 50;
    const itemsPerPage = 32;
    const startIndex = i * itemsPerPage;
    
    const allEntries: any[] = [];
    config.sections.forEach((s, sIdx) => {
      allEntries.push({ title: s.title.toUpperCase(), isSection: true });
      s.documents.forEach((d) => {
        const startPage = processedSections[sIdx].docsWithPages.find(p => p.doc.id === d.id)?.startPage;
        const pageLabel = d.isLateAddition ? `${d.latePrefix}1` : `${startPage}`;
        allEntries.push({ title: d.name, date: d.date, pageLabel, isSection: false });
      });
    });

    for (let j = startIndex; j < Math.min(startIndex + itemsPerPage, allEntries.length); j++) {
      const entry = allEntries[j];
      if (entry.isSection) {
        indexPage.drawText(entry.title, { x: 50, y: yOffset, size: 11, font: boldFont });
      } else {
        indexPage.drawText(entry.title, { x: 60, y: yOffset, size: 10, font });
        indexPage.drawText(entry.date || '-', { x: 400, y: yOffset, size: 10, font });
        indexPage.drawText(entry.pageLabel, { x: 500, y: yOffset, size: 10, font });
      }
      yOffset -= 18;
    }
  }

  // 3. Merge Documents and Add Separators
  let globalPageCounter = estimatedIndexPages + 1;

  for (const { section, docsWithPages } of processedSections) {
    const sepPage = mergedPdf.addPage([595.28, 841.89]);
    const { width, height } = sepPage.getSize();
    sepPage.drawText(section.title.toUpperCase(), { 
      x: width / 2 - (section.title.length * 4), 
      y: height / 2, 
      size: 24, 
      font: boldFont 
    });
    
    sepPage.drawText(`Page ${globalPageCounter}`, { x: width - 80, y: 30, size: 10, font });
    globalPageCounter++;

    for (const { doc } of docsWithPages) {
      if (!doc.file && !doc.base64Data) continue;
      
      let docUint8: Uint8Array;
      if (doc.file) {
        docUint8 = new Uint8Array(await doc.file.arrayBuffer());
      } else {
        const binaryString = atob(doc.base64Data!);
        docUint8 = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          docUint8[i] = binaryString.charCodeAt(i);
        }
      }

      const externalPdf = await PDFDocument.load(docUint8);
      const copiedPages = await mergedPdf.copyPages(externalPdf, externalPdf.getPageIndices());
      
      copiedPages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const pageLabel = doc.isLateAddition ? `Page ${doc.latePrefix}${idx + 1}` : `Page ${globalPageCounter}`;
        page.drawText(pageLabel, { x: width - 80, y: 30, size: 10, font, color: rgb(0, 0, 0) });
        mergedPdf.addPage(page);
        globalPageCounter++;
      });
    }
  }

  return await mergedPdf.save();
}

export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}
