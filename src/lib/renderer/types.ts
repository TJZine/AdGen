/**
 * Shared options for rendering the AdGen canvas editor/preview.
 */
export interface RenderOptions {
  /**
   * Zoom/scaling factor for the canvas (e.g. 1.0 = 100%, 0.5 = 50%)
   */
  zoom?: number;

  /**
   * Whether structural elements, canvas background, shapes, and images are visible
   */
  showBackground?: boolean;

  /**
   * Whether the transparent text overlay containing headlines, paragraphs, and prices is visible
   */
  showOverlay?: boolean;
}
