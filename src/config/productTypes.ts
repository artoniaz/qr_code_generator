export interface ProductTypeConfig {
  id: string;
  name: string;
  description: string;
  // CSV column name mappings (string keys from CSV header row)
  fields: {
    urlColumn: string;          // Column name for URL
    idColumn: string;           // Column name for ID
    productCodeColumn?: string; // Column name for duplicate code checking
  };
  // Product name formatting function (receives named-column row object)
  formatProductName: (row: Record<string, string>) => string;
  // Extract additional data for card generation
  getCardData?: (row: Record<string, string>) => {
    decor?: string;
    structure?: string;
    description?: string;
    thickness?: string;
    producer?: string;
    dimensions?: string;
    millingType?: string;
  };
}

export const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
  plyty: {
    id: 'plyty',
    name: 'Płyty',
    description: 'Format płyt: kolumny id, code, decor, structure, name, url, height, width, description, thickness, producer, kolekcja (opcjonalna)',
    fields: {
      urlColumn: 'url',
      idColumn: 'id',
      productCodeColumn: 'code',
    },
    formatProductName: (row) => {
      const name = row['name'] || '';
      if (name) {
        return name
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      return row['code'] || '';
    },
    getCardData: (row) => ({
      decor: row['decor'],
      structure: row['structure'],
      description: row['description'],
      thickness: row['thickness'],
      producer: row['producer'],
      dimensions: row['height'] && row['width'] ? `${row['height']} x ${row['width']}` : '',
    }),
  },

  blaty: {
    id: 'blaty',
    name: 'Blaty',
    description: 'Format blatów: kolumny id, code, decor, structure, name, url, length, width, description, thickness, producer, kolekcja (opcjonalna)',
    fields: {
      urlColumn: 'url',
      idColumn: 'id',
      productCodeColumn: 'code',
    },
    formatProductName: (row) => {
      const colorName = row['name'] || '';
      const decor = row['decor'] || '';
      const structure = row['structure'] || '';

      if (colorName && decor && structure) {
        const formattedColor = colorName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        return `${formattedColor} ${decor} ${structure}`;
      }

      return row['code'] || '';
    },
  },

  blaty_j: {
    id: 'blaty_j',
    name: 'Blaty J',
    description: 'Format blatów (Juan, polskie nazwy kolumn): id, dekor, struktura, nazwa, grubosc, kolekcja, dlugosci, szerokosci, url',
    fields: {
      urlColumn: 'url',
      idColumn: 'id',
      productCodeColumn: '', // no dedicated product code column in this format
    },
    formatProductName: (row) => {
      const colorName = row['nazwa'] || '';
      const dekor = row['dekor'] || '';
      const struktura = row['struktura'] || '';

      if (colorName && dekor && struktura) {
        const formattedColor = colorName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        return `${formattedColor} ${dekor} ${struktura}`;
      }

      return row['dekor'] || '';
    },
  },

  fronty: {
    id: 'fronty',
    name: 'Fronty',
    description: 'Format frontów: kolumny id, producer, front_typ, kolor, info, frez_typ, czas_oczekiwania, url',
    fields: {
      urlColumn: 'url',
      idColumn: 'id',
      productCodeColumn: '', // no product code for fronty
    },
    formatProductName: (_row) => 'Front meblowy',
    getCardData: (row) => ({
      producer: row['producer'],
      structure: row['front_typ'],
      description: row['kolor'],
      thickness: row['info'],
      millingType: row['frez_typ'],
      dimensions: row['czas_oczekiwania'],
    }),
  },
};

export function getProductTypeById(id: string): ProductTypeConfig {
  return PRODUCT_TYPES[id] || PRODUCT_TYPES.plyty;
}

export function getProductTypeOptions(): { value: string; label: string; description: string }[] {
  return Object.values(PRODUCT_TYPES).map(type => ({
    value: type.id,
    label: type.name,
    description: type.description,
  }));
}
