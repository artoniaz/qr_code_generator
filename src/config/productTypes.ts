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
    decorIndex?: number;       // Decor code field
    structureIndex?: number;   // Structure field
    descriptionIndex?: number; // Description field
    thicknessIndex?: number;   // Thickness field
    producerIndex?: number;    // Producer field
    heightIndex?: number;      // Height field (for płyty)
    widthIndex?: number;       // Width field (for płyty)
  };
  // Product name formatting function
  formatProductName: (row: string[]) => string;
  // Extract additional data for card generation
  getCardData?: (row: string[]) => {
    decor?: string;
    structure?: string;
    description?: string;
    thickness?: string;
    producer?: string;
    dimensions?: string;
  };
}

export const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
  plyty: {
    id: 'plyty',
    name: 'Płyty',
    description: 'Format płyt: Kod (indeks 2), Struktura (indeks 3), Nazwa (indeks 4), URL (indeks 5)',
    fields: {
      productNameIndex: 4,    // name column
      colorNameIndex: 4,      // same as name
      urlIndex: 5,
      idIndex: 0,
      decorIndex: 2,          // decor code (e.g., "0110")
      structureIndex: 3,      // structure (e.g., "SM")
      descriptionIndex: 12,   // description (e.g., "Płyta laminowana")
      thicknessIndex: 15,     // thickness (e.g., "18")
      producerIndex: 16,      // producer (e.g., "Kronospan")
      heightIndex: 10,        // height (e.g., "2800")
      widthIndex: 11          // width (e.g., "2070")
    },
    formatProductName: (row: string[]) => {
      const name = row[4] || '';      // Column 4: name (e.g., "BIAŁY KORPUSOWY")

      if (name) {
        // Capitalize first letter of each word in name, rest lowercase
        const formattedName = name
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        return formattedName;
      }

      return name || row[1] || '';
    },
    getCardData: (row: string[]) => {
      const decor = row[2] || '';
      const structure = row[3] || '';
      const description = row[12] || '';
      const thickness = row[15] || '';
      const producer = row[16] || '';
      const height = row[10] || '';
      const width = row[11] || '';

      return {
        decor,
        structure,
        description,
        thickness,
        producer,
        dimensions: height && width ? `${height} x ${width}` : ''
      };
    }
  },

  blaty: {
    id: 'blaty',
    name: 'Blaty',
    description: 'Format blatów: Kod produktu (indeks 1), Decor (indeks 2), Struktura (indeks 3), Kolor (indeks 4), URL (indeks 5)',
    fields: {
      productNameIndex: 1,
      colorNameIndex: 4,
      urlIndex: 5,
      idIndex: 0
    },
    formatProductName: (row: string[]) => {
      const colorName = row[4] || '';
      const decor = row[2] || ''; // Column 2: decor number (e.g., "1008")
      const structure = row[3] || ''; // Column 3: structure (e.g., "GR")

      if (colorName && decor && structure) {
        // Capitalize first letter of each word in color name, rest lowercase
        const formattedColor = colorName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        return `${formattedColor} ${decor} ${structure}`;
      }

      // Fallback to raw product name if any field is missing
      return row[1] || '';
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
