import type { CSVRow, AppSettings } from '../types.ts';
import { generateQRCode } from './qrGenerator.ts';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Label printer specifications
// 2.4" × 3.9" (61mm × 99mm) label at 300 DPI (landscape orientation)
const LABEL_WIDTH_MM = 99;  // 3.9 inches (landscape: longer dimension as width)
const LABEL_HEIGHT_MM = 61; // 2.4 inches (landscape: shorter dimension as height)
const DPI = 300;

// Convert mm to pixels at 300 DPI
const MM_TO_PIXELS = DPI / 25.4;
const LABEL_WIDTH_PX = Math.round(LABEL_WIDTH_MM * MM_TO_PIXELS); // 1169 pixels (3.9")
const LABEL_HEIGHT_PX = Math.round(LABEL_HEIGHT_MM * MM_TO_PIXELS); // 720 pixels (2.4")

// Padding and spacing in pixels
const PADDING_LEFT_PX = Math.round(5 * MM_TO_PIXELS); // ~59 pixels
const PADDING_RIGHT_PX = Math.round(2.5 * MM_TO_PIXELS); // ~30 pixels (half of left)
const PADDING_TOP_PX = Math.round(5 * MM_TO_PIXELS); // ~59 pixels
const PADDING_BOTTOM_PX = Math.round(5 * MM_TO_PIXELS); // ~59 pixels
const TEXT_SPACING_PX = Math.round(3 * MM_TO_PIXELS); // ~35 pixels

interface LabelDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  textSpacing: number;
}

function getLabelDimensions(): LabelDimensions {
  return {
    width: LABEL_WIDTH_PX,
    height: LABEL_HEIGHT_PX,
    paddingLeft: PADDING_LEFT_PX,
    paddingRight: PADDING_RIGHT_PX,
    paddingTop: PADDING_TOP_PX,
    paddingBottom: PADDING_BOTTOM_PX,
    textSpacing: TEXT_SPACING_PX,
  };
}

// Font loading functionality removed - using system Arial font only

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

