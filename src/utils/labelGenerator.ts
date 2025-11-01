import type { CSVRow, AppSettings } from '../types.ts';
import { generateQRCode } from './qrGenerator.ts';

// Brother QL label printer specifications
// 62mm × 100mm label at 300 DPI
const LABEL_WIDTH_MM = 62;
const LABEL_HEIGHT_MM = 100;
const DPI = 300;

// Convert mm to pixels at 300 DPI
const MM_TO_PIXELS = DPI / 25.4;
const LABEL_WIDTH_PX = Math.round(LABEL_WIDTH_MM * MM_TO_PIXELS); // 732 pixels
const LABEL_HEIGHT_PX = Math.round(LABEL_HEIGHT_MM * MM_TO_PIXELS); // 1181 pixels

// Padding and spacing in pixels
const PADDING_PX = Math.round(5 * MM_TO_PIXELS); // ~59 pixels
const TEXT_SPACING_PX = Math.round(3 * MM_TO_PIXELS); // ~35 pixels

interface LabelDimensions {
  width: number;
  height: number;
  padding: number;
  textSpacing: number;
}

function getLabelDimensions(): LabelDimensions {
  return {
    width: LABEL_WIDTH_PX,
    height: LABEL_HEIGHT_PX,
    padding: PADDING_PX,
    textSpacing: TEXT_SPACING_PX,
  };
}

async function loadFont(fontFamily: string, fontUrl: string): Promise<boolean> {
  try {
    const font = new FontFace(fontFamily, `url(${fontUrl})`);
    await font.load();
    document.fonts.add(font);
    return true;
  } catch (error) {
    console.warn(`Failed to load font ${fontFamily}:`, error);
    return false;
  }
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

  // Try to load Roboto font (similar to what PDF used)
  const fontLoaded = await loadFont('Roboto', '/Roboto-Regular.ttf');

  // Generate QR code at appropriate size for label
  // Convert QR size from mm to pixels
  const qrSizePx = Math.round(settings.qrSize * MM_TO_PIXELS);
  const qrDataUrl = await generateQRCode(row.url, settings.qrSize);

  // Draw QR code
  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('Failed to load QR code'));
    qrImage.src = qrDataUrl;
  });

  const qrX = dims.padding;
  const qrY = dims.padding;
  ctx.drawImage(qrImage, qrX, qrY, qrSizePx, qrSizePx);

  // Draw optional border for debugging
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Text configuration
  const textX = qrX + qrSizePx + dims.textSpacing;
  const availableTextWidth = canvas.width - textX - dims.padding;

  // Draw product name (bold, larger font)
  ctx.fillStyle = 'black';
  const productNameFontSize = Math.round(12 * MM_TO_PIXELS / 3); // ~47 pixels (12pt at 300 DPI)
  ctx.font = `${productNameFontSize}px ${fontLoaded ? 'Roboto' : 'Arial'}`;

  const productNameLines = wrapText(ctx, row.productName, availableTextWidth);
  let currentY = qrY + productNameFontSize;
  const lineHeight = productNameFontSize * 1.2;

  productNameLines.forEach((line, index) => {
    ctx.fillText(line, textX, currentY + (index * lineHeight));
  });

  // Draw description (smaller, gray text)
  const descriptionFontSize = Math.round(8 * MM_TO_PIXELS / 3); // ~31 pixels (8pt at 300 DPI)
  ctx.font = `${descriptionFontSize}px ${fontLoaded ? 'Roboto' : 'Arial'}`;
  ctx.fillStyle = '#666666';

  const descriptionY = currentY + (productNameLines.length * lineHeight) + Math.round(2 * MM_TO_PIXELS);
  const descriptionLines = wrapText(ctx, 'zeskanuj, aby poznać szczegóły i cenę', availableTextWidth);

  descriptionLines.forEach((line, index) => {
    ctx.fillText(line, textX, descriptionY + (index * descriptionFontSize * 1.3));
  });

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

  // Generate each label and download
  for (let i = 0; i < validRows.length; i++) {
    if (onProgress) {
      onProgress(i + 1, validRows.length);
    }

    const row = validRows[i];
    const labelDataUrl = await drawLabel(row, settings);

    // Create download link
    const link = document.createElement('a');
    const safeFileName = row.productName
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50);
    link.download = `label_${i + 1}_${safeFileName}.png`;
    link.href = labelDataUrl;
    link.click();

    // Small delay between downloads to avoid browser blocking
    if (i < validRows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
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
