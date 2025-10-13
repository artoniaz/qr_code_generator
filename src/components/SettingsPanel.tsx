import React from 'react';
import type { AppSettings } from '../types.ts';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange
}) => {
  const handleQRSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value >= 20 && value <= 40) {
      onSettingsChange({ ...settings, qrSize: value });
    }
  };

  const handleCardHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value >= 40 && value <= 80) {
      onSettingsChange({ ...settings, cardHeight: value });
    }
  };

  return (
    <div className="settings-panel">
      <h3>Settings</h3>

      <div className="setting-item">
        <label htmlFor="qr-size">
          QR Code Size: {settings.qrSize} mm
        </label>
        <input
          id="qr-size"
          type="range"
          min="20"
          max="40"
          step="1"
          value={settings.qrSize}
          onChange={handleQRSizeChange}
          className="slider"
        />
        <div className="setting-range">
          <span>20 mm</span>
          <span>40 mm</span>
        </div>
      </div>

      <div className="setting-item">
        <label htmlFor="card-height">
          Card Height: {settings.cardHeight} mm
        </label>
        <input
          id="card-height"
          type="range"
          min="40"
          max="80"
          step="5"
          value={settings.cardHeight}
          onChange={handleCardHeightChange}
          className="slider"
        />
        <div className="setting-range">
          <span>40 mm</span>
          <span>80 mm</span>
        </div>
      </div>

      <div className="settings-info">
        <p className="info-text">
          Card width is fixed at 60 mm (3 columns per A4 page)
        </p>
        <p className="info-text">
          Cards per page: {Math.floor((273 + 3) / (settings.cardHeight + 3)) * 3}
        </p>
      </div>
    </div>
  );
};