async function drawLabel(
  row: CSVRow,
  settings: AppSettings
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  const dims = getLabelDimensions();
  canvas.width = dims.width;
  canvas.height = dims.height;

  // Fill with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate available space for left and right sections
  const availableWidth = canvas.width - dims.paddingLeft - dims.paddingRight;
  const availableHeight = canvas.height - dims.paddingTop - dims.paddingBottom;

  // Divide canvas: left 35% for QR code, right 65% for text
  const leftSectionWidth = availableWidth * 0.35;
  const rightSectionWidth = availableWidth * 0.65;

  // QR code fills 75% of the available height - smaller
  const qrSizePx = availableHeight * 0.75;
  const qrX = dims.paddingLeft + (leftSectionWidth - qrSizePx) / 2; // Center horizontally in left section
  const qrY = dims.paddingTop; // Position at top

  // Generate QR code
  const qrDataUrl = await generateQRCode(row.url, settings.qrSize);

  // Draw QR code
  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('Failed to load QR code'));
    qrImage.src = qrDataUrl;
  });

  ctx.drawImage(qrImage, qrX, qrY, qrSizePx, qrSizePx);

  // Calculate scan text dimensions (will draw later)
  const scanFontSize = Math.round(10 * MM_TO_PIXELS / 3); // ~39 pixels (increased from 8 to 10)
  const scanFontFamily = 'Arial';
  const scanLine1 = 'zeskanuj,';
  const scanLine2 = 'aby zobaczyć cenę';
  const scanLineHeight = scanFontSize * 1.2;
  const scanTextY = qrY + qrSizePx + Math.round(2 * MM_TO_PIXELS); // Below QR code with spacing

  // Draw optional border for debugging
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Text configuration - right section with more spacing from QR code
  const textX = dims.paddingLeft + leftSectionWidth + dims.textSpacing * 2; // Double spacing from QR code
  const availableTextWidth = rightSectionWidth - dims.textSpacing * 2;

  // Ensure right section text doesn't overlap with QR + scan text
  // Start right section text either at top or below scan text, whichever ensures no overlap
  const rightSectionMinY = dims.paddingTop; // Start at top

  // Extract data based on product type
  let decor: string;
  let structure: string;
  let name: string;
  let description: string;
  let thickness: string;
  let producer: string;
  let widths: string;
  let lengths: string;
  let millingType: string = '';

  if (row.productType === 'fronty' && row.cardData) {
    // For fronty, use cardData with specific mapping
    decor = ''; // No decor for fronty
    structure = row.cardData.structure || ''; // front_typ
    name = row.productName; // "Front meblowy"
    description = row.cardData.description || ''; // kolor
    thickness = row.cardData.thickness || ''; // info
    producer = row.cardData.producer || '';
    widths = row.cardData.dimensions || ''; // czas_oczekiwania
    lengths = '';
    millingType = row.cardData.millingType || ''; // frez_typ
  } else if (row.productType === 'plyty' && row.cardData) {
    // For płyty, use cardData
    decor = row.cardData.decor || '';
    structure = row.cardData.structure || '';
    name = row.productName; // Already formatted
    description = row.cardData.description || '';
    thickness = row.cardData.thickness || '';
    producer = row.cardData.producer || '';

    // For płyty, dimensions are stored as "height x width"
    const dimensions = row.cardData.dimensions || '';
    if (dimensions) {
      const parts = dimensions.split('x').map(p => p.trim());
      if (parts.length === 2) {
        widths = parts[1] + 'mm'; // width
        lengths = parts[0] + 'mm'; // height
      } else {
        widths = '';
        lengths = '';
      }
    } else {
      widths = '';
      lengths = '';
    }
  } else if (row.productType === 'blaty_j') {
    // For blaty J (Juan worktops), use Polish-named columns from rawData
    decor = row.rawData['dekor'] || '';
    structure = row.rawData['struktura'] || '';
    name = row.rawData['nazwa'] || '';
    description = row.rawData['kolekcja'] || '';
    thickness = (row.rawData['grubosc'] || '').toString().trim();
    producer = ''; // no producer column in this format
    const widthStr = row.rawData['szerokosci'] || '';
    const lengthStr = row.rawData['dlugosci'] || '';

    // Format widths/lengths: split by semicolon and add "mm" to each
    widths = widthStr.split(';').map(w => w.trim() + 'mm').filter(w => w !== 'mm').join(', ');
    lengths = lengthStr.split(';').map(l => l.trim() + 'mm').filter(l => l !== 'mm').join(', ');
  } else {
    // For blaty (worktops), use named columns from rawData
    decor = row.rawData['decor'] || '';
    structure = row.rawData['structure'] || '';
    name = row.rawData['name'] || '';
    description = row.rawData['description'] || '';
    thickness = (row.rawData['thickness'] || '').toString().trim();
    producer = row.rawData['producer'] || '';
    const widthStr = row.rawData['width'] || '';
    const lengthStr = row.rawData['length'] || '';

    // Format widths: split by semicolon and add "mm" to each
    widths = widthStr.split(';').map(w => w.trim() + 'mm').filter(w => w !== 'mm').join(', ');
    lengths = lengthStr.split(';').map(l => l.trim() + 'mm').filter(l => l !== 'mm').join(', ');
  }

  // Font sizes - decreased by 2px
  const titleFontSize = Math.round(16 * MM_TO_PIXELS / 3) - 2; // ~61 pixels
  const labelFontSize = Math.round(11 * MM_TO_PIXELS / 3) - 2; // ~41 pixels
  const valueFontSize = Math.round(11 * MM_TO_PIXELS / 3) - 2; // ~41 pixels

  const fontFamily = 'Arial';

  let currentY = rightSectionMinY; // Start at the safe minimum Y position
  const lineSpacing = Math.round(1.5 * MM_TO_PIXELS); // Reduced spacing between rows

  // Draw product name (title) - handle long titles
  ctx.fillStyle = 'black';
  let adjustedTitleFontSize = titleFontSize;
  ctx.font = `${adjustedTitleFontSize}px ${fontFamily}`;

  // Check if title fits, if not reduce font size
  let titleWidth = ctx.measureText(name).width;
  while (titleWidth > availableTextWidth && adjustedTitleFontSize > labelFontSize) {
    adjustedTitleFontSize -= 2;
    ctx.font = `${adjustedTitleFontSize}px ${fontFamily}`;
    titleWidth = ctx.measureText(name).width;
  }

  // If still too long after reducing font, wrap to multiple lines
  if (titleWidth > availableTextWidth) {
    const titleLines = wrapText(ctx, name, availableTextWidth);
    titleLines.forEach((line, index) => {
      ctx.fillText(line, textX, currentY + adjustedTitleFontSize + (index * adjustedTitleFontSize * 1.2));
    });
    currentY += titleLines.length * adjustedTitleFontSize * 1.2 + lineSpacing;
  } else {
    ctx.fillText(name, textX, currentY + adjustedTitleFontSize);
    currentY += adjustedTitleFontSize + lineSpacing;
  }

  // Draw decor and structure (skip for fronty as it has no decor)
  if (row.productType !== 'fronty') {
    ctx.font = `${valueFontSize}px ${fontFamily}`;
    ctx.fillText(`${decor} ${structure}`, textX, currentY + valueFontSize);
    currentY += valueFontSize + lineSpacing;
  }

  // Table-like format for product details
  ctx.font = `${labelFontSize}px ${fontFamily}`;

  // Description (skip for fronty as it's used for "Kolor" field)
  if (description && row.productType !== 'fronty') {
    ctx.fillStyle = '#333333';
    ctx.font = `${labelFontSize}px ${fontFamily}`;
    const descLines = wrapText(ctx, description, availableTextWidth);
    descLines.forEach((line, index) => {
      ctx.fillText(line, textX, currentY + labelFontSize + (index * labelFontSize * 1.2));
    });
    currentY += labelFontSize + descLines.length * labelFontSize * 1.2 + lineSpacing;
  }

  // Table-like layout: calculate label column width for alignment
  ctx.font = `${labelFontSize}px ${fontFamily}`;

  // Calculate label column width based on product type
  let labelColumnWidth: number;
  if (row.productType === 'fronty') {
    labelColumnWidth = Math.max(
      ctx.measureText('Producent:').width,
      ctx.measureText('Typ:').width,
      ctx.measureText('Kolor:').width,
      ctx.measureText('Informacje:').width,
      ctx.measureText('Frezowanie:').width,
      ctx.measureText('oczekiwania:').width // "Czas" will be on separate line
    ) + Math.round(1 * MM_TO_PIXELS);
  } else if (row.productType === 'plyty') {
    labelColumnWidth = Math.max(
      ctx.measureText('Producent:').width,
      ctx.measureText('Grubość:').width,
      ctx.measureText('Wymiary:').width
    ) + Math.round(1 * MM_TO_PIXELS);
  } else {
    labelColumnWidth = Math.max(
      ctx.measureText('Producent:').width,
      ctx.measureText('Grubość:').width,
      ctx.measureText('Szerokości:').width,
      ctx.measureText('Długości:').width
    ) + Math.round(1 * MM_TO_PIXELS);
  }

  const valueX = textX + labelColumnWidth;
  const availableValueWidth = availableTextWidth - labelColumnWidth;

  if (row.productType === 'fronty') {
    // For fronty: display Producent, Typ, Kolor, Informacje, Czas oczekiwania

    // Producer
    if (producer) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      ctx.fillText('Producent:', textX, currentY);
      ctx.fillText(producer, valueX, currentY);
      currentY += lineSpacing * 0.6;
    }

    // Typ (structure = front_typ)
    if (structure) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      ctx.fillText('Typ:', textX, currentY);
      ctx.fillText(structure, valueX, currentY);
      currentY += lineSpacing * 0.6;
    }

    // Kolor (description = kolor)
    if (description) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      ctx.fillText('Kolor:', textX, currentY);
      const kolorLines = wrapText(ctx, description, availableValueWidth);
      kolorLines.forEach((line, index) => {
        if (index === 0) {
          ctx.fillText(line, valueX, currentY);
        } else {
          ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
        }
      });
      currentY += (kolorLines.length - 1) * labelFontSize * 1.1 + lineSpacing * 0.6;
    }

    // Informacje (thickness = info) - only show if info exists
    if (thickness) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      ctx.fillText('Informacje:', textX, currentY);
      const infoLines = wrapText(ctx, thickness, availableValueWidth);
      infoLines.forEach((line, index) => {
        if (index === 0) {
          ctx.fillText(line, valueX, currentY);
        } else {
          ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
        }
      });
      currentY += (infoLines.length - 1) * labelFontSize * 1.1 + lineSpacing * 0.6;
    }

    // Frezowanie (millingType = frez_typ)
    if (millingType) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      ctx.fillText('Frezowanie:', textX, currentY);
      const frezLines = wrapText(ctx, millingType, availableValueWidth);
      frezLines.forEach((line, index) => {
        if (index === 0) {
          ctx.fillText(line, valueX, currentY);
        } else {
          ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
        }
      });
      currentY += (frezLines.length - 1) * labelFontSize * 1.1 + lineSpacing * 0.6;
    }

    // Czas oczekiwania (widths = czas_oczekiwania)
    if (widths) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      currentY += labelFontSize;
      // Display "Czas" on first line
      ctx.fillText('Czas', textX, currentY);
      currentY += labelFontSize * 1.1;
      // Display "oczekiwania:" on second line with value
      ctx.fillText('oczekiwania:', textX, currentY);
      ctx.fillText(widths, valueX, currentY);
      currentY += lineSpacing;
    }
  } else {
    // For plyty and blaty: existing logic

    // Producer
    if (producer) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      ctx.fillText('Producent:', textX, currentY);
      ctx.fillText(producer, valueX, currentY);
      currentY += labelFontSize + lineSpacing * 0.6;
    }

    // Thickness
    if (thickness !== '') {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      ctx.fillText('Grubość:', textX, currentY);
      ctx.fillText(thickness + 'mm', valueX, currentY);
      currentY += labelFontSize + lineSpacing * 0.6;
    }
  }

  // For płyty: show as "Wymiary: height x width"
  if (row.productType === 'plyty') {
    if (lengths && widths) {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      ctx.fillText('Wymiary:', textX, currentY);
      ctx.fillText(`${lengths} x ${widths}`, valueX, currentY);
      currentY += labelFontSize + lineSpacing;
    }
  } else if (row.productType === 'blaty' || row.productType === 'blaty_j') {
    // For blaty: show as separate "Szerokości" and "Długości"
    // Width
    if (widths && widths !== '') {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;

      // Draw label on first line
      ctx.fillText('Szerokości:', textX, currentY);

      // Wrap width values if too long, first line starts after label
      const widthLines = wrapText(ctx, widths, availableValueWidth);
      widthLines.forEach((line, index) => {
        if (index === 0) {
          // First line: starts right after label
          ctx.fillText(line, valueX, currentY);
        } else {
          // Wrapped lines: indent to align with first value
          ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
        }
      });
      currentY += widthLines.length * labelFontSize * 1.1 + lineSpacing * 0.6;
    }

    // Length
    if (lengths && lengths !== '') {
      ctx.fillStyle = '#333333';
      ctx.font = `${labelFontSize}px ${fontFamily}`;

      // Draw label on first line
      ctx.fillText('Długości:', textX, currentY);

      // Wrap length values if too long, first line starts after label
      const lengthLines = wrapText(ctx, lengths, availableValueWidth);
      lengthLines.forEach((line, index) => {
        if (index === 0) {
          // First line: starts right after label
          ctx.fillText(line, valueX, currentY);
        } else {
          // Wrapped lines: indent to align with first value
          ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
        }
      });
      currentY += lengthLines.length * labelFontSize * 1.1 + lineSpacing;
    }
  }
  // For fronty: dimensions handling is already done in the fronty-specific section above

  // Draw scan instruction below QR code (after all other text to avoid overlap)
  ctx.fillStyle = '#333333';
  ctx.font = `${scanFontSize}px ${scanFontFamily}`;

  const scanLine1Width = ctx.measureText(scanLine1).width;
  const scanLine2Width = ctx.measureText(scanLine2).width;

  // Ensure scan text stays within left section boundary
  const maxScanTextWidth = leftSectionWidth - Math.round(1 * MM_TO_PIXELS); // Leave small margin
  const scanTextMaxX = dims.paddingLeft + maxScanTextWidth;

  // Center first line within left section, but ensure it doesn't overflow
  let scanLine1X = qrX + (qrSizePx - scanLine1Width) / 2;
  // Clamp to left section
  scanLine1X = Math.max(dims.paddingLeft, Math.min(scanLine1X, scanTextMaxX - scanLine1Width));
  ctx.fillText(scanLine1, scanLine1X, scanTextY);

  // Center second line within left section, but ensure it doesn't overflow
  let scanLine2X = qrX + (qrSizePx - scanLine2Width) / 2;
  // Clamp to left section
  scanLine2X = Math.max(dims.paddingLeft, Math.min(scanLine2X, scanTextMaxX - scanLine2Width));
  ctx.fillText(scanLine2, scanLine2X, scanTextY + scanLineHeight);

  // Return the image as data URL
  return canvas.toDataURL('image/png');
}

