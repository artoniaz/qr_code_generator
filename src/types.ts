export interface CSVRow {
  id: string;
  productName: string;
  url: string;
  rawData: string[];
  isValid: boolean;
  errors: string[];
  isExcluded?: boolean;
}

export interface AppSettings {
  qrSize: number; // in mm
  cardHeight: number; // in mm
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
