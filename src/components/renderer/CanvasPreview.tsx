import React from 'react';
import { Project, Asset } from '../../lib/schemas/project';
import { RenderOptions } from '../../lib/renderer/types';
import { BackgroundRenderer } from './BackgroundRenderer';
import { OverlayRenderer } from './OverlayRenderer';

export interface CanvasPreviewProps extends RenderOptions {
  project: Project;
  assets?: Asset[];
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  project,
  assets,
  zoom = 1,
  showBackground = true,
  showOverlay = true,
}) => {
  const { canvas } = project;
  const scaledWidth = canvas.widthPx * zoom;
  const scaledHeight = canvas.heightPx * zoom;

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
          width: `${canvas.widthPx}px`,
          height: `${canvas.heightPx}px`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {showBackground && <BackgroundRenderer project={project} assets={assets} />}
        {showOverlay && <OverlayRenderer project={project} />}
      </div>
    </div>
  );
};
