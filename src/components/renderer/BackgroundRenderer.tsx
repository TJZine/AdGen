"use client";

import React from 'react';
import { Project, Asset } from '../../lib/schemas/project';
import { fitText } from '../../lib/layout/textFit';
import { QRCodeImage } from './QRCodeImage';
import { getElementText } from '../../lib/renderer/utils';

export interface BackgroundRendererProps {
  project: Project;
  assets?: Asset[];
}

export const BackgroundRenderer: React.FC<BackgroundRendererProps> = ({ project, assets }) => {
  const { canvas, brand, layout } = project;
  const elements = layout.elements || [];

  const isRenderCanvas =
    typeof window !== 'undefined' &&
    window.location.pathname.includes('/render-canvas');

  const polishedBg = project.polishedBackground;
  const hasPolishedBg = !!polishedBg?.assetId;
  const polishedAsset = hasPolishedBg ? assets?.find((a) => a.id === polishedBg.assetId) : null;

  const numSlides = project.layout?.layoutFamily === 'social_carousel'
    ? project.content.sections.length
    : 1;

  const totalWidth = canvas.widthPx * numSlides;

  return (
    <div
      data-testid="background-renderer"
      style={{
        position: 'relative',
        width: `${totalWidth}px`,
        height: `${canvas.heightPx}px`,
        backgroundColor: brand.colors.background,
        overflow: 'hidden',
      }}
    >
      {(hasPolishedBg && polishedAsset) ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={polishedAsset.filePath}
          alt="Polished Background"
          data-testid="polished-background-image"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: polishedBg.fitMode === 'stretch' ? 'fill' : (polishedBg.fitMode as 'cover' | 'contain'),
            transform: `translate(${polishedBg.offsetX}px, ${polishedBg.offsetY}px) scale(${polishedBg.scale})`,
            opacity: polishedBg.opacity,
          }}
        />
      ) : (
        elements.map((el) => {
          const isTextElement = ['text', 'price', 'badge', 'footer', 'section_header'].includes(el.type);

          if (isTextElement) {
            const text = getElementText(el, project);
            if (!text) return null;

            let baseFontSize = el.style.fontSize || 14;
            if (el.type === 'section_header' && !el.style.fontSize) {
              baseFontSize = 28;
            }
            const fit = fitText(text, el.width, el.height, baseFontSize);
            const textAlign = el.style.textAlign || 'left';
            const alignSelf =
              textAlign === 'center'
                ? 'center'
                : textAlign === 'right'
                ? 'flex-end'
                : 'flex-start';

            // Render solid gray blocks representing text lines, omitting all actual text characters
            return (
              <div
                key={el.id}
                data-testid={`mask-${el.id}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: alignSelf,
                  pointerEvents: 'none',
                  gap: `${Math.max(2, fit.fontSize * 0.2)}px`,
                }}
              >
                {fit.lines.map((_, idx) => {
                  const isLastLine = idx === fit.lines.length - 1;
                  const widthPercent = fit.lines.length > 1 && isLastLine ? '60%' : '90%';
                  return (
                    <div
                      key={idx}
                      data-testid={`mask-line-${el.id}-${idx}`}
                      style={{
                        backgroundColor: '#CCCCCC',
                        borderRadius: `${Math.max(2, fit.fontSize * 0.1)}px`,
                        width: widthPercent,
                        height: `${fit.fontSize * 0.6}px`,
                      }}
                    />
                  );
                })}
              </div>
            );
          }

          if (el.type === 'item_card') {
            return (
              <div
                key={el.id}
                data-testid={`item-card-${el.contentRef}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  border: el.style.border ? `2px solid ${brand.colors.muted || '#CCCCCC'}` : 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '8px',
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (el.type === 'image') {
            const asset = assets?.find((a) => a.id === el.contentRef);
            const focalX = asset?.focalPoint?.x ?? 0.5;
            const focalY = asset?.focalPoint?.y ?? 0.5;

            // Determine object-fit based on whether it is a logo or standard image fit mode
            const isLogo = asset?.type === 'logo' || el.contentRef === brand.logoAssetId;
            const fitMode = isLogo
              ? 'contain'
              : el.style.variant === 'contain'
              ? 'contain'
              : 'cover'; // crop / cover centered around focalPoint coordinates

            return (
              <div
                key={el.id}
                data-testid={`image-frame-${el.id}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  backgroundColor: '#EAEAEA',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {asset ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={asset.filePath}
                    alt={asset.name}
                    data-testid={`image-${el.id}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: fitMode,
                      objectPosition: `${focalX * 100}% ${focalY * 100}%`,
                    }}
                  />
                ) : (
                  <div
                    data-testid={`image-placeholder-${el.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#999999"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        width: '24px',
                        height: '24px',
                        opacity: 0.5,
                      }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>
            );
          }

          if (el.type === 'shape' || el.type === 'background') {
            return (
              <div
                key={el.id}
                data-testid={`shape-${el.id}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  backgroundColor: el.style.backgroundColor || brand.colors.muted || '#CCCCCC',
                  opacity: el.style.opacity ?? 1,
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (el.type === 'qr_code') {
            let qrText = el.contentRef;
            if (qrText === 'brand.website') {
              qrText = brand.website;
            }
            if (!qrText) {
              qrText = brand.website || 'https://example.com';
            }

            return (
              <div
                key={el.id}
                data-testid={`qr-code-frame-${el.id}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${brand.colors.muted || '#CCCCCC'}`,
                  borderRadius: '4px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <QRCodeImage text={qrText} width={el.width} height={el.height} />
              </div>
            );
          }

          if (el.type === 'ai_instruction_zone') {
            if (isRenderCanvas) return null;

            return (
              <div
                key={el.id}
                data-testid={`ai-instruction-zone-${el.id}`}
                style={{
                  position: 'absolute',
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  border: '2px dashed #9333ea',
                  backgroundColor: 'rgba(147, 51, 234, 0.05)',
                  color: '#9333ea',
                  padding: '8px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  fontSize: '12px',
                  fontWeight: 'semibold',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>AI Instruction Zone</div>
                <div>{el.contentRef}</div>
              </div>
            );
          }

          // Return empty container for non-visual layout components (like groups, transparent zones)
          return (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                pointerEvents: 'none',
              }}
            />
          );
        })
      )}
    </div>
  );
};
