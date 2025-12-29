
export type DateFormat = 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';

export interface BundleDocument {
  id: string;
  name: string;
  date: string;
  originalName: string;
  file: File | null;
  pageCount: number;
  isLateAddition: boolean;
  latePrefix: string;
  shouldOcr: boolean;
  base64Data?: string;
}

export interface BundleSection {
  id: string;
  title: string;
  documents: BundleDocument[];
}

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface LayoutItem extends LayoutPosition {
  id: string;
  text: string;
}

export interface IndexLayout {
  items: LayoutItem[];
  listStartY: number;
}

export interface BundleConfig {
  caseNumber: string;
  caseName: string;
  courtName: string;
  dateFormat: DateFormat;
  sections: BundleSection[];
  indexLayout: IndexLayout;
}
