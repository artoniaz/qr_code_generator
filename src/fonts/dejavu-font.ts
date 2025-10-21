// This file loads Roboto font for jsPDF that supports Polish characters

import { jsPDF } from 'jspdf';

export async function loadDejaVuFont(pdf: jsPDF): Promise<boolean> {
  try {
    console.log('Loading Roboto font...');

    const response = await fetch('/Roboto-Regular.ttf');

    if (!response.ok) {
      console.error('Font file not found:', response.status);
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

    console.log('Roboto font loaded successfully - Polish characters supported!');
    return true;
  } catch (error) {
    console.error('Failed to load Roboto font:', error);
    return false;
  }
}
