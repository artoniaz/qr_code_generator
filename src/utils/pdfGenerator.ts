import { jsPDF } from 'jspdf';
import type { CSVRow, AppSettings } from '../types.ts';
import { generateQRCode } from './qrGenerator.ts';
import { loadDejaVuFont } from '../fonts/dejavu-font.ts';

// Constants for A4 page layout
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const GAP_MM = 3;
const COLUMNS = 3;

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

async function drawCard(
  pdf: jsPDF,
  row: CSVRow,
  x: number,
  y: number,
  settings: AppSettings,
  fontLoaded: boolean
): Promise<void> {
  const qrDataUrl = await generateQRCode(row.url, settings.qrSize);

  const PADDING_MM = 4;
  const TEXT_SPACING_MM = 6;

  // Draw border for debugging (optional - comment out if not needed)
  // pdf.setDrawColor(200, 200, 200);
  // pdf.rect(x, y, CARD_WIDTH_MM, settings.cardHeight);

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
  const availableTextWidth = CARD_WIDTH_MM - settings.qrSize - TEXT_SPACING_MM - (2 * PADDING_MM);

  // Draw product name (bold) - start from top, aligned with QR code top
  pdf.setFontSize(10);
  if (fontLoaded) {
    pdf.setFont('Roboto', 'normal');
  } else {
    pdf.setFont('helvetica', 'bold');
  }
  const productNameY = textStartY + 3; // Start 3mm from top (font baseline adjustment)

  // Draw text
  const lines = pdf.splitTextToSize(row.productName, availableTextWidth);
  pdf.text(lines, textX, productNameY, {
    lineHeightFactor: 1.2,
    align: 'left'
  });

  // Draw description - positioned below product name
  if (fontLoaded) {
    pdf.setFont('Roboto', 'normal');
  } else {
    pdf.setFont('helvetica', 'normal');
  }
  pdf.setFontSize(7);
  pdf.setTextColor(102, 102, 102);
  const descriptionY = productNameY + 8; // 8mm below product name

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

  const cardsPerPage = calculateCardsPerPage(settings.cardHeight);
  const rowsPerPage = calculateRowsPerPage(settings.cardHeight);
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
        const x = MARGIN_MM + (col * (CARD_WIDTH_MM + GAP_MM));
        const y = MARGIN_MM + (row * (settings.cardHeight + GAP_MM));

        await drawCard(pdf, validRows[cardIndex], x, y, settings, fontLoaded);
        cardIndex++;
      }
    }
  }

  // Save the PDF
  pdf.save('qrcards.pdf');
}
