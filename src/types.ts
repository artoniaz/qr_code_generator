export interface CSVRow {
  id: string;
  productName: string;
  url: string;
  rawData: Record<string, string>;
  isValid: boolean;
  errors: string[];
  isExcluded?: boolean;
  productType?: string; // Product type used for this row
  // Additional card data (populated based on product type)
  cardData?: {
    decor?: string;
    structure?: string;
    description?: string;
    thickness?: string;
    producer?: string;
    dimensions?: string;
    millingType?: string; // frez_typ for fronty
  };
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
