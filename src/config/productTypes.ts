export interface ProductTypeConfig {
  id: string;
  name: string;
  description: string;
  // CSV field mapping (0-based indices)
  fields: {
    productNameIndex?: number; // Raw product name field
    colorNameIndex?: number;   // Color name field
    urlIndex: number;          // URL field (required)
    idIndex?: number;          // ID field
  };
  // Product name formatting function
  formatProductName: (row: string[]) => string;
}

export const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
  plyty: {
    id: 'plyty',
    name: 'Płyty',
    description: 'Aktualny format: Nazwa produktu (indeks 1), Kolor (indeks 4), URL (indeks 5)',
    fields: {
      productNameIndex: 1,
      colorNameIndex: 4,
      urlIndex: 5,
      idIndex: 0
    },
    formatProductName: (row: string[]) => {
      const rawProductName = row[1] || '';
      const colorName = row[4] || '';

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

          return `${formattedColor} ${code} ${type}`;
        }
      }

      return rawProductName;
    }
  },

  blaty: {
    id: 'blaty',
    name: 'Blaty',
    description: 'Format blatów: Kod produktu (indeks 1), Kolor (indeks 5), URL (indeks 6)',
    fields: {
      productNameIndex: 1,
      colorNameIndex: 5,
      urlIndex: 6,
      idIndex: 0
    },
    formatProductName: (row: string[]) => {
      const rawProductName = row[1] || '';
      const colorName = row[5] || '';

      if (rawProductName && colorName) {
        const parts = rawProductName.split('_');
        if (parts.length >= 2) {
          const code = parts[0]; // e.g., "K190"
          const type = parts[1]; // e.g., "RS"

          // Capitalize first letter of each word in color name, rest lowercase
          const formattedColor = colorName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          return `${formattedColor} ${code} ${type}`;
        }
      }

      return rawProductName;
    }
  }
};

export function getProductTypeById(id: string): ProductTypeConfig {
  return PRODUCT_TYPES[id] || PRODUCT_TYPES.plyty;
}

export function getProductTypeOptions(): { value: string; label: string; description: string }[] {
  return Object.values(PRODUCT_TYPES).map(type => ({
    value: type.id,
    label: type.name,
    description: type.description
  }));
}
