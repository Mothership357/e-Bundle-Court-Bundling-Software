
import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';
import { BundleConfig, BundleDocument, BundleSection, IndexLayout } from '../types';

function formatDate(dateStr: string, format: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (format === 'DD-MM-YYYY') return `${d}-${m}-${y}`;
  if (format === 'MM-DD-YYYY') return `${m}-${d}-${y}`;
  return `${y}-${m}-${d}`;
}

export async function generateBundle(config: BundleConfig): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
  
  const layout = config.indexLayout;
  const listStartY = layout.listStartY;

  // 1. Calculate Page Numbers for Index
  let currentPageNum = 1;
  const totalDocs = config.sections.reduce((acc, s) => acc + s.documents.length, 0);
  const totalEntries = totalDocs + config.sections.length;
  
  // Calculate how many items fit on the first page vs subsequent pages
  // First page starts at listStartY. Subsequent pages start near top.
  const firstPageCapacity = Math.floor((listStartY - 50) / 18);
  const otherPageCapacity = 40; 
  
  let estimatedIndexPages = 1;
  if (totalEntries > firstPageCapacity) {
    estimatedIndexPages += Math.ceil((totalEntries - firstPageCapacity) / otherPageCapacity);
  }
  
  currentPageNum = estimatedIndexPages + 1;

  const docTargetPages: Map<string, number> = new Map();
  const processedSections: { section: BundleSection; docsWithPages: { doc: BundleDocument; startPage: number }[] }[] = [];

  for (const section of config.sections) {
    const sectionDocs: { doc: BundleDocument; startPage: number }[] = [];
    currentPageNum++; // For separator page
    for (const doc of section.documents) {
      sectionDocs.push({ doc, startPage: currentPageNum });
      docTargetPages.set(doc.id, currentPageNum);
      currentPageNum += doc.pageCount;
    }
    processedSections.push({ section, docsWithPages: sectionDocs });
  }

  // Helper to add links to PDF
  const addLinkToPage = (page: any, x: number, y: number, width: number, height: number, targetPageIdx: any) => {
    const linkAnnotation = mergedPdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'GoTo',
        D: [targetPageIdx, 'XYZ', null, null, null],
      },
    });
    const annots = page.node.get(PDFName.of('Annots')) || mergedPdf.context.obj([]);
    annots.push(linkAnnotation);
    page.node.set(PDFName.of('Annots'), annots);
  };

  // 2. Generate Index Page(s)
  const indexPages: any[] = [];
  for (let i = 0; i < estimatedIndexPages; i++) {
    const indexPage = mergedPdf.addPage([595.28, 841.89]);
    indexPages.push(indexPage);
    const { width, height } = indexPage.getSize();
    
    if (i === 0) {
      // Draw dynamic layout items
      layout.items.forEach(item => {
        indexPage.drawText(item.text, { x: item.x, y: item.y, size: 10, font });
      });
      
      // Draw Header for table
      indexPage.drawText('Document Name', { x: 50, y: listStartY, size: 10, font: boldFont });
      indexPage.drawText('Date', { x: 400, y: listStartY, size: 10, font: boldFont });
      indexPage.drawText('Page', { x: 500, y: listStartY, size: 10, font: boldFont });
    }
  }

  // 3. Populate Index and Store Links
  const allEntries: any[] = [];
  config.sections.forEach((s) => {
    allEntries.push({ title: s.title.toUpperCase(), isSection: true });
    s.documents.forEach((d) => {
      const startPage = docTargetPages.get(d.id);
      const pageLabel = d.isLateAddition ? `${d.latePrefix}1` : `${startPage}`;
      allEntries.push({ 
        title: d.name, 
        date: formatDate(d.date, config.dateFormat), 
        pageLabel, 
        isSection: false, 
        id: d.id 
      });
    });
  });

  let currentEntryIdx = 0;
  for (let p = 0; p < indexPages.length; p++) {
    const page = indexPages[p];
    const { height } = page.getSize();
    let yPos = (p === 0) ? listStartY - 25 : height - 50;
    const capacity = (p === 0) ? firstPageCapacity : otherPageCapacity;
    
    for (let i = 0; i < capacity && currentEntryIdx < allEntries.length; i++) {
      const entry = allEntries[currentEntryIdx];
      if (entry.isSection) {
        page.drawText(entry.title, { x: 50, y: yPos, size: 11, font: boldFont });
      } else {
        page.drawText(entry.title, { x: 60, y: yPos, size: 10, font });
        page.drawText(entry.date || '-', { x: 400, y: yPos, size: 10, font });
        page.drawText(entry.pageLabel, { x: 500, y: yPos, size: 10, font });
      }
      yPos -= 18;
      currentEntryIdx++;
    }
  }

  // 4. Merge Documents and Add Separators
  let globalPageCounter = estimatedIndexPages + 1;
  const docRefMap: Map<string, any> = new Map();

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
        const newPage = mergedPdf.addPage(page);
        if (idx === 0) docRefMap.set(doc.id, newPage.ref);
        globalPageCounter++;
      });
    }
  }

  // 5. Finalize Links
  let linkEntryIdx = 0;
  for (let p = 0; p < indexPages.length; p++) {
    const page = indexPages[p];
    const { height } = page.getSize();
    let yPos = (p === 0) ? listStartY - 25 : height - 50;
    const capacity = (p === 0) ? firstPageCapacity : otherPageCapacity;

    for (let i = 0; i < capacity && linkEntryIdx < allEntries.length; i++) {
      const entry = allEntries[linkEntryIdx];
      if (!entry.isSection) {
        const targetRef = docRefMap.get(entry.id);
        if (targetRef) {
          addLinkToPage(page, 50, yPos - 2, 500, 14, targetRef);
        }
      }
      yPos -= 18;
      linkEntryIdx++;
    }
  }

  return await mergedPdf.save();
}

export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}
