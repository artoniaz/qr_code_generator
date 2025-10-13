import React, { useState } from 'react';
import type { CSVRow, AppSettings } from '../types.ts';
import { generatePdf } from '../utils/pdfGenerator.ts';

interface GenerateButtonProps {
  rows: CSVRow[];
  settings: AppSettings;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({ rows, settings }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const validRows = rows.filter(r => r.isValid && !r.isExcluded);

  const handleGenerate = async () => {
    if (validRows.length === 0) {
      setError('No valid rows to generate document');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      await generatePdf(rows, settings, (current, total) => {
        setProgress({ current, total });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="generate-container">
      <button
        className="generate-button"
        onClick={handleGenerate}
        disabled={isGenerating || validRows.length === 0}
      >
        {isGenerating ? (
          <span>
            Generating... {progress.total > 0 && `(Page ${progress.current}/${progress.total})`}
          </span>
        ) : (
          <span>Generate PDF ({validRows.length} cards)</span>
        )}
      </button>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {validRows.length === 0 && rows.length > 0 && (
        <div className="warning-message">
          No valid rows selected for generation
        </div>
      )}
    </div>
  );
};
