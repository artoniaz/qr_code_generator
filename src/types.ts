// Front variant of a board: the same product cut to size and sold per m²
// rather than as a whole sheet. Optional - only exports carrying a
// producent_front column have it, and only those labels print a front section.
export interface FrontVariant {
  producer?: string;
  millingType?: string;
  leadTime?: string;
}

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
    info?: string; // free-form note printed as "Informacje"
    millingType?: string; // frez_typ
    leadTime?: string; // lead time printed as "Dostępność"
    front?: FrontVariant; // per-m² front variant (boards sold both ways)
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
