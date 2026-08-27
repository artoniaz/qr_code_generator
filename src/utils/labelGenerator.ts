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

// Logo drawn in the bottom-left corner, below the scan instruction
const LOGO_SRC = '/logo.png';
const LOGO_SIZE_MM = 8.5;
const LOGO_SIZE_PX = Math.round(LOGO_SIZE_MM * MM_TO_PIXELS); // ~100 pixels

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

// drawLabel runs once per row, so the logo is cached at module level - otherwise
// a 500-row batch would re-fetch and re-decode the same image 500 times.
let logoPromise: Promise<HTMLImageElement | null> | null = null;

function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Missing logo must not break generation - labels are still usable without it
        console.warn(`Logo not found at ${LOGO_SRC} - generating labels without it`);
        resolve(null);
      };
      img.src = LOGO_SRC;
    });
  }
  return logoPromise;
}

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

// Some exports carry thickness as "18.0" where others use a plain "18". Strip a
// redundant trailing zero so the two read the same on the label, while keeping
// genuine fractional thicknesses like 18.3 intact. Values without a decimal
// separator are returned untouched, so "180" never becomes "18".
function formatThickness(value: string): string {
  if (!/[.,]/.test(value)) {
    return value;
  }
  return value.replace(/0+$/, '').replace(/[.,]$/, '');
}

// Two layouts need more rows than the fixed-size text block can hold: fronty,
// and a board that is also sold as a cut front - the latter has to state the
// terms of both sale forms on one 61 mm label. Rather than drawing at a fixed
// size and letting a long value run off the bottom edge unnoticed, these blocks
// are assembled as a list of rows, measured, and scaled down until they fit.
type LabelTextRow =
  | { kind: 'title'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'separator' }
  | { kind: 'field'; label: string; value: string };

interface LabelTextGeometry {
  textX: number;
  availableTextWidth: number;
  startY: number;
  maxY: number;
}

// Scaling stops here: below roughly three quarters of the base size the print
// stops being readable at arm's length, so one extreme row is better slightly
// clipped than every label uniformly illegible.
const MEASURED_MIN_SCALE = 0.72;
const MEASURED_SCALE_STEP = 0.02;

function isTextField(
  item: LabelTextRow
): item is Extract<LabelTextRow, { kind: 'field' }> {
  return item.kind === 'field';
}

export function usesMeasuredTextLayout(row: CSVRow): boolean {
  return row.productType === 'fronty' || row.cardData?.front !== undefined;
}

function buildLabelTextRows(row: CSVRow): LabelTextRow[] {
  const card = row.cardData;
  const rows: LabelTextRow[] = [{ kind: 'title', text: row.productName }];

  const addField = (label: string, value?: string) => {
    const text = (value || '').trim();
    if (text) {
      rows.push({ kind: 'field', label, value: text });
    }
  };

  if (card?.front) {
    // The board's own terms lead, because selling the whole sheet is the
    // primary form; the front cut from it follows below the rule.
    addField('Producent:', card.producer);
    addField('Typ:', card.structure);
    addField('Informacje:', card.info);
    addField('Dostępność:', card.leadTime);
    addField('Wymiary:', card.dimensions);
    addField('Forma sprzedaży:', 'arkusz');

    rows.push({ kind: 'separator' });
    rows.push({ kind: 'section', text: 'Front meblowy' });
    addField('Producent:', card.front.producer);
    addField('Frezowanie:', card.front.millingType);
    addField('Dostępność:', card.front.leadTime);
    addField('Forma sprzedaży:', 'sprzedaż na m²');

    return rows;
  }

  addField('Producent:', card?.producer);
  addField('Typ:', card?.structure);
  addField('Kolor:', card?.description);
  addField('Informacje:', card?.info);
  addField('Frezowanie:', card?.millingType);
  addField('Dostępność:', card?.leadTime);

  return rows;
}

