import QRCode from 'qrcode';

export async function generateQRCode(url: string, sizeMM: number): Promise<string> {
  // Convert mm to pixels at 300 DPI for high quality
  // 1 inch = 25.4 mm, 300 DPI = 300 pixels per inch
  const sizePixels = Math.round((sizeMM / 25.4) * 300);

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: sizePixels,
      margin: 1,
      errorCorrectionLevel: 'M'
    });

    return dataUrl;
  } catch (error) {
    console.error('QR generation error:', error);
    throw new Error(`Failed to generate QR code: ${error}`);
  }
}

export function base64ToBuffer(dataUrl: string): Uint8Array {
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
