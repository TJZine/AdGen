import React from 'react';
import { Project, LayoutElement } from '../../lib/schemas/project';
import { fitText } from '../../lib/layout/textFit';
import { getElementText } from './BackgroundRenderer';

export interface OverlayRendererProps {
  project: Project;
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
            }}
          >
            {fit.lines.map((line, idx) => (
              <div key={idx} style={{ whiteSpace: 'nowrap' }}>
                {line}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