// Draws the text block at the given scale and returns the Y it ends at. With
// `draw` false nothing is painted, which is how the fitting loop sizes up a
// candidate scale - keeping measurement and painting in one function is what
// stops the two from drifting apart.
function renderMeasuredText(
  ctx: CanvasRenderingContext2D,
  rows: LabelTextRow[],
  geom: LabelTextGeometry,
  scale: number,
  draw: boolean
): number {
  const fontFamily = 'Arial';
  const titleFontSize = Math.round(((16 * MM_TO_PIXELS) / 3 - 2) * scale);
  const labelFontSize = Math.round(((11 * MM_TO_PIXELS) / 3 - 2) * scale);
  const lineSpacing = Math.round(1.5 * MM_TO_PIXELS * scale);
  const rowGap = lineSpacing * 0.6;

  ctx.font = `${labelFontSize}px ${fontFamily}`;
  const labelWidths = rows
    .filter(isTextField)
    .map(item => ctx.measureText(item.label).width);
  const labelColumnWidth =
    (labelWidths.length > 0 ? Math.max(...labelWidths) : 0) +
    Math.round(1 * MM_TO_PIXELS * scale);
  const valueX = geom.textX + labelColumnWidth;
  const availableValueWidth = geom.availableTextWidth - labelColumnWidth;

  let currentY = geom.startY;

  for (const item of rows) {
    if (item.kind === 'title') {
      // Shrink an over-wide title before resorting to wrapping, so a long name
      // costs width rather than one of the few rows left.
      let titleSize = titleFontSize;
      ctx.font = `${titleSize}px ${fontFamily}`;
      while (
        ctx.measureText(item.text).width > geom.availableTextWidth &&
        titleSize > labelFontSize
      ) {
        titleSize -= 2;
        ctx.font = `${titleSize}px ${fontFamily}`;
      }

      const titleLines = wrapText(ctx, item.text, geom.availableTextWidth);
      if (draw) {
        ctx.fillStyle = 'black';
        titleLines.forEach((line, index) => {
          ctx.fillText(line, geom.textX, currentY + titleSize + index * titleSize * 1.2);
        });
      }
      currentY += titleSize + (titleLines.length - 1) * titleSize * 1.2 + lineSpacing;
    } else if (item.kind === 'section') {
      if (draw) {
        ctx.fillStyle = 'black';
        ctx.font = `bold ${labelFontSize}px ${fontFamily}`;
        ctx.fillText(item.text, geom.textX, currentY + labelFontSize);
      }
      currentY += labelFontSize + rowGap;
    } else if (item.kind === 'separator') {
      currentY += rowGap;
      if (draw) {
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = Math.max(1, Math.round(2 * scale));
        ctx.beginPath();
        ctx.moveTo(geom.textX, currentY);
        ctx.lineTo(geom.textX + geom.availableTextWidth, currentY);
        ctx.stroke();
      }
      currentY += rowGap;
    } else {
      ctx.font = `${labelFontSize}px ${fontFamily}`;
      const valueLines = wrapText(ctx, item.value, availableValueWidth);
      currentY += labelFontSize;
      if (draw) {
        ctx.fillStyle = '#333333';
        ctx.fillText(item.label, geom.textX, currentY);
        valueLines.forEach((line, index) => {
          ctx.fillText(line, valueX, currentY + index * labelFontSize * 1.1);
        });
      }
      currentY += (valueLines.length - 1) * labelFontSize * 1.1 + rowGap;
    }
  }

  return currentY;
}

function drawMeasuredText(
  ctx: CanvasRenderingContext2D,
  row: CSVRow,
  geom: LabelTextGeometry
): void {
  const rows = buildLabelTextRows(row);
  const budget = geom.maxY - geom.startY;
  const steps = Math.round((1 - MEASURED_MIN_SCALE) / MEASURED_SCALE_STEP);

  // Try the full size first and step down to the first scale that fits. Falling
  // through the whole range means even the floor overflows - draw at the floor
  // rather than shrinking past the point of legibility.
  let scale = MEASURED_MIN_SCALE;
  for (let step = 0; step <= steps; step++) {
    const candidate = 1 - step * MEASURED_SCALE_STEP;
    if (renderMeasuredText(ctx, rows, geom, candidate, false) - geom.startY <= budget) {
      scale = candidate;
      break;
    }
  }

  renderMeasuredText(ctx, rows, geom, scale, true);
}