export async function generateLabels(
  rows: CSVRow[],
  settings: AppSettings,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // Filter out excluded and invalid rows
  const validRows = rows.filter(row => row.isValid && !row.isExcluded);

  if (validRows.length === 0) {
    throw new Error('No valid rows to generate labels');
  }

  // Create a new ZIP file
  const zip = new JSZip();

  // Generate each label and add to ZIP
  for (let i = 0; i < validRows.length; i++) {
    if (onProgress) {
      onProgress(i + 1, validRows.length);
    }

    const row = validRows[i];
    const labelDataUrl = await drawLabel(row, settings);

    // Convert data URL to blob
    const base64Data = labelDataUrl.split(',')[1];
    const binaryData = atob(base64Data);
    const arrayBuffer = new Uint8Array(binaryData.length);
    for (let j = 0; j < binaryData.length; j++) {
      arrayBuffer[j] = binaryData.charCodeAt(j);
    }

    // Create safe file name - preserve Polish characters
    const safeFileName = row.productName
      .replace(/[<>:"/\\|?*]/g, '_') // Only remove characters that are invalid in filenames
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50);
    const fileName = `label_${i + 1}_${safeFileName}.png`;

    // Add image to ZIP
    zip.file(fileName, arrayBuffer, { binary: true });
  }

  // Generate and download ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  saveAs(zipBlob, `labels_${timestamp}.zip`);
}

// Export function to generate a single label (for preview)
export async function generateSingleLabel(
  row: CSVRow,
  settings: AppSettings
): Promise<string> {
  return drawLabel(row, settings);
}

// Export dimensions for reference
export const LABEL_DIMENSIONS = {
  widthMm: LABEL_WIDTH_MM,
  heightMm: LABEL_HEIGHT_MM,
  widthPx: LABEL_WIDTH_PX,
  heightPx: LABEL_HEIGHT_PX,
  dpi: DPI,
};
