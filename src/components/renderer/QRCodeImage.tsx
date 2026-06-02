"use client";

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeImageProps {
  text: string;
  width: number;
  height: number;
}

export const QRCodeImage: React.FC<QRCodeImageProps> = ({ text, width, height }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!text) return;
    QRCode.toDataURL(text, { width, margin: 1 })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [text, width]);

  if (!dataUrl) {
    return (
      <div 
        style={{ width, height, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        data-testid="qr-code-placeholder"
      >
        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>QR</span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={dataUrl}
      alt="QR Code"
      data-testid="qr-code-img"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};
