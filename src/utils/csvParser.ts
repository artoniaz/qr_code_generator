import Papa from 'papaparse';
import type { CSVRow, ValidationResult } from '../types.ts';
import { getProductTypeById, resolveRowProductType } from '../config/productTypes.ts';

const URL_REGEX = /^https?:\/\/.+/i;

export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url || url.trim() === '') {
    errors.push('URL jest pusty');
  } else if (!URL_REGEX.test(url)) {
    errors.push('URL musi zaczynać się od http:// lub https://');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function parseCSVRow(row: Record<string, string>, index: number, productTypeId: string = 'plyty'): CSVRow {
  const errors: string[] = [];
  // The type picked in the dropdown describes the export, not necessarily every
  // row in it: a sheet+front export mixes rows that have a sheet with rows that
  // are a bare front. Each row therefore resolves its own type, and everything
  // downstream - title, card data, which label layout is drawn, what the
  // preview shows - follows from it.
  const effectiveTypeId = resolveRowProductType(row, productTypeId);
  const productTypeConfig = getProductTypeById(effectiveTypeId);

  const url = row[productTypeConfig.fields.urlColumn] || '';
  const productName = productTypeConfig.formatProductName(row);

  if (!productName.trim()) {
    errors.push('Nazwa produktu jest pusta');
  }

  const urlValidation = validateURL(url);
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors);
  }

  const id = row[productTypeConfig.fields.idColumn] || `row-${index}`;
  const cardData = productTypeConfig.getCardData ? productTypeConfig.getCardData(row) : undefined;

  return {
    id,
    productName,
    url,
    rawData: row,
    isValid: errors.length === 0,
    errors,
    isExcluded: false,
    productType: effectiveTypeId,
    cardData
  };
}

export function detectDelimiter(csvText: string): string {
  const firstLine = csvText.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  return tabCount > commaCount ? '\t' : ',';
}

export async function parseCSVFile(file: File, productTypeId: string = 'plyty'): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const delimiter = detectDelimiter(text);

      Papa.parse(text, {
        delimiter,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          const parsedRows = rows.map((row, index) => parseCSVRow(row, index, productTypeId));
          resolve(parsedRows);
        },
        error: (error: unknown) => {
          reject(error);
        }
      });
    };

    reader.onerror = () => {
      reject(new Error('Nie udało się odczytać pliku'));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

export function checkDuplicates(rows: CSVRow[]): CSVRow[] {
  const urlMap = new Map<string, number>();
  const productCodeMap = new Map<string, number>();

  return rows.map(row => {
    if (!row.isValid) return row;

    // Get product code from named column (skip for fronty which has no code column)
    const productCode = row.productType !== 'fronty' ? (row.rawData['code'] || '') : '';

    // Check for duplicate URLs
    const urlCount = urlMap.get(row.url) || 0;
    urlMap.set(row.url, urlCount + 1);

    // Check for duplicate product code (skip for fronty)
    let codeCount = 0;
    if (productCode) {
      codeCount = productCodeMap.get(productCode) || 0;
      productCodeMap.set(productCode, codeCount + 1);
    }

    const errors = [...row.errors];
    let shouldExclude = false;

    if (urlCount > 0) {
      errors.push(`Duplikat URL (występuje ${urlCount + 1} razy)`);
      shouldExclude = true;
    }

    if (codeCount > 0 && productCode) {
      errors.push(`Duplikat kodu produktu (występuje ${codeCount + 1} razy)`);
      shouldExclude = true;
    }

    if (shouldExclude) {
      return {
        ...row,
        errors,
        isExcluded: true
      };
    }

    return row;
  });
}
