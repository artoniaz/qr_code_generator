import React, { useCallback, useState } from 'react';
import { getProductTypeOptions } from '../config/productTypes.ts';

interface UploadCSVProps {
  onFileSelect: (file: File, productType: string) => void;
}

export const UploadCSV: React.FC<UploadCSVProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState('plyty');
  const productTypeOptions = getProductTypeOptions();

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        onFileSelect(file, selectedProductType);
      } else {
        alert('Proszę przesłać plik CSV');
      }
    }
  }, [onFileSelect, selectedProductType]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0], selectedProductType);
    }
  }, [onFileSelect, selectedProductType]);

  return (
    <div className="upload-container">
      <div className="product-type-selector">
        <label htmlFor="product-type-select" className="product-type-label">
          Typ Produktu:
        </label>
        <select
          id="product-type-select"
          value={selectedProductType}
          onChange={(e) => setSelectedProductType(e.target.value)}
          className="product-type-select"
        >
          {productTypeOptions.map(option => (
            <option key={option.value} value={option.value} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="product-type-description">
          {productTypeOptions.find(opt => opt.value === selectedProductType)?.description}
        </p>
      </div>

      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          accept=".csv,.txt"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-input" className="upload-label">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="upload-text">
            <span className="upload-text-primary">Kliknij aby przesłać</span> lub przeciągnij i upuść
          </p>
          <p className="upload-text-secondary">Plik CSV lub TXT (separator: tabulator lub przecinek)</p>
        </label>
      </div>
    </div>
  );
};
