import Papa from 'papaparse';
import type { CSVRow, ValidationResult } from '../types.ts';

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

export function parseCSVRow(row: string[], index: number): CSVRow {
  const errors: string[] = [];

  // Field mapping based on spec:
  // Index 1 (0-based): Product name parts (e.g., "0110_SM_2800x2070_18")
  // Index 4 (0-based): Color name (e.g., "BIAŁY KORPUSOWY")
  // Index 5 (0-based): URL for QR code

  const rawProductName = row[1] || '';
  const colorName = row[4] || '';
  const url = row[5] || '';

  // Format product name: "Biały Korpusowy 0110 SM"
  // Extract code (0110) and type (SM) from raw product name
  let productName = rawProductName;
  if (rawProductName && colorName) {
    const parts = rawProductName.split('_');
    if (parts.length >= 2) {
      const code = parts[0]; // e.g., "0110"
      const type = parts[1]; // e.g., "SM"

      // Capitalize first letter of each word in color name, rest lowercase
      const formattedColor = colorName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      productName = `${formattedColor} ${code} ${type}`;
    }
  }

  if (!productName.trim()) {
    errors.push('Product name is empty');
  }

  const urlValidation = validateURL(url);
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors);
  }

  return {
    id: row[0] || `row-${index}`,
    productName,
    url,
    rawData: row,
    isValid: errors.length === 0,
    errors,
    isExcluded: false
  };
}

export function detectDelimiter(csvText: string): string {
  const firstLine = csvText.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  return tabCount > commaCount ? '\t' : ',';
}

export async function parseCSVFile(file: File): Promise<CSVRow[]> {
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
          const parsedRows = rows.map((row, index) => parseCSVRow(row, index));
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
