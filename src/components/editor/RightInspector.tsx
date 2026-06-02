"use client";

import React, { useRef } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { calculateNormalizedCoords } from '@/lib/utils/crop';
import { Section, Item } from '@/lib/schemas/project';

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

  // 1. Identify selected element type and find its reference
  let selectedType: 'item' | 'section' | 'general' = 'general';
  let selectedItem: Item | null = null;
  let selectedSection: Section | null = null;

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
      </div>
    </aside>
  );
};
