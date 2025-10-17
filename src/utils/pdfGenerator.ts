import { jsPDF } from 'jspdf';
import type { CSVRow, AppSettings } from '../types.ts';
import { generateQRCode } from './qrGenerator.ts';
import { loadDejaVuFont } from '../fonts/dejavu-font.ts';

// Constants for A4 page layout
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const TOP_BOTTOM_MARGIN_MM = 15;
const LEFT_RIGHT_MARGIN_MM = 7;
const COLUMNS = 3;

// Card dimensions (calculated to fit with margins and gaps)
const COLUMN_GAP_MM = 3;
const ROW_GAP_MM = 0;

// Calculate exact dimensions to fill the page
const AVAILABLE_HEIGHT_MM = A4_HEIGHT_MM - (2 * TOP_BOTTOM_MARGIN_MM); // 267mm
const ROWS_PER_PAGE = 7;
const CARD_HEIGHT_MM = AVAILABLE_HEIGHT_MM / ROWS_PER_PAGE; // 38.142857mm

// Card width: (210 - 14 - 6) / 3 = 190 / 3 = 63.333mm
const CARD_WIDTH_MM = (A4_WIDTH_MM - (2 * LEFT_RIGHT_MARGIN_MM) - ((COLUMNS - 1) * COLUMN_GAP_MM)) / COLUMNS;

function calculateRowsPerPage(): number {
  return ROWS_PER_PAGE;
}

function calculateCardsPerPage(): number {
  return COLUMNS * calculateRowsPerPage();
}

async function drawCard(
  pdf: jsPDF,
  row: CSVRow,
  x: number,
  y: number,
  settings: AppSettings,
  fontLoaded: boolean
): Promise<void> {
  const qrDataUrl = await generateQRCode(row.url, settings.qrSize);

  const PADDING_MM = 5;
  const TEXT_SPACING_MM = 3;

  // Calculate positions
  const qrX = x + PADDING_MM;
  const qrY = y + PADDING_MM;

  // Draw QR code
  pdf.addImage(
    qrDataUrl,
    'PNG',
    qrX,
    qrY,
    settings.qrSize,
    settings.qrSize
  );

  // Text starting position - align text area with QR code
  const textX = qrX + settings.qrSize + TEXT_SPACING_MM;
  const textStartY = qrY; // Start at same Y as QR code
  // Available text width: card width - left padding - QR size - spacing - right padding
  // 63 - 5 - 24 - 3 - 5 = 26mm for text
  const availableTextWidth = CARD_WIDTH_MM - PADDING_MM - settings.qrSize - TEXT_SPACING_MM - PADDING_MM;

  // Draw product name (bold) - start from top, aligned with QR code top
  pdf.setFontSize(12);
  if (fontLoaded) {
    pdf.setFont('Roboto', 'normal');
  } else {
    pdf.setFont('helvetica', 'bold');
  }
  const productNameY = textStartY + 4; // Start 4mm from top (font baseline adjustment)

  // Draw text
  const lines = pdf.splitTextToSize(row.productName, availableTextWidth);
  pdf.text(lines, textX, productNameY, {
    lineHeightFactor: 1.2,
    align: 'left'
  });

  // Calculate the actual height of the product name text
  const lineHeight = 12 * 1.2 * 0.352778; // fontSize * lineHeightFactor * mm conversion
  const titleHeight = lines.length * lineHeight;

  // Draw description - positioned below product name with dynamic spacing
  if (fontLoaded) {
    pdf.setFont('Roboto', 'normal');
  } else {
    pdf.setFont('helvetica', 'normal');
  }
  pdf.setFontSize(8);
  pdf.setTextColor(102, 102, 102);
  const descriptionY = productNameY + titleHeight + 2; // Position below title with 2mm gap

  const descLines = pdf.splitTextToSize('zeskanuj, aby poznać szczegóły i cenę', availableTextWidth);
  pdf.text(descLines, textX, descriptionY, {
    lineHeightFactor: 1.3,
    align: 'left'
  });

  // Reset text color
  pdf.setTextColor(0, 0, 0);
}

export async function generatePdf(
  rows: CSVRow[],
  settings: AppSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // Filter out excluded and invalid rows
  const validRows = rows.filter(row => row.isValid && !row.isExcluded);

  if (validRows.length === 0) {
    throw new Error('No valid rows to generate document');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true
  });

  // Try to load custom font for Polish character support
  const fontLoaded = await loadDejaVuFont(pdf);

  if (!fontLoaded) {
    console.warn('Font loading failed - Polish characters may not display correctly');
  }

  const cardsPerPage = calculateCardsPerPage();
  const rowsPerPage = calculateRowsPerPage();
  const totalPages = Math.ceil(validRows.length / cardsPerPage);

  let cardIndex = 0;

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    if (onProgress) {
      onProgress(page + 1, totalPages);
    }

    // Draw cards for this page
    for (let row = 0; row < rowsPerPage && cardIndex < validRows.length; row++) {
      for (let col = 0; col < COLUMNS && cardIndex < validRows.length; col++) {
        // Calculate x position: left margin + (column * (card width + gap))
        const x = LEFT_RIGHT_MARGIN_MM + (col * (CARD_WIDTH_MM + COLUMN_GAP_MM));
        // Calculate y position: top margin + (row * card height) - no gap between rows
        const y = TOP_BOTTOM_MARGIN_MM + (row * CARD_HEIGHT_MM);

        await drawCard(pdf, validRows[cardIndex], x, y, settings, fontLoaded);
        cardIndex++;
      }
    }
  }

  // Save the PDF
  pdf.save('qrcards.pdf');
}
