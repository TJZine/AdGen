import React from 'react';
import { Project, LayoutElement } from '../../lib/schemas/project';
import { fitText } from '../../lib/layout/textFit';
import { getElementText } from './BackgroundRenderer';

export interface OverlayRendererProps {
  project: Project;
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

export const OverlayRenderer: React.FC<OverlayRendererProps> = ({ project }) => {
  const { canvas, brand, layout } = project;
  const elements = layout.elements || [];

  return (
    <div
      data-testid="overlay-renderer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${canvas.widthPx}px`,
        height: `${canvas.heightPx}px`,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {elements.map((el: LayoutElement) => {
        const isTextElement = ['text', 'price', 'badge', 'footer', 'section_header'].includes(el.type);

        if (!isTextElement) {
          return null;
        }

        const text = getElementText(el, project);
        if (!text) {
          return null;
        }

        // Determine base font size depending on element type
        let baseFontSize = el.style.fontSize || 14;
        if (el.type === 'section_header' && !el.style.fontSize) {
          baseFontSize = 28;
        }

        // Fit text using the solver's wrapping and scaling rules
        const fit = fitText(text, el.width, el.height, baseFontSize);
        const fontSize = fit.fontSize;
        const color = el.style.color || brand.colors.primary;
        const fontFamily = el.style.fontFamily || brand.fontPreferences.body;
        const textAlign = el.style.textAlign || 'left';
        const fontWeight = el.style.fontWeight || (el.type === 'section_header' ? 'bold' : 'normal');

        const preset = project.polishedBackground?.legibilityPreset ?? 'none';
        const outlineColor = isDarkColor(color) ? '#FFFFFF' : '#000000';

        const containerShadowStyle = preset === 'drop_shadow' ? {
          textShadow: '1px 2px 4px rgba(0,0,0,0.85)',
        } : {};

        const textStrokeStyle = preset === 'text_outline' ? {
          WebkitTextStroke: `1px ${outlineColor}`,
        } as React.CSSProperties : {};

        const backingPlateStyle = preset === 'backing_plate' ? {
          backgroundColor: isDarkColor(color) ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          padding: '2px 8px',
          borderRadius: '4px',
          display: 'inline-block',
        } as React.CSSProperties : {};

        return (
          <div
            key={el.id}
            data-testid={`text-overlay-${el.id}`}
            style={{
              position: 'absolute',
              left: `${el.x}px`,
              top: `${el.y}px`,
              width: `${el.width}px`,
              height: `${el.height}px`,
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              color: color,
              textAlign: textAlign,
              fontWeight: fontWeight,
              lineHeight: '1.2',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              ...containerShadowStyle,
            }}
          >
            {fit.lines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  whiteSpace: 'nowrap',
                  margin: preset === 'backing_plate' ? '2px 0' : '0',
                }}
              >
                {preset === 'backing_plate' ? (
                  <span style={backingPlateStyle}>{line}</span>
                ) : (
                  <span style={textStrokeStyle}>{line}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
