import React from 'react';
import type { CSVRow } from '../types.ts';

interface PreviewTableProps {
  rows: CSVRow[];
  onToggleExclude: (index: number) => void;
  maxRows?: number;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  rows,
  onToggleExclude,
  maxRows = 10
}) => {
  const displayRows = rows.slice(0, maxRows);
  const hasMore = rows.length > maxRows;

  const validCount = rows.filter(r => r.isValid && !r.isExcluded).length;
  const invalidCount = rows.filter(r => !r.isValid).length;
  const excludedCount = rows.filter(r => r.isExcluded).length;

  return (
    <div className="preview-container">
      <div className="preview-header">
        <h2>Podgląd CSV</h2>
        <div className="preview-stats">
          <span className="stat-item stat-valid">Poprawne: {validCount}</span>
          <span className="stat-item stat-invalid">Niepoprawne: {invalidCount}</span>
          <span className="stat-item stat-excluded">Wykluczone: {excludedCount}</span>
          <span className="stat-item stat-total">Razem: {rows.length}</span>
        </div>
      </div>

      {rows.length > 1000 && (
        <div className="warning-banner">
          Uwaga: Twój plik zawiera {rows.length} wierszy. Przetwarzanie bardzo dużych plików może
          wpłynąć na wydajność. Rozważ podział na mniejsze pliki.
        </div>
      )}

      <div className="table-wrapper">
        <table className="preview-table">
          <thead>
            <tr>
              <th className="col-checkbox">Uwzględnij</th>
              <th className="col-status">Status</th>
              <th className="col-name">Nazwa Produktu</th>
              <th className="col-url">URL</th>
              <th className="col-errors">Problemy</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr
                key={index}
                className={`${!row.isValid ? 'row-invalid' : ''} ${row.isExcluded ? 'row-excluded' : ''}`}
              >
                <td className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={!row.isExcluded}
                    onChange={() => onToggleExclude(index)}
                    disabled={!row.isValid}
                  />
                </td>
                <td className="col-status">
                  <span className={`status-badge ${row.isValid ? 'status-valid' : 'status-invalid'}`}>
                    {row.isValid ? '✓' : '✗'}
                  </span>
                </td>
                <td className="col-name">{row.productName || '(puste)'}</td>
                <td className="col-url">
                  <div className="url-cell" title={row.url}>
                    {row.url || '(puste)'}
                  </div>
                </td>
                <td className="col-errors">
                  {row.errors.length > 0 && (
                    <ul className="error-list">
                      {row.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="preview-footer">
          Pokazano pierwsze {maxRows} z {rows.length} wierszy
        </div>
      )}
    </div>
  );
};