// Fixed-size text block for the layouts that comfortably fit it: title,
// decor/structure, description and the label/value rows.
function drawStandardProductText(
  ctx: CanvasRenderingContext2D,
  row: CSVRow,
  textX: number,
  availableTextWidth: number,
  rightSectionMinY: number
): void {
  // Extract data based on product type
  let decor: string;
  let structure: string;
  let name: string;
  let description: string;
  let thickness: string;
  let producer: string;
  let widths: string;
  let lengths: string;

  if (row.productType === 'plyty' && row.cardData) {
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
    description = ''; // this format has no description column - kolekcja has its own row
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

  // Optional collection name from the CSV "kolekcja" column, printed under the
  // "Kolekcja:" label. Read straight from the raw row rather than through
  // getCardData(), since every product type uses the same column name. Accepts
  // either casing depending on how the export names the header.
  const collectionText = (row.rawData['kolekcja'] || row.rawData['Kolekcja'] || '').trim();

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

  // Draw decor and structure. Trimmed so a row with only one of the two does
  // not print a trailing space, and skipped entirely when both are empty rather
  // than reserving a blank line.
  const decorStructure = `${decor} ${structure}`.trim();
  if (decorStructure) {
    ctx.font = `${valueFontSize}px ${fontFamily}`;
    ctx.fillText(decorStructure, textX, currentY + valueFontSize);
    currentY += valueFontSize + lineSpacing;
  }

  // Table-like format for product details
  ctx.font = `${labelFontSize}px ${fontFamily}`;

  // Description
  if (description) {
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
  if (row.productType === 'plyty') {
    labelColumnWidth = Math.max(
      ctx.measureText('Kolekcja:').width,
      ctx.measureText('Producent:').width,
      ctx.measureText('Grubość:').width,
      ctx.measureText('Wymiary:').width
    ) + Math.round(1 * MM_TO_PIXELS);
  } else {
    labelColumnWidth = Math.max(
      ctx.measureText('Kolekcja:').width,
      ctx.measureText('Producent:').width,
      ctx.measureText('Grubość:').width,
      ctx.measureText('Szerokości:').width,
      ctx.measureText('Długości:').width
    ) + Math.round(1 * MM_TO_PIXELS);
  }

  const valueX = textX + labelColumnWidth;
  const availableValueWidth = availableTextWidth - labelColumnWidth;


  // Collection - value comes from the CSV "kolekcja" column
  if (collectionText) {
    ctx.fillStyle = '#333333';
    ctx.font = `${labelFontSize}px ${fontFamily}`;
    ctx.fillText('Kolekcja:', textX, currentY);
    const collectionLines = wrapText(ctx, collectionText, availableValueWidth);
    collectionLines.forEach((line, index) => {
      ctx.fillText(line, valueX, currentY + (index * labelFontSize * 1.1));
    });
    currentY += collectionLines.length * labelFontSize * 1.1 + lineSpacing * 0.6;
  }

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
    ctx.fillText(formatThickness(thickness) + 'mm', valueX, currentY);
    currentY += labelFontSize + lineSpacing * 0.6;
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

  // QR code fills 68% of the available height - leaves a band at the bottom
  // of the left column for the logo, below the scan instruction
  const qrSizePx = availableHeight * 0.68;
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

  if (usesMeasuredTextLayout(row)) {
    drawMeasuredText(ctx, row, {
      textX,
      availableTextWidth,
      startY: rightSectionMinY,
      maxY: dims.paddingTop + availableHeight,
    });
  } else {
    drawStandardProductText(ctx, row, textX, availableTextWidth, rightSectionMinY);
  }

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

  // Draw logo in the bottom-left corner, aligned with the left padding
  const logo = await loadLogo();
  if (logo) {
    // Fit into a square box while preserving the source aspect ratio
    const logoScale = Math.min(LOGO_SIZE_PX / logo.width, LOGO_SIZE_PX / logo.height);
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    const logoX = dims.paddingLeft;
    const logoY = canvas.height - dims.paddingBottom - logoHeight;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  }

  // Return the image as data URL
  return canvas.toDataURL('image/png');
}

// Every fronty label is titled "Front meblowy", so naming the files after the
// title alone would leave a folder of names that differ only by their running
// number. The colour is what tells those products apart on the label, so it
// joins the file name too - unless the title already carries it, which is how a
// row that does have a sheet is named.
function buildLabelFileName(row: CSVRow): string {
  const name = row.productName.trim();

  if (row.productType !== 'fronty') {
    return name;
  }

  const colour = (row.cardData?.description || '').trim();

  if (!colour || name.toLowerCase().includes(colour.toLowerCase())) {
    return name;
  }

  return `${name} ${colour}`;
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
    const safeFileName = buildLabelFileName(row)
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
