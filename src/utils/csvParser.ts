import Papa from 'papaparse';
import type { CSVRow, ValidationResult } from '../types.ts';
import { getProductTypeById } from '../config/productTypes.ts';

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

export function parseCSVRow(row: string[], index: number, productTypeId: string = 'plyty'): CSVRow {
  const errors: string[] = [];
  const productTypeConfig = getProductTypeById(productTypeId);

  // For fronty: URL is always in the last column regardless of format
  // This handles different producers with varying column counts
  let urlIndex = productTypeConfig.fields.urlIndex;
  if (productTypeId === 'fronty') {
    urlIndex = row.length - 1;
  }

  // Get URL from configured index
  const url = row[urlIndex] || '';

  // Format product name using the product type's formatter
  const productName = productTypeConfig.formatProductName(row);

  if (!productName.trim()) {
    errors.push('Nazwa produktu jest pusta');
  }

  const urlValidation = validateURL(url);
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors);
  }

  // Use configured ID index or fallback to default
  const idIndex = productTypeConfig.fields.idIndex ?? 0;
  const id = row[idIndex] || `row-${index}`;

  // Get additional card data if the product type provides a getCardData function
  const cardData = productTypeConfig.getCardData ? productTypeConfig.getCardData(row) : undefined;

  return {
    id,
    productName,
    url,
    rawData: row,
    isValid: errors.length === 0,
    errors,
    isExcluded: false,
    productType: productTypeId,
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
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
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
  const productBaseCodeMap = new Map<string, number>();

  return rows.map(row => {
    if (!row.isValid) return row;

    // Get productBaseCode from rawData (column 1 for plyty and blaty, but skip for fronty)
    // For fronty, column 1 is the producer which repeats across products
    const productBaseCode = row.productType !== 'fronty' ? (row.rawData[1] || '') : '';

    // Check for duplicate URLs
    const urlCount = urlMap.get(row.url) || 0;
    urlMap.set(row.url, urlCount + 1);

    // Check for duplicate productBaseCode (skip for fronty)
    let baseCodeCount = 0;
    if (productBaseCode) {
      baseCodeCount = productBaseCodeMap.get(productBaseCode) || 0;
      productBaseCodeMap.set(productBaseCode, baseCodeCount + 1);
    }

    const errors = [...row.errors];
    let shouldExclude = false;

    if (urlCount > 0) {
      errors.push(`Duplikat URL (występuje ${urlCount + 1} razy)`);
      shouldExclude = true;
    }

    if (baseCodeCount > 0 && productBaseCode) {
      errors.push(`Duplikat kodu produktu (występuje ${baseCodeCount + 1} razy)`);
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
