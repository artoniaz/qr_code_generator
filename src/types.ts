export interface CSVRow {
  id: string;
  productName: string;
  url: string;
  rawData: string[];
  isValid: boolean;
  errors: string[];
  isExcluded?: boolean;
  productType?: string; // Product type used for this row
}

export interface AppSettings {
  qrSize: number; // in mm
  cardHeight: number; // in mm
  productType: string; // Product type for CSV parsing
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
