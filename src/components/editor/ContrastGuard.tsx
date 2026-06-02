"use client";

import React, { useEffect, useState } from 'react';
import { Project, Asset } from '@/lib/schemas/project';

interface ContrastGuardProps {
  project: Project;
  assets: Asset[];
}

interface WarningState {
  [elementId: string]: {
    ratio: number;
    threshold: number;
    isCompliant: boolean;
  };
}

export function hexToRgb(hex: string) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16),
    };
  }
  if (cleanHex.length === 6 || cleanHex.length === 8) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function isDarkColor(hex: string): boolean {
  if (!hex) return true;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  }
  if (cleanHex.length === 6 || cleanHex.length === 8) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  }
  return true;
}

export const ContrastGuard: React.FC<ContrastGuardProps> = ({ project, assets }) => {
  const [warnings, setWarnings] = useState<WarningState>({});

  const polishedBg = project.polishedBackground;
  const asset = assets.find((a) => a.id === polishedBg?.assetId);
  const imageSrc = asset?.filePath;

  useEffect(() => {
    if (!imageSrc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarnings({});
      return;
    }

    let active = true;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      if (!active) return;
      const canvasEl = document.createElement('canvas');
      canvasEl.width = project.canvas.widthPx;
      canvasEl.height = project.canvas.heightPx;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      const cw = project.canvas.widthPx;
      const ch = project.canvas.heightPx;
      const iw = img.width;
      const ih = img.height;
      const imgRatio = iw / ih;
      const canvasRatio = cw / ch;

      let dw = cw;
      let dh = ch;
      let dx = 0;
      let dy = 0;

      const fitMode = polishedBg?.fitMode ?? 'cover';
      if (fitMode === 'cover') {
        if (imgRatio > canvasRatio) {
          dw = ch * imgRatio;
          dh = ch;
          dx = (cw - dw) / 2;
        } else {
          dw = cw;
          dh = cw / imgRatio;
          dy = (ch - dh) / 2;
        }
      } else if (fitMode === 'contain') {
        if (imgRatio > canvasRatio) {
          dw = cw;
          dh = cw / imgRatio;
          dy = (ch - dh) / 2;
        } else {
          dw = ch * imgRatio;
          dh = ch;
          dx = (cw - dw) / 2;
        }
      } else {
        dw = cw;
        dh = ch;
      }

      const offsetX = polishedBg?.offsetX ?? 0;
      const offsetY = polishedBg?.offsetY ?? 0;
      const scale = polishedBg?.scale ?? 1;

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.globalAlpha = polishedBg?.opacity ?? 1;
      
      // Center transform matching CSS
      ctx.translate(cw / 2, ch / 2);
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.translate(-cw / 2, -ch / 2);
      
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();

      const elements = project.layout.elements || [];
      const newWarnings: WarningState = {};

      elements.forEach((el) => {
        const isTextElement = ['text', 'price', 'badge', 'footer', 'section_header'].includes(el.type);
        if (!isTextElement) return;

        const rx = Math.max(0, Math.min(cw - 1, Math.round(el.x)));
        const ry = Math.max(0, Math.min(ch - 1, Math.round(el.y)));
        const rw = Math.max(1, Math.min(cw - rx, Math.round(el.width)));
        const rh = Math.max(1, Math.min(ch - ry, Math.round(el.height)));

        try {
          const imgData = ctx.getImageData(rx, ry, rw, rh);
          const data = imgData.data;

          let totalLuminance = 0;
          let count = 0;

          const textColor = el.style.color || project.brand.colors.primary;
          const isDark = isDarkColor(textColor);
          const preset = polishedBg?.legibilityPreset ?? 'none';

          for (let i = 0; i < data.length; i += 4) {
            const aVal = data[i + 3] / 255;
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Blend transparent pixels with brand background
            if (aVal < 1) {
              const bgRgb = hexToRgb(project.brand.colors.background || '#FFFFFF');
              r = r * aVal + bgRgb.r * (1 - aVal);
              g = g * aVal + bgRgb.g * (1 - aVal);
              b = b * aVal + bgRgb.b * (1 - aVal);
            }

            if (preset === 'backing_plate') {
              const plateAlpha = isDark ? 0.7 : 0.5;
              const plateColor = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
              r = r * (1 - plateAlpha) + plateColor.r * plateAlpha;
              g = g * (1 - plateAlpha) + plateColor.g * plateAlpha;
              b = b * (1 - plateAlpha) + plateColor.b * plateAlpha;
            }

            totalLuminance += getRelativeLuminance(r, g, b);
            count++;
          }

          const avgBgLuminance = count > 0 ? totalLuminance / count : 0;
          const rgbText = hexToRgb(textColor);
          const textLuminance = getRelativeLuminance(rgbText.r, rgbText.g, rgbText.b);

          const l1 = textLuminance;
          const l2 = avgBgLuminance;
          const ratio = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);

          const isLargeText = el.type === 'section_header' ||
                              el.contentRef === 'content.headline' ||
                              el.contentRef === 'content.subheadline' ||
                              (el.style.fontSize && el.style.fontSize >= 24);
          const threshold = isLargeText ? 3.0 : 4.5;
          const isCompliant = ratio >= threshold;

          if (!isCompliant) {
            newWarnings[el.id] = {
              ratio,
              threshold,
              isCompliant,
            };
          }
        } catch (e) {
          console.error(`Error sampling image data for element ${el.id}:`, e);
        }
      });

      if (!active) return;
      setWarnings(newWarnings);
    };

    img.onerror = (e) => {
      if (!active) return;
      console.error('Error loading image for ContrastGuard:', e);
      setWarnings({});
    };

    return () => {
      active = false;
    };
  }, [
    imageSrc,
    project.layout.elements,
    project.brand.colors.background,
    project.brand.colors.primary,
    project.canvas.widthPx,
    project.canvas.heightPx,
    polishedBg?.fitMode,
    polishedBg?.offsetX,
    polishedBg?.offsetY,
    polishedBg?.scale,
    polishedBg?.opacity,
    polishedBg?.legibilityPreset,
  ]);

  if (!imageSrc) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${project.canvas.widthPx}px`,
        height: `${project.canvas.heightPx}px`,
        pointerEvents: 'none',
      }}
    >
      {Object.entries(warnings).map(([elementId, warn]) => {
        const el = project.layout.elements.find((e) => e.id === elementId);
        if (!el || warn.isCompliant) return null;

        return (
          <div
            key={elementId}
            data-testid={`contrast-warning-${elementId}`}
            style={{
              position: 'absolute',
              left: `${el.x + el.width - 28}px`,
              top: `${el.y - 8}px`,
              width: '24px',
              height: '24px',
              backgroundColor: '#EF4444',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              cursor: 'help',
              pointerEvents: 'auto',
              zIndex: 50,
            }}
            title={`Contrast ratio (${warn.ratio.toFixed(2)}:1) below WCAG AA required (${warn.threshold}:1)`}
          >
            ⚠️
          </div>
        );
      })}
    </div>
  );
};
