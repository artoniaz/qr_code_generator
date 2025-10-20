import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
  VerticalAlign,
  TextRun,
  ImageRun,
  BorderStyle,
  PageBreak
} from 'docx';
import { saveAs } from 'file-saver';
import type { CSVRow, AppSettings } from '../types.ts';
import { generateQRCode, base64ToBuffer } from './qrGenerator.ts';

// Constants for A4 page layout
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const GAP_MM = 3;
const COLUMNS = 3;

// Conversion: mm to twips (1 twip = 1/1440 inch, 1 inch = 25.4 mm)
const MM_TO_TWIPS = (mm: number) => Math.round((mm / 25.4) * 1440);

// Calculate dimensions
const CONTENT_WIDTH_MM = A4_WIDTH_MM - (2 * MARGIN_MM); // 186 mm
const HORIZONTAL_GAPS_MM = (COLUMNS - 1) * GAP_MM; // 6 mm
const CARD_WIDTH_MM = (CONTENT_WIDTH_MM - HORIZONTAL_GAPS_MM) / COLUMNS; // 60 mm

function calculateRowsPerPage(cardHeightMM: number): number {
  const contentHeightMM = A4_HEIGHT_MM - (2 * MARGIN_MM); // 273 mm
  return Math.floor((contentHeightMM + GAP_MM) / (cardHeightMM + GAP_MM));
}

function calculateCardsPerPage(cardHeightMM: number): number {
  return COLUMNS * calculateRowsPerPage(cardHeightMM);
}

async function createCardCell(row: CSVRow, settings: AppSettings): Promise<TableCell> {
  const qrDataUrl = await generateQRCode(row.url, settings.qrSize);
  const qrBuffer = base64ToBuffer(qrDataUrl);

  const PADDING_MM = 4;
  const RIGHT_PADDING_MM = 2; // Half of the left padding
  const TEXT_SPACING_MM = 6;

  // Inner table for QR + Text layout
  const innerTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [
      new TableRow({
        children: [
          // QR Code cell
          new TableCell({
            width: {
              size: MM_TO_TWIPS(settings.qrSize + TEXT_SPACING_MM),
              type: WidthType.DXA
            },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: qrBuffer,
                    transformation: {
                      width: MM_TO_TWIPS(settings.qrSize),
                      height: MM_TO_TWIPS(settings.qrSize)
                    },
                    type: 'png'
                  })
                ]
              })
            ]
          }),
          // Text cell
          new TableCell({
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: row.productName,
                    bold: true,
                    size: 18 // 9pt
                  })
                ]
              }),
              new Paragraph({
                spacing: { before: 75 }, // Half of the previous 150 (twips)
                children: [
                  new TextRun({
                    text: 'zeskanuj, aby poznać szczegóły i cenę',
                    size: 14, // 7pt
                    color: '666666'
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  return new TableCell({
    width: {
      size: MM_TO_TWIPS(CARD_WIDTH_MM),
      type: WidthType.DXA
    },
    margins: {
      top: MM_TO_TWIPS(PADDING_MM),
      bottom: MM_TO_TWIPS(PADDING_MM),
      left: MM_TO_TWIPS(PADDING_MM),
      right: MM_TO_TWIPS(RIGHT_PADDING_MM)
    },
    children: [
      new Paragraph({
        children: [innerTable]
      })
    ]
  });
}

async function createPageTable(
  rows: CSVRow[],
  settings: AppSettings
): Promise<Table> {
  const rowsPerPage = calculateRowsPerPage(settings.cardHeight);
  const cells = await Promise.all(
    rows.map(row => createCardCell(row, settings))
  );

  const tableRows: TableRow[] = [];

  // Create rows with 3 columns each
  for (let i = 0; i < rowsPerPage; i++) {
    const rowCells: TableCell[] = [];

    for (let col = 0; col < COLUMNS; col++) {
      const cellIndex = i * COLUMNS + col;
      if (cellIndex < cells.length) {
        rowCells.push(cells[cellIndex]);
      } else {
        // Empty cell for incomplete rows
        rowCells.push(
          new TableCell({
            width: {
              size: MM_TO_TWIPS(CARD_WIDTH_MM),
              type: WidthType.DXA
            },
            children: [new Paragraph({ text: '' })]
          })
        );
      }
    }

    tableRows.push(
      new TableRow({
        height: {
          value: MM_TO_TWIPS(settings.cardHeight),
          rule: 'exact'
        },
        children: rowCells
      })
    );
  }

  return new Table({
    width: {
      size: MM_TO_TWIPS(CONTENT_WIDTH_MM),
      type: WidthType.DXA
    },
    columnWidths: Array(COLUMNS).fill(MM_TO_TWIPS(CARD_WIDTH_MM)),
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: MM_TO_TWIPS(GAP_MM), color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.SINGLE, size: MM_TO_TWIPS(GAP_MM), color: 'FFFFFF' }
    }
  });
}

export async function generateDocx(
  rows: CSVRow[],
  settings: AppSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // Filter out excluded and invalid rows
  const validRows = rows.filter(row => row.isValid && !row.isExcluded);

  if (validRows.length === 0) {
    throw new Error('No valid rows to generate document');
  }

  const cardsPerPage = calculateCardsPerPage(settings.cardHeight);
  const totalPages = Math.ceil(validRows.length / cardsPerPage);

  const sections: any[] = [];

  for (let page = 0; page < totalPages; page++) {
    const startIdx = page * cardsPerPage;
    const endIdx = Math.min(startIdx + cardsPerPage, validRows.length);
    const pageRows = validRows.slice(startIdx, endIdx);

    if (onProgress) {
      onProgress(page + 1, totalPages);
    }

    const table = await createPageTable(pageRows, settings);

    const children: any[] = [table];

    // Add page break if not last page
    if (page < totalPages - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    sections.push({
      properties: {
        page: {
          margin: {
            top: MM_TO_TWIPS(MARGIN_MM),
            right: MM_TO_TWIPS(MARGIN_MM),
            bottom: MM_TO_TWIPS(MARGIN_MM),
            left: MM_TO_TWIPS(MARGIN_MM)
          }
        }
      },
      children
    });
  }

  const doc = new Document({
    sections
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'qrcards.docx');
}
