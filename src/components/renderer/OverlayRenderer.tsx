"use client";

import React, { useState, useEffect } from 'react';
import { Project, LayoutElement } from '../../lib/schemas/project';
import { fitText } from '../../lib/layout/textFit';
import { getElementText } from './BackgroundRenderer';
import { useEditorStore } from '../../lib/store/editorStore';
import { QRCodeImage } from './QRCodeImage';

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

interface DragState {
  elementId: string;
  type: 'drag' | 'resize';
  handle?: 'nw' | 'ne' | 'se' | 'sw';
  startX: number;
  startY: number;
  startElementX: number;
  startElementY: number;
  startElementW: number;
  startElementH: number;
}

export const OverlayRenderer: React.FC<OverlayRendererProps> = ({ project }) => {
  const { canvas, brand, layout } = project;
  const elements = layout.elements || [];

  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const selectElement = useEditorStore((state) => state.selectElement);
  const updateLayoutElements = useEditorStore((state) => state.updateLayoutElements);
  const zoom = useEditorStore((state) => state.zoom);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tempCoords, setTempCoords] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleElementMouseDown = (e: React.MouseEvent, el: LayoutElement) => {
    e.stopPropagation();
    selectElement(el.id);

    setDragState({
      elementId: el.id,
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      startElementX: el.x,
      startElementY: el.y,
      startElementW: el.width,
      startElementH: el.height,
    });

    setTempCoords({
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: LayoutElement, handle: 'nw' | 'ne' | 'se' | 'sw') => {
    e.stopPropagation();
    e.preventDefault();

    setDragState({
      elementId: el.id,
      type: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startElementX: el.x,
      startElementY: el.y,
      startElementW: el.width,
      startElementH: el.height,
    });

    setTempCoords({
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / zoom;
      const dy = (e.clientY - dragState.startY) / zoom;

      const safeMarginPx = canvas.safeMarginPx;
      const maxRight = canvas.widthPx - safeMarginPx;
      const maxBottom = canvas.heightPx - safeMarginPx;

      if (dragState.type === 'drag') {
        const calculatedX = dragState.startElementX + dx;
        const calculatedY = dragState.startElementY + dy;

        const newX = Math.max(safeMarginPx, Math.min(canvas.widthPx - safeMarginPx - dragState.startElementW, calculatedX));
        const newY = Math.max(safeMarginPx, Math.min(canvas.heightPx - safeMarginPx - dragState.startElementH, calculatedY));

        setTempCoords({
          x: newX,
          y: newY,
          width: dragState.startElementW,
          height: dragState.startElementH,
        });
      } else if (dragState.type === 'resize' && dragState.handle) {
        let newX = dragState.startElementX;
        let newY = dragState.startElementY;
        let newW = dragState.startElementW;
        let newH = dragState.startElementH;

        const handle = dragState.handle;

        if (handle === 'nw') {
          const targetX = dragState.startElementX + dx;
          const targetY = dragState.startElementY + dy;

          newX = Math.max(safeMarginPx, targetX);
          newW = Math.max(120, dragState.startElementW - (newX - dragState.startElementX));
          if (newW === 120) {
            newX = dragState.startElementX + dragState.startElementW - 120;
          }

          newY = Math.max(safeMarginPx, targetY);
          newH = Math.max(60, dragState.startElementH - (newY - dragState.startElementY));
          if (newH === 60) {
            newY = dragState.startElementY + dragState.startElementH - 60;
          }
        } else if (handle === 'ne') {
          const targetY = dragState.startElementY + dy;
          const targetW = dragState.startElementW + dx;

          newY = Math.max(safeMarginPx, targetY);
          newH = Math.max(60, dragState.startElementH - (newY - dragState.startElementY));
          if (newH === 60) {
            newY = dragState.startElementY + dragState.startElementH - 60;
          }

          newW = Math.max(120, Math.min(maxRight - dragState.startElementX, targetW));
        } else if (handle === 'se') {
          const targetW = dragState.startElementW + dx;
          const targetH = dragState.startElementH + dy;

          newW = Math.max(120, Math.min(maxRight - dragState.startElementX, targetW));
          newH = Math.max(60, Math.min(maxBottom - dragState.startElementY, targetH));
        } else if (handle === 'sw') {
          const targetX = dragState.startElementX + dx;
          const targetH = dragState.startElementH + dy;

          newX = Math.max(safeMarginPx, targetX);
          newW = Math.max(120, dragState.startElementW - (newX - dragState.startElementX));
          if (newW === 120) {
            newX = dragState.startElementX + dragState.startElementW - 120;
          }

          newH = Math.max(60, Math.min(maxBottom - dragState.startElementY, targetH));
        }

        setTempCoords({
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      }
    };

    const handleMouseUp = () => {
      if (tempCoords) {
        updateLayoutElements([
          {
            id: dragState.elementId,
            x: tempCoords.x,
            y: tempCoords.y,
            width: tempCoords.width,
            height: tempCoords.height,
          },
        ]);
      }
      setDragState(null);
      setTempCoords(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tempCoords, zoom, canvas.widthPx, canvas.heightPx, canvas.safeMarginPx, updateLayoutElements]);

  const handleStyle = {
    position: 'absolute' as const,
    width: '8px',
    height: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #3b82f6',
    borderRadius: '50%',
    zIndex: 10,
  };

  const numSlides = project.layout?.layoutFamily === 'social_carousel'
    ? (() => {
        const elementsList = project.layout.elements || [];
        let maxSlidesFromElements = 1;
        if (elementsList.length > 0) {
          const maxX = Math.max(...elementsList.map(el => el.x + el.width));
          maxSlidesFromElements = Math.max(1, Math.ceil(maxX / canvas.widthPx));
        }
        
        const visibleSections = project.content.sections.filter(
          (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
        );
        let contentSlidesCount = 0;
        visibleSections.forEach((section) => {
          const visibleItems = section.items.filter((item) => item.visibility !== 'hidden');
          contentSlidesCount += Math.ceil(visibleItems.length / 4);
        });
        const maxSlidesFromContent = 1 + contentSlidesCount + 1;
        return Math.max(maxSlidesFromElements, maxSlidesFromContent);
      })()
    : 1;

  const totalWidth = canvas.widthPx * numSlides;

  return (
    <div
      data-testid="overlay-renderer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${totalWidth}px`,
        height: `${canvas.heightPx}px`,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          selectElement(null);
        }
      }}
    >
      {elements.map((el: LayoutElement) => {
        const isSelected = selectedElementId === el.id;
        const currentX = (dragState?.elementId === el.id && tempCoords) ? tempCoords.x : el.x;
        const currentY = (dragState?.elementId === el.id && tempCoords) ? tempCoords.y : el.y;
        const currentWidth = (dragState?.elementId === el.id && tempCoords) ? tempCoords.width : el.width;
        const currentHeight = (dragState?.elementId === el.id && tempCoords) ? tempCoords.height : el.height;

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
              data-testid={`qr-code-overlay-${el.id}`}
              style={{
                position: 'absolute',
                left: `${currentX}px`,
                top: `${currentY}px`,
                width: `${currentWidth}px`,
                height: `${currentHeight}px`,
                backgroundColor: '#FFFFFF',
                border: isSelected ? '1.5px solid #3b82f6' : `1px solid ${brand.colors.muted || '#CCCCCC'}`,
                borderRadius: '4px',
                overflow: 'visible',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'move',
                pointerEvents: 'auto',
                boxSizing: 'border-box',
              }}
              onMouseDown={(e) => handleElementMouseDown(e, el)}
            >
              <QRCodeImage text={qrText} width={currentWidth} height={currentHeight} />
              
              {isSelected && (
                <>
                  <div
                    data-testid={`resize-handle-nw-${el.id}`}
                    style={{ ...handleStyle, top: '-4px', left: '-4px', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')}
                  />
                  <div
                    data-testid={`resize-handle-ne-${el.id}`}
                    style={{ ...handleStyle, top: '-4px', right: '-4px', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')}
                  />
                  <div
                    data-testid={`resize-handle-se-${el.id}`}
                    style={{ ...handleStyle, bottom: '-4px', right: '-4px', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')}
                  />
                  <div
                    data-testid={`resize-handle-sw-${el.id}`}
                    style={{ ...handleStyle, bottom: '-4px', left: '-4px', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')}
                  />
                </>
              )}
            </div>
          );
        }

        if (el.type === 'ai_instruction_zone') {
          const isRenderCanvas = typeof window !== 'undefined' && window.location.pathname.includes('/render-canvas');
          if (isRenderCanvas) return null;

          return (
            <div
              key={el.id}
              data-testid={`ai-instruction-zone-overlay-${el.id}`}
              style={{
                position: 'absolute',
                left: `${currentX}px`,
                top: `${currentY}px`,
                width: `${currentWidth}px`,
                height: `${currentHeight}px`,
                border: isSelected ? '2px dashed #3b82f6' : '2px dashed #9333ea',
                backgroundColor: 'rgba(147, 51, 234, 0.05)',
                color: '#9333ea',
                padding: '8px',
                boxSizing: 'border-box',
                overflow: 'visible',
                cursor: 'move',
                pointerEvents: 'auto',
                fontSize: '12px',
                fontWeight: 'semibold',
              }}
              onMouseDown={(e) => handleElementMouseDown(e, el)}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>AI Instruction Zone</div>
              <div>{el.contentRef}</div>

              {isSelected && (
                <>
                  <div
                    data-testid={`resize-handle-nw-${el.id}`}
                    style={{ ...handleStyle, top: '-4px', left: '-4px', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')}
                  />
                  <div
                    data-testid={`resize-handle-ne-${el.id}`}
                    style={{ ...handleStyle, top: '-4px', right: '-4px', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')}
                  />
                  <div
                    data-testid={`resize-handle-se-${el.id}`}
                    style={{ ...handleStyle, bottom: '-4px', right: '-4px', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')}
                  />
                  <div
                    data-testid={`resize-handle-sw-${el.id}`}
                    style={{ ...handleStyle, bottom: '-4px', left: '-4px', cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')}
                  />
                </>
              )}
            </div>
          );
        }

        const isTextElement = ['text', 'price', 'badge', 'footer', 'section_header'].includes(el.type);

        if (!isTextElement) {
          return null;
        }

        const text = getElementText(el, project);
        if (!text) {
          return null;
        }

        let baseFontSize = el.style.fontSize || 14;
        if (el.type === 'section_header' && !el.style.fontSize) {
          baseFontSize = 28;
        }

        const fit = fitText(text, currentWidth, currentHeight, baseFontSize);
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
              left: `${currentX}px`,
              top: `${currentY}px`,
              width: `${currentWidth}px`,
              height: `${currentHeight}px`,
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              color: color,
              textAlign: textAlign,
              fontWeight: fontWeight,
              lineHeight: '1.2',
              overflow: 'visible',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              cursor: 'move',
              outline: isSelected ? '1.5px solid #3b82f6' : 'none',
              pointerEvents: 'auto',
              ...containerShadowStyle,
            }}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
          >
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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

            {isSelected && (
              <>
                <div
                  data-testid={`resize-handle-nw-${el.id}`}
                  style={{ ...handleStyle, top: '-4px', left: '-4px', cursor: 'nwse-resize' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')}
                />
                <div
                  data-testid={`resize-handle-ne-${el.id}`}
                  style={{ ...handleStyle, top: '-4px', right: '-4px', cursor: 'nesw-resize' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')}
                />
                <div
                  data-testid={`resize-handle-se-${el.id}`}
                  style={{ ...handleStyle, bottom: '-4px', right: '-4px', cursor: 'nwse-resize' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')}
                />
                <div
                  data-testid={`resize-handle-sw-${el.id}`}
                  style={{ ...handleStyle, bottom: '-4px', left: '-4px', cursor: 'nesw-resize' }}
                  onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
