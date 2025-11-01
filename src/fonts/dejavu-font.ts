// This file loads Roboto font for jsPDF that supports Polish characters

import { jsPDF } from 'jspdf';

let fontLoaded = false;

export async function loadDejaVuFont(pdf: jsPDF): Promise<boolean> {
  if (fontLoaded) return true;

  try {
    const response = await fetch('/Roboto-Regular.ttf');

    if (!response.ok) {
      console.warn('Could not load Roboto font, using default font');
      return false;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64 in chunks to handle large files
    let binary = '';
    const chunkSize = 8192;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    const base64 = btoa(binary);

    // Add font to jsPDF
    pdf.addFileToVFS('Roboto-Regular.ttf', base64);
    pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    // Set as default font
    pdf.setFont('Roboto', 'normal');

    fontLoaded = true;
    return true;
  } catch (error) {
    console.warn('Error loading Roboto font, using default font:', error);
    return false;
  }
}
