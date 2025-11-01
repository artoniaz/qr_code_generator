import React, { useState } from 'react';
import type { CSVRow, AppSettings } from '../types.ts';
import { generateLabels } from '../utils/labelGenerator.ts';

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
      setError('Brak poprawnych wierszy do wygenerowania etykiet');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      await generateLabels(rows, settings, (current: number, total: number) => {
        setProgress({ current, total });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wygenerować etykiet');
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
        <div className="button-content">
          {isGenerating && (
            <div className="spinner"></div>
          )}
          <span className="button-text">
            {isGenerating ? (
              <>
                Generowanie...
                {progress.total > 0 && (
                  <span className="progress-text"> ({progress.current}/{progress.total})</span>
                )}
              </>
            ) : (
              <>Generuj etykiety ({validRows.length} etykiet)</>
            )}
          </span>
        </div>
      </button>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {validRows.length === 0 && rows.length > 0 && (
        <div className="warning-message">
          Brak poprawnych wierszy wybranych do generowania
        </div>
      )}
    </div>
  );
};
