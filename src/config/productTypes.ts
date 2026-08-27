import type { FrontVariant } from '../types.ts';

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
    info?: string;
    millingType?: string;
    leadTime?: string;
    front?: FrontVariant;
  };
}

// A board opts into the two-variant label through its data rather than through
// a producer name hard-coded here: an export carrying producent_front is sold
// both as a whole sheet and as a cut front, and gets both sections. Every other
// board export has no such column and prints exactly as it always did.
function getFrontVariant(row: Record<string, string>): FrontVariant | undefined {
  const producer = (row['producent_front'] || '').trim();

  if (!producer) {
    return undefined;
  }

  return {
    producer,
    millingType: (row['frez_typ'] || '').trim(),
    leadTime: (row['front_czas_oczekiwania'] || '').trim(),
  };
}

// Not every row of that export actually has a sheet behind the front - some
// fronts are sold on their own and their sheet columns come out blank. The
// sheet's own price and lead time carry no signal here (cena_brutto_arkusz is
// "0,00" and arkusz_czas_oczekiwania is empty on every single row of the
// export), so presence is read off the producer and the three dimensions -
// exactly what the sheet section of the label would print.
export function hasSheetHalf(row: Record<string, string>): boolean {
  return [
    row['producent_arkusz'],
    row['arkusz_dlugosc'],
    row['arkusz_szczerokosc'] || row['arkusz_szerokosc'],
    row['arkusz_grubosc'],
  ].some(value => (value || '').trim() !== '');
}

// A sheet+front row with no sheet is simply a front, and is printed by the
// plain fronty label instead of by a combined one with an empty half and a
// stranded "Forma sprzedaży: arkusz". The fronty config reads the very columns
// this export has, so the redirect is a change of product type and nothing
// more - no separate rendering path to keep in sync.
export function resolveRowProductType(
  row: Record<string, string>,
  productTypeId: string
): string {
  if (
    productTypeId === 'plyty' &&
    getFrontVariant(row) !== undefined &&
    !hasSheetHalf(row)
  ) {
    return 'fronty';
  }

  return productTypeId;
}

// "2800 × 1300 × 18 mm" - one row rather than three, which matters on a label
// that already carries two sale variants. "arkusz_szczerokosc" is how the
// current export spells the width header; the corrected spelling is accepted
// too, so fixing it upstream will not silently drop the width.
function formatBoardDimensions(row: Record<string, string>): string {
  const parts = [
    row['arkusz_dlugosc'],
    row['arkusz_szczerokosc'] || row['arkusz_szerokosc'],
    row['arkusz_grubosc'],
  ]
    .map(part => (part || '').trim())
    .filter(part => part !== '');

  return parts.length > 0 ? `${parts.join(' × ')} mm` : '';
}

export const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
  plyty: {
    id: 'plyty',
    name: 'Płyty',
    description:
      'Format płyt: kolumny id, code, decor, structure, name, url, height, width, description, thickness, producer, kolekcja (opcjonalna). ' +
      'Płyta sprzedawana też jako front: producent_arkusz, front_typ, kolor, info, arkusz_dlugosc, arkusz_szczerokosc, arkusz_grubosc, ' +
      'arkusz_czas_oczekiwania, producent_front, frez_typ, front_czas_oczekiwania',
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

      // A board sold as a front too has no name column - the colour is what
      // tells one product from another. Left verbatim, since title-casing it
      // would mangle decor codes like "POLAR 11279M".
      const colour = (row['kolor'] || '').trim();
      if (colour) {
        return colour;
      }

      return row['code'] || '';
    },
    getCardData: (row) => {
      const front = getFrontVariant(row);

      // Boards sold as fronty too come from a different export, which names the
      // board's own fields after the sheet (arkusz_*) and keeps front_typ / info
      // for what the standard format calls structure / description.
      if (front) {
        return {
          structure: row['front_typ'],
          producer: row['producent_arkusz'],
          info: row['info'],
          leadTime: row['arkusz_czas_oczekiwania'],
          dimensions: formatBoardDimensions(row),
          front,
        };
      }

      return {
        decor: row['decor'],
        structure: row['structure'],
        description: row['description'],
        thickness: row['thickness'],
        producer: row['producer'],
        dimensions: row['height'] && row['width'] ? `${row['height']} x ${row['width']}` : '',
      };
    },
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
    description: 'Format frontów: kolumny id, producent_front (lub producer), front_typ, kolor, info, frez_typ, front_czas_oczekiwania, url',
    fields: {
      urlColumn: 'url',
      idColumn: 'id',
      productCodeColumn: '', // no product code for fronty
    },
    formatProductName: () => 'Front meblowy',
    getCardData: (row) => ({
      // Older exports name the front's maker "producer"; newer ones split it
      // into producent_front and producent_arkusz. Same for the lead time.
      producer: row['producent_front'] || row['producer'] || '',
      structure: row['front_typ'],
      description: row['kolor'],
      info: row['info'],
      millingType: row['frez_typ'],
      leadTime: row['front_czas_oczekiwania'] || row['czas_oczekiwania'] || '',
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
