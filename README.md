# QR Code Card Generator

A React + Vite application that generates Word documents (.docx) containing cards with QR codes from CSV files. The entire application runs in the browser - no backend required.

## Features

- Upload CSV files via drag & drop or file picker
- Automatic delimiter detection (comma or tab separated)
- CSV validation with error reporting
- Preview and exclude specific rows
- Adjustable QR code size and card height
- Generates A4 pages with 3-column layout
- Professional card design with product name and QR code
- Fully offline - all processing happens in the browser

## Installation

```bash
cd qr-card-generator
npm install
```

## Running the Application

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`).

## CSV Format

The application expects CSV files with the following structure:

- **Field at index 1** (second column): Product Name
- **Field at index 5** (sixth column): URL for QR code

Example CSV row (tab-separated):

```
recH0IoWaAy9p16Ld	0110_SM_2800x2070_18	0110	SM	BIAŁY KORPUSOWY	https://azmproducts.plasmic.run/product/recH0IoWaAy9p16Ld	PLN 215,84	Extra Data
```

A sample CSV file (`sample.csv`) is included in the project directory with 20 test records.

## Document Layout

The generated Word document uses precise A4 layout specifications:

- **Page size**: A4 (210mm × 297mm)
- **Margins**: 12mm on all sides
- **Layout**: 3 columns per page
- **Card width**: 60mm (fixed)
- **Card height**: Configurable (default 50mm)
- **Gap between cards**: 3mm (horizontal and vertical)
- **Cards per page**: 15 (3 columns × 5 rows with default settings)

### Card Design

Each card contains:

- QR code on the left (default 28mm, configurable 20-40mm)
- Product name (bold) on the right
- Subtitle text: "zaskanuj aby zobaczyć szczegóły i cenę"
- 4mm internal padding

## Usage

1. **Upload CSV File**

   - Click the upload area or drag & drop your CSV file
   - Supports both comma and tab-separated files

2. **Review Data**

   - Check the preview table for validation errors
   - View statistics: valid, invalid, excluded, and total rows
   - Uncheck rows you want to exclude from the document

3. **Configure Settings**

   - Adjust QR code size (20-40mm)
   - Adjust card height (40-80mm)
   - View calculated cards per page

4. **Generate Document**
   - Click "Generate .docx" button
   - Wait for generation to complete
   - File will be automatically downloaded as `qrcards.docx`

## Validation

The application validates:

- Empty product names
- Empty or invalid URLs (must start with http:// or https://)
- Duplicate URLs (warnings)
- Large files (>1000 rows show performance warning)

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **papaparse** for CSV parsing
- **qrcode** for QR code generation
- **docx** for Word document generation
- **file-saver** for file downloads

## Project Structure

```
src/
├── components/
│   ├── UploadCSV.tsx          # File upload with drag & drop
│   ├── PreviewTable.tsx       # CSV data preview and validation
│   ├── SettingsPanel.tsx      # QR/card size configuration
│   └── GenerateButton.tsx     # Document generation trigger
├── utils/
│   ├── csvParser.ts           # CSV parsing and validation logic
│   ├── qrGenerator.ts         # QR code generation
│   └── docxGenerator.ts       # Word document generation
├── types.ts                   # TypeScript type definitions
├── App.tsx                    # Main application component
└── App.css                    # Application styles
```

## Building for Production

```bash
npm run build
```

The production build will be created in the `dist` directory.

## Browser Compatibility

The application works in all modern browsers that support:

- ES6+ JavaScript
- File API
- Blob API
- Canvas API (for QR code generation)

## License

This project is provided as-is for use in generating QR code cards from CSV data.
