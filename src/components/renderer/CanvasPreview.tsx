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

  const scaledWidth = canvas.widthPx * numSlides * zoom;
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
          width: `${canvas.widthPx * numSlides}px`,
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
