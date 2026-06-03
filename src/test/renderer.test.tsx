import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackgroundRenderer } from '../components/renderer/BackgroundRenderer';
import { OverlayRenderer } from '../components/renderer/OverlayRenderer';
import { CanvasPreview } from '../components/renderer/CanvasPreview';
import { Project, Asset } from '../lib/schemas/project';

const mockProject: Project = {
  schemaVersion: '1.0.0',
  id: 'project-1',
  name: 'Test Project',
  type: 'inventory_board',
  canvas: {
    id: 'custom-preset',
    name: 'Custom Preset',
    widthPx: 1000,
    heightPx: 1500,
    dpi: 300,
    safeMarginPx: 50,
    unit: 'px',
  },
  brand: {
    id: 'brand-1',
    brandName: 'Test Brand',
    logoAssetId: 'logo-asset-1',
    website: 'https://test.com',
    phone: '123-456-7890',
    email: 'info@test.com',
    defaultFooter: 'Footer contact info',
    defaultDisclaimer: 'All rights reserved.',
    colors: {
      background: '#ffffff',
      primary: '#ff0000',
      secondary: '#00ff00',
      muted: '#cccccc',
    },
    styleKeywords: ['clean'],
    fontPreferences: {
      heading: 'Helvetica',
      body: 'Arial',
      price: 'Georgia',
    },
  },
  content: {
    headline: 'Summer Sale!',
    subheadline: 'Up to 50% off select items',
    sections: [
      {
        id: 'sec-1',
        title: 'Featured Products',
        subtitle: 'Our top picks',
        priority: 'high',
        layoutHint: 'grid',
        order: 0,
        items: [
          {
            id: 'item-1',
            sectionId: 'sec-1',
            title: 'Fancy Chair',
            subtitle: 'Comfortable seating',
            description: 'A very comfy wooden chair.',
            price: 199.99,
            priceDisplay: '$199.99',
            salePrice: 150.0,
            badge: 'SALE',
            imageAssetId: 'image-asset-1',
            priority: 'normal',
            visibility: 'visible',
            layoutHints: {
              cardSize: 'normal',
              imageFit: 'crop',
              preferredAspectRatio: '4:3',
            },
            metadata: { tags: [] },
          },
        ],
      },
    ],
  },
  layout: {
    elements: [
      {
        id: 'header-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: 50,
        y: 50,
        width: 900,
        height: 80,
        locked: false,
        style: {
          fontSize: 48,
          fontFamily: 'Helvetica',
          color: '#ff0000',
          textAlign: 'center',
        },
      },
      {
        id: 'item-card-item-1',
        type: 'item_card',
        contentRef: 'item-1',
        x: 50,
        y: 200,
        width: 400,
        height: 350,
        locked: false,
        style: {
          border: true,
        },
      },
      {
        id: 'item-image-item-1',
        type: 'image',
        contentRef: 'image-asset-1',
        x: 60,
        y: 210,
        width: 380,
        height: 150,
        locked: false,
        style: {
          variant: 'crop',
        },
      },
      {
        id: 'item-title-item-1',
        type: 'text',
        contentRef: 'item-1.title',
        x: 60,
        y: 370,
        width: 380,
        height: 40,
        locked: false,
        style: {
          fontSize: 18,
          fontFamily: 'Helvetica',
          color: '#00ff00',
        },
      },
      {
        id: 'item-price-item-1',
        type: 'price',
        contentRef: 'item-1.price',
        x: 60,
        y: 420,
        width: 380,
        height: 30,
        locked: false,
        style: {
          fontSize: 16,
          fontFamily: 'Georgia',
          color: '#ff0000',
        },
      },
      {
        id: 'footer-container',
        type: 'footer',
        contentRef: 'brand.defaultFooter',
        x: 50,
        y: 1400,
        width: 900,
        height: 50,
        locked: false,
        style: {
          fontSize: 12,
          fontFamily: 'Arial',
          color: '#cccccc',
        },
      },
    ],
    layoutFamily: 'inventory_board',
    density: 'normal',
    score: 95,
    warnings: [],
  },
  exportSettings: {
    exactTextOverlay: true,
    aiPolishMode: 'background_and_style',
    finalFormats: ['png'],
  },
  polishedBackground: {
    assetId: null,
    fitMode: 'cover',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
    legibilityPreset: 'none',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  layoutVariants: [],
  activeVariantId: null,
};

const mockAssets: Asset[] = [
  {
    id: 'image-asset-1',
    name: 'Fancy Chair Photo',
    type: 'image',
    filePath: '/assets/chair.jpg',
    thumbnailPath: null,
    mimeType: 'image/jpeg',
    sizeBytes: 102400,
    dimensions: { width: 800, height: 600 },
    focalPoint: { x: 0.3, y: 0.7 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'logo-asset-1',
    name: 'Company Logo',
    type: 'logo',
    filePath: '/assets/logo.png',
    thumbnailPath: null,
    mimeType: 'image/png',
    sizeBytes: 51200,
    dimensions: { width: 200, height: 200 },
    focalPoint: { x: 0.5, y: 0.5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Renderer Components', () => {
  describe('BackgroundRenderer', () => {
    it('renders card outlines and images but contains no textual characters', () => {
      const { container } = render(
        <BackgroundRenderer project={mockProject} assets={mockAssets} />
      );

      // Verify that card outline is rendered
      expect(screen.getByTestId('item-card-item-1')).toBeInTheDocument();

      // Verify that image is rendered
      const img = screen.getByTestId('image-item-image-item-1');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/assets/chair.jpg');

      // Verify focal point position cropping styles are applied via objectPosition and objectFit
      expect(img.style.objectPosition).toBe('30% 70%');
      expect(img.style.objectFit).toBe('cover');

      // Verify it contains no textual characters of headlines, titles, descriptions, or prices
      const textContent = container.textContent || '';
      expect(textContent.trim()).toBe('');

      expect(textContent).not.toContain('Summer Sale!');
      expect(textContent).not.toContain('Fancy Chair');
      expect(textContent).not.toContain('Comfortable seating');
      expect(textContent).not.toContain('A very comfy wooden chair.');
      expect(textContent).not.toContain('199.99');
      expect(textContent).not.toContain('Footer contact info');

      // Verify that solid gray mask elements exist
      expect(screen.getByTestId('mask-header-headline')).toBeInTheDocument();
      expect(screen.getByTestId('mask-item-title-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('mask-item-price-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('mask-footer-container')).toBeInTheDocument();

      // Verify mask lines are generated representing lines
      expect(screen.getByTestId('mask-line-header-headline-0')).toBeInTheDocument();
      expect(screen.getByTestId('mask-line-item-title-item-1-0')).toBeInTheDocument();
    });

    it('renders absolutely no text characters even when assets are missing', () => {
      const { container } = render(
        <BackgroundRenderer project={mockProject} assets={[]} />
      );

      // Verify it contains no textual characters at all (including "Placeholder Image")
      const textContent = container.textContent || '';
      expect(textContent.trim()).toBe('');
      expect(textContent).not.toContain('Placeholder Image');

      // Verify that the visual placeholder element is rendered
      expect(screen.getByTestId('image-placeholder-item-image-item-1')).toBeInTheDocument();
    });
  });

  describe('OverlayRenderer', () => {
    it('renders titles, prices, and disclaimer details at their correct coordinates', () => {
      render(<OverlayRenderer project={mockProject} />);

      // Verify headline overlay
      const headlineEl = screen.getByTestId('text-overlay-header-headline');
      expect(headlineEl).toBeInTheDocument();
      expect(headlineEl).toHaveTextContent('Summer Sale!');
      expect(headlineEl.style.left).toBe('50px');
      expect(headlineEl.style.top).toBe('50px');
      expect(headlineEl.style.width).toBe('900px');
      expect(headlineEl.style.height).toBe('80px');
      expect(headlineEl.style.color).toBe('rgb(255, 0, 0)'); // Hex #ff0000 maps to rgb in JSDOM
      expect(headlineEl.style.fontFamily).toBe('Helvetica');

      // Verify item title overlay
      const titleEl = screen.getByTestId('text-overlay-item-title-item-1');
      expect(titleEl).toBeInTheDocument();
      expect(titleEl).toHaveTextContent('Fancy Chair');
      expect(titleEl.style.left).toBe('60px');
      expect(titleEl.style.top).toBe('370px');
      expect(titleEl.style.width).toBe('380px');
      expect(titleEl.style.height).toBe('40px');

      // Verify price overlay
      const priceEl = screen.getByTestId('text-overlay-item-price-item-1');
      expect(priceEl).toBeInTheDocument();
      expect(priceEl).toHaveTextContent('$199.99');
      expect(priceEl.style.left).toBe('60px');
      expect(priceEl.style.top).toBe('420px');

      // Verify footer disclaimer overlay
      const footerEl = screen.getByTestId('text-overlay-footer-container');
      expect(footerEl).toBeInTheDocument();
      expect(footerEl).toHaveTextContent('Footer contact info All rights reserved.');
      expect(footerEl.style.left).toBe('50px');
      expect(footerEl.style.top).toBe('1400px');
    });
  });

  describe('CanvasPreview', () => {
    it('handles zoom level scaling and stacks background and overlay', () => {
      const zoom = 1.5;
      render(
        <CanvasPreview
          project={mockProject}
          assets={mockAssets}
          zoom={zoom}
          showBackground={true}
          showOverlay={true}
        />
      );

      // Verify container scaling
      const containerEl = screen.getByTestId('canvas-preview-container');
      expect(containerEl.style.width).toBe(`${1000 * zoom}px`);
      expect(containerEl.style.height).toBe(`${1500 * zoom}px`);

      // Verify scale wrapper transform zoom factor is applied
      const scaleWrapperEl = screen.getByTestId('canvas-preview-scale-wrapper');
      expect(scaleWrapperEl.style.transform).toBe(`scale(${zoom})`);
      expect(scaleWrapperEl.style.transformOrigin).toBe('top left');

      // Verify BackgroundRenderer and OverlayRenderer are nested inside CanvasPreview
      expect(screen.getByTestId('background-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('overlay-renderer')).toBeInTheDocument();
    });
  });
});
