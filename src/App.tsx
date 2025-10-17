import { useState } from 'react';
import './App.css';
import { UploadCSV } from './components/UploadCSV.tsx';
import { PreviewTable } from './components/PreviewTable.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { GenerateButton } from './components/GenerateButton.tsx';
import type { CSVRow, AppSettings } from './types.ts';
import { parseCSVFile, checkDuplicates } from './utils/csvParser.ts';

function App() {
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    qrSize: 24,
    cardHeight: 36,
    productType: 'plyty'
  });

  const handleFileSelect = async (file: File, productType: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Update settings with the selected product type
      setSettings(prev => ({ ...prev, productType }));

      const rows = await parseCSVFile(file, productType);
      const rowsWithDuplicates = checkDuplicates(rows);
      setCsvRows(rowsWithDuplicates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      console.error('CSV parsing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExclude = (index: number) => {
    setCsvRows(prev => {
      const newRows = [...prev];
      newRows[index] = {
        ...newRows[index],
        isExcluded: !newRows[index].isExcluded
      };
      return newRows;
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>QR Code Card Generator</h1>
        <p>Generate Word documents with QR code cards from CSV files</p>
      </header>

      <main className="app-main">
        {csvRows.length === 0 ? (
          <div className="upload-section">
            <UploadCSV onFileSelect={handleFileSelect} />
            {isLoading && <div className="loading">Loading CSV file...</div>}
            {error && <div className="error-message">{error}</div>}
          </div>
        ) : (
          <>
            <div className="controls-section">
              <button
                className="clear-button"
                onClick={() => setCsvRows([])}
              >
                Load Different File
              </button>
            </div>

            <div className="content-grid">
              <div className="content-main">
                <PreviewTable
                  rows={csvRows}
                  onToggleExclude={handleToggleExclude}
                />
              </div>

              <div className="content-sidebar">
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={setSettings}
                />

                <GenerateButton
                  rows={csvRows}
                  settings={settings}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Select a product type before uploading your CSV file. Each product type has different field mappings.
        </p>
      </footer>
    </div>
  );
}

export default App;
