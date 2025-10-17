import Papa from 'papaparse';
import type { CSVRow, ValidationResult } from '../types.ts';
import { getProductTypeById } from '../config/productTypes.ts';

const URL_REGEX = /^https?:\/\/.+/i;

export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url || url.trim() === '') {
    errors.push('URL is empty');
  } else if (!URL_REGEX.test(url)) {
    errors.push('URL must start with http:// or https://');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function parseCSVRow(row: string[], index: number, productTypeId: string = 'plyty'): CSVRow {
  const errors: string[] = [];
  const productTypeConfig = getProductTypeById(productTypeId);

  // Get URL from configured index
  const url = row[productTypeConfig.fields.urlIndex] || '';

  // Format product name using the product type's formatter
  const productName = productTypeConfig.formatProductName(row);

  if (!productName.trim()) {
    errors.push('Product name is empty');
  }

  const urlValidation = validateURL(url);
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors);
  }

  // Use configured ID index or fallback to default
  const idIndex = productTypeConfig.fields.idIndex ?? 0;
  const id = row[idIndex] || `row-${index}`;

  return {
    id,
    productName,
    url,
    rawData: row,
    isValid: errors.length === 0,
    errors,
    isExcluded: false,
    productType: productTypeId
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
        error: (error) => {
          reject(error);
        }
      });
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

export function checkDuplicates(rows: CSVRow[]): CSVRow[] {
  const urlMap = new Map<string, number>();

  return rows.map(row => {
    if (!row.isValid) return row;

    const count = urlMap.get(row.url) || 0;
    urlMap.set(row.url, count + 1);

    if (count > 0) {
      return {
        ...row,
        errors: [...row.errors, `Duplicate URL (appears ${count + 1} times)`]
      };
    }

    return row;
  });
}
