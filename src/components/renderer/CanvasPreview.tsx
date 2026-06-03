import React from 'react';
import { Project, Asset } from '../../lib/schemas/project';
import { RenderOptions } from '../../lib/renderer/types';
import { BackgroundRenderer } from './BackgroundRenderer';
import { OverlayRenderer } from './OverlayRenderer';

import { getNumSlides } from '@/lib/layout/solver';

export interface CanvasPreviewProps extends RenderOptions {
  project: Project;
  assets?: Asset[];
  isRenderMode?: boolean;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  project,
  assets,
  zoom = 1,
  showBackground = true,
  showOverlay = true,
  isRenderMode = false,
}) => {
  const { canvas } = project;
  const numSlides = getNumSlides(project);

  // Clamp and sanitize zoom to a finite positive number with a minimum bound of 0.01
  const sanitizedZoom = typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0
    ? Math.max(0.01, zoom)
    : 1;

  const scaledWidth = canvas.widthPx * numSlides * sanitizedZoom;
  const scaledHeight = canvas.heightPx * sanitizedZoom;

  return (
    <div
      data-testid="canvas-preview-container"
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        data-testid="canvas-preview-scale-wrapper"
        style={{
          width: `${canvas.widthPx * numSlides}px`,
          height: `${canvas.heightPx}px`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${sanitizedZoom})`,
          transformOrigin: 'top left',
        }}
      >
        {showBackground && <BackgroundRenderer project={project} assets={assets} />}
        {showOverlay && <OverlayRenderer project={project} isRenderMode={isRenderMode} />}
      </div>
    </div>
  );
};
