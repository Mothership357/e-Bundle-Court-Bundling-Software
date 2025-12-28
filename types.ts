
export interface BundleDocument {
  id: string;
  name: string;
  date: string;
  originalName: string;
  file: File | null;
  pageCount: number;
  isLateAddition: boolean;
  latePrefix: string;
  base64Data?: string; // Used for loading/saving config
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

export interface IndexLayout {
  caseName: LayoutPosition;
  caseNumber: LayoutPosition;
  courtName: LayoutPosition;
}

export interface BundleConfig {
  caseNumber: string;
  caseName: string;
  courtName: string;
  sections: BundleSection[];
  indexLayout?: IndexLayout;
}
