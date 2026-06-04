"use client";

import React, { useRef } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { calculateNormalizedCoords } from '@/lib/utils/crop';
import { Section, Item, LayoutElement } from '@/lib/schemas/project';

export const RightInspector: React.FC = () => {
  const {
    project,
    assets,
    selectedElementId,
    updateItem,
    updateSection,
    updateProjectField,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const polishedBg = project.polishedBackground || {
    assetId: null,
    fitMode: 'cover',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
    legibilityPreset: 'none',
  };

  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Client-side validation: limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB limit');
      return;
    }

    // Client-side validation: allowed MIME types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Unsupported file type. Only JPEG, PNG, and WebP are allowed.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }
      const newAsset = await res.json();

      useEditorStore.getState().addAsset(newAsset);

      updateProjectField('polishedBackground.assetId', newAsset.id);
    } catch (err) {
      console.error('Failed to upload background:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image. Please try again.');
    }
  };

  // 1. Identify selected element type and find its reference
  let selectedType: 'item' | 'section' | 'layout_element' | 'general' = 'general';
  let selectedItem: Item | null = null;
  let selectedSection: Section | null = null;
  let selectedLayoutElement: LayoutElement | null = null;

  const foundLayoutElement = project.layout?.elements?.find((el) => el.id === selectedElementId);
  if (foundLayoutElement && (foundLayoutElement.type === 'qr_code' || foundLayoutElement.type === 'ai_instruction_zone')) {
    selectedType = 'layout_element';
    selectedLayoutElement = foundLayoutElement;
  } else {
    for (const s of project.content.sections) {
      if (s.id === selectedElementId) {
        selectedType = 'section';
        selectedSection = s;
        break;
      }
      const foundItem = s.items.find((it) => it.id === selectedElementId);
      if (foundItem) {
        selectedType = 'item';
        selectedItem = foundItem;
        break;
      }
    }
  }

  const handleLayoutElementFieldChange = (updates: Partial<typeof selectedLayoutElement>) => {
    if (!selectedLayoutElement) return;
    const nextElements = (project.layout.elements || []).map((el) => {
      if (el.id === selectedLayoutElement.id) {
        return {
          ...el,
          ...updates,
          locked: true,
        };
      }
      return el;
    });
    updateProjectField('layout.elements', nextElements);
  };

  // Handle Focal Point Crop click
  const handleFocalPointClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const coords = calculateNormalizedCoords(e.clientX, e.clientY, rect);
    updateItem(selectedItem.id, { focalPoint: coords });
  };

  const handleItemFieldChange = <K extends keyof Item>(key: K, value: Item[K]) => {
    if (!selectedItem) return;
    updateItem(selectedItem.id, { [key]: value });
  };

  const handleSectionFieldChange = <K extends keyof Section>(key: K, value: Section[K]) => {
    if (!selectedSection) return;
    updateSection(selectedSection.id, { [key]: value });
  };

  // RENDER ITEM INSPECTOR
  if (selectedType === 'item' && selectedItem) {
    const itemAsset = assets.find((a) => a.id === selectedItem?.imageAssetId);
    const focal = selectedItem.focalPoint || { x: 0.5, y: 0.5 };

    return (
      <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 gap-5 text-sm text-zinc-700">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">Inspector</span>
          <h2 className="text-base font-bold text-zinc-950 truncate">{selectedItem.title || 'Item details'}</h2>
        </div>

        <hr className="border-zinc-200" />

        {/* Form Fields */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Title</label>
            <input
              type="text"
              value={selectedItem.title}
              onChange={(e) => handleItemFieldChange('title', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Subtitle</label>
            <input
              type="text"
              value={selectedItem.subtitle || ''}
              onChange={(e) => handleItemFieldChange('subtitle', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Description</label>
            <textarea
              value={selectedItem.description || ''}
              onChange={(e) => handleItemFieldChange('description', e.target.value)}
              rows={3}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Price ($)</label>
              <input
                type="number"
                step="any"
                value={selectedItem.price !== null ? selectedItem.price : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleItemFieldChange('price', val === '' ? null : parseFloat(val));
                }}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Price Display Override</label>
              <input
                type="text"
                value={selectedItem.priceDisplay || ''}
                onChange={(e) => handleItemFieldChange('priceDisplay', e.target.value)}
                placeholder="e.g. From $10/hr"
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Badge</label>
              <input
                type="text"
                value={selectedItem.badge || ''}
                onChange={(e) => handleItemFieldChange('badge', e.target.value || null)}
                placeholder="e.g. HOT"
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 uppercase"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Priority</label>
              <select
                value={selectedItem.priority || 'normal'}
                onChange={(e) => handleItemFieldChange('priority', e.target.value as 'hero' | 'featured' | 'normal' | 'compact')}
                className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                <option value="hero">Hero (largest)</option>
                <option value="featured">Featured (large)</option>
                <option value="normal">Normal</option>
                <option value="compact">Compact (small)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Image Asset</label>
            <select
              value={selectedItem.imageAssetId || ''}
              onChange={(e) => handleItemFieldChange('imageAssetId', e.target.value || null)}
              className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="">No Image</option>
              {assets
                .filter((a) => a.type === 'image' || a.type === 'logo')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.filePath.split('/').pop()})
                  </option>
                ))}
            </select>
          </div>

          {/* Interactive Click-to-Focal-Crop */}
          {itemAsset && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-zinc-900">Image Focal Crop</label>
                <span className="text-xs text-zinc-500 font-mono">
                  x: {focal.x.toFixed(2)}, y: {focal.y.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-tight">
                Click on the thumbnail to reposition the crop target focal point.
              </p>
              <div
                ref={containerRef}
                onClick={handleFocalPointClick}
                data-testid="focal-crop-container"
                className="relative border border-zinc-300 rounded overflow-hidden cursor-crosshair select-none bg-zinc-100 flex items-center justify-center w-full aspect-[4/3] group hover:border-zinc-500 transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={itemAsset.filePath}
                  alt={itemAsset.name}
                  className="w-full h-full object-contain pointer-events-none"
                />
                {/* Focal Point Crosshair target */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${focal.x * 100}%`,
                    top: `${focal.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  data-testid="focal-crosshair"
                  className="w-7 h-7 border-2 border-red-600 rounded-full flex items-center justify-center pointer-events-none shadow bg-red-100/35"
                >
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // RENDER SECTION INSPECTOR
  if (selectedType === 'section' && selectedSection) {
    return (
      <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 gap-5 text-sm text-zinc-700">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">Inspector</span>
          <h2 className="text-base font-bold text-zinc-950 truncate">{selectedSection.title || 'Section details'}</h2>
        </div>

        <hr className="border-zinc-200" />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Section Title</label>
            <input
              type="text"
              value={selectedSection.title}
              onChange={(e) => handleSectionFieldChange('title', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Subtitle</label>
            <input
              type="text"
              value={selectedSection.subtitle || ''}
              onChange={(e) => handleSectionFieldChange('subtitle', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Priority Weight</label>
            <select
              value={selectedSection.priority || 'normal'}
              onChange={(e) => handleSectionFieldChange('priority', e.target.value as 'high' | 'normal' | 'low')}
              className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="high">High (allocates more space)</option>
              <option value="normal">Normal</option>
              <option value="low">Low (allocates less space)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Layout Style hint</label>
            <select
              value={selectedSection.layoutHint || 'grid'}
              onChange={(e) => handleSectionFieldChange('layoutHint', e.target.value as 'grid' | 'list' | 'featured_hero')}
              className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="grid">Grid (default)</option>
              <option value="list">Vertical List</option>
              <option value="featured_hero">Featured Hero Card First</option>
            </select>
          </div>
        </div>
      </aside>
    );
  }

  // RENDER LAYOUT ELEMENT INSPECTOR (QR Code & AI Instruction Zone)
  if (selectedType === 'layout_element' && selectedLayoutElement) {
    const isQrCode = selectedLayoutElement.type === 'qr_code';
    return (
      <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 gap-5 text-sm text-zinc-700">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">Inspector</span>
          <h2 className="text-base font-bold text-zinc-950 truncate">
            {isQrCode ? 'QR Code Element' : 'AI Instruction Zone'}
          </h2>
        </div>

        <hr className="border-zinc-200" />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">
              {isQrCode ? 'QR Value / Link' : 'Instruction Note'}
            </label>
            {isQrCode ? (
              <input
                type="text"
                value={selectedLayoutElement.contentRef}
                onChange={(e) => handleLayoutElementFieldChange({ contentRef: e.target.value })}
                placeholder="e.g. brand.website or custom link"
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
            ) : (
              <textarea
                value={selectedLayoutElement.contentRef}
                onChange={(e) => handleLayoutElementFieldChange({ contentRef: e.target.value })}
                placeholder="Instruction text for AI visual generation"
                rows={4}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">X (px)</label>
              <input
                type="number"
                value={selectedLayoutElement.x}
                onChange={(e) => handleLayoutElementFieldChange({ x: parseInt(e.target.value) || 0 })}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Y (px)</label>
              <input
                type="number"
                value={selectedLayoutElement.y}
                onChange={(e) => handleLayoutElementFieldChange({ y: parseInt(e.target.value) || 0 })}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Width (px)</label>
              <input
                type="number"
                value={selectedLayoutElement.width}
                onChange={(e) => handleLayoutElementFieldChange({ width: parseInt(e.target.value) || 0 })}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-zinc-900">Height (px)</label>
              <input
                type="number"
                value={selectedLayoutElement.height}
                onChange={(e) => handleLayoutElementFieldChange({ height: parseInt(e.target.value) || 0 })}
                className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 font-mono"
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // RENDER GENERAL CANVAS & BRAND INSPECTOR
  return (
    <aside className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 gap-5 text-sm text-zinc-700">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">Inspector</span>
        <h2 className="text-base font-bold text-zinc-950 truncate">General Settings</h2>
      </div>

      <hr className="border-zinc-200" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Project Name</label>
          <input
            type="text"
            value={project.name}
            onChange={(e) => updateProjectField('name', e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Headline</label>
          <input
            type="text"
            value={project.content.headline || ''}
            onChange={(e) => updateProjectField('content.headline', e.target.value)}
            placeholder="Main flyer headline"
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Subheadline</label>
          <input
            type="text"
            value={project.content.subheadline || ''}
            onChange={(e) => updateProjectField('content.subheadline', e.target.value)}
            placeholder="Subheadline underneath"
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Brand Name</label>
          <input
            type="text"
            value={project.brand.brandName || ''}
            onChange={(e) => updateProjectField('brand.brandName', e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Website</label>
          <input
            type="text"
            value={project.brand.website || ''}
            onChange={(e) => updateProjectField('brand.website', e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Phone</label>
            <input
              type="text"
              value={project.brand.phone || ''}
              onChange={(e) => updateProjectField('brand.phone', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Email</label>
            <input
              type="email"
              value={project.brand.email || ''}
              onChange={(e) => updateProjectField('brand.email', e.target.value)}
              className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Default Footer</label>
          <input
            type="text"
            value={project.brand.defaultFooter || ''}
            onChange={(e) => updateProjectField('brand.defaultFooter', e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Default Disclaimer</label>
          <input
            type="text"
            value={project.brand.defaultDisclaimer || ''}
            onChange={(e) => updateProjectField('brand.defaultDisclaimer', e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-zinc-900">Brand Logo</label>
          <select
            value={project.brand.logoAssetId || ''}
            onChange={(e) => updateProjectField('brand.logoAssetId', e.target.value || null)}
            className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
          >
            <option value="">No Logo</option>
            {assets
              .filter((a) => a.type === 'logo' || a.type === 'image')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.filePath.split('/').pop()})
                </option>
              ))}
          </select>
        </div>

        {/* Polished Background Settings */}
        <div className="flex flex-col gap-3 mt-4 border-t border-zinc-200 pt-4">
          <h3 className="font-bold text-zinc-950 text-sm">Polished Background</h3>
          
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Background Image</label>
            <select
              value={polishedBg.assetId || ''}
              onChange={(e) => updateProjectField('polishedBackground.assetId', e.target.value || null)}
              className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              data-testid="bg-asset-select"
            >
              <option value="">No Background (Rough Layout)</option>
              {assets
                .filter((a) => a.type === 'image' || a.type === 'logo')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.filePath.split('/').pop()})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Upload New Background</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
              data-testid="bg-file-upload"
            />
            {uploadError && (
              <span className="text-xs text-red-600 font-semibold" data-testid="upload-error">
                {uploadError}
              </span>
            )}
          </div>

          {polishedBg.assetId && (
            <>
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-zinc-900">Fit Mode</label>
                <select
                  value={polishedBg.fitMode}
                  onChange={(e) => updateProjectField('polishedBackground.fitMode', e.target.value)}
                  className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  data-testid="bg-fit-mode"
                >
                  <option value="cover">Cover (Crop to Fit)</option>
                  <option value="contain">Contain (Letterbox)</option>
                  <option value="stretch">Stretch</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-900">
                  <span>Scale: {polishedBg.scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.05"
                  value={polishedBg.scale}
                  onChange={(e) => updateProjectField('polishedBackground.scale', parseFloat(e.target.value))}
                  className="w-full accent-zinc-950 cursor-pointer"
                  data-testid="bg-scale-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-900">
                  <span>Offset X: {polishedBg.offsetX}px</span>
                </div>
                <input
                  type="range"
                  min="-1000"
                  max="1000"
                  step="5"
                  value={polishedBg.offsetX}
                  onChange={(e) => updateProjectField('polishedBackground.offsetX', parseInt(e.target.value))}
                  className="w-full accent-zinc-950 cursor-pointer"
                  data-testid="bg-offset-x-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-900">
                  <span>Offset Y: {polishedBg.offsetY}px</span>
                </div>
                <input
                  type="range"
                  min="-1000"
                  max="1000"
                  step="5"
                  value={polishedBg.offsetY}
                  onChange={(e) => updateProjectField('polishedBackground.offsetY', parseInt(e.target.value))}
                  className="w-full accent-zinc-950 cursor-pointer"
                  data-testid="bg-offset-y-slider"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-900">
                  <span>Opacity: {Math.round(polishedBg.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={polishedBg.opacity}
                  onChange={(e) => updateProjectField('polishedBackground.opacity', parseFloat(e.target.value))}
                  className="w-full accent-zinc-950 cursor-pointer"
                  data-testid="bg-opacity-slider"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-zinc-900">Text Legibility Preset</label>
            <select
              value={polishedBg.legibilityPreset}
              onChange={(e) => updateProjectField('polishedBackground.legibilityPreset', e.target.value)}
              className="border border-zinc-300 bg-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-950"
              data-testid="bg-legibility-select"
            >
              <option value="none">None</option>
              <option value="drop_shadow">Drop Shadow (Text Shadow)</option>
              <option value="text_outline">Text Outline</option>
              <option value="backing_plate">Backing Plate (Solid blocks)</option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
};
