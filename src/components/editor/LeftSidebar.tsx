"use client";

import React from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { autoSuggestLayout } from '@/lib/layout/solver';
import { parseSpreadsheet, sanitizeSpreadsheetFormula } from '@/lib/utils/csv';
import { Section, Item, Asset } from '@/lib/schemas/project';

export const CANVAS_PRESETS = [
  {
    id: 'letter',
    name: 'Letter (8.5" x 11")',
    widthPx: 2550,
    heightPx: 3300,
    dpi: 300,
    safeMarginPx: 120,
    unit: 'in' as const,
  },
  {
    id: 'poster',
    name: 'Poster (12" x 18")',
    widthPx: 3600,
    heightPx: 5400,
    dpi: 300,
    safeMarginPx: 180,
    unit: 'in' as const,
  },
  {
    id: 'instagram',
    name: 'Instagram Square (1080 x 1080)',
    widthPx: 1080,
    heightPx: 1080,
    dpi: 72,
    safeMarginPx: 50,
    unit: 'px' as const,
  },
  {
    id: 'a4',
    name: 'A4 Flyer (210 x 297 mm)',
    widthPx: 2480,
    heightPx: 3508,
    dpi: 300,
    safeMarginPx: 120,
    unit: 'mm' as const,
  },
];

export const LeftSidebar: React.FC = () => {
  const { project, assets, updateProjectField } = useEditorStore();
  const { canvas, brand, layout } = project;
  const [activeTab, setActiveTab] = React.useState<'settings' | 'layouts' | 'import'>('settings');
  const [importText, setImportText] = React.useState('');
  const [isDragOverFileZone, setIsDragOverFileZone] = React.useState(false);
  const [isUploadingImages, setIsUploadingImages] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePresetChange = (presetId: string) => {
    const preset = CANVAS_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      updateProjectField('canvas', {
        id: preset.id,
        name: preset.name,
        widthPx: preset.widthPx,
        heightPx: preset.heightPx,
        dpi: preset.dpi,
        safeMarginPx: preset.safeMarginPx,
        unit: preset.unit,
      });
    }
  };

  const handleColorChange = (key: 'background' | 'primary' | 'secondary' | 'muted', value: string) => {
    updateProjectField(`brand.colors.${key}`, value);
  };

  const handleFontChange = (key: 'heading' | 'body' | 'price', value: string) => {
    updateProjectField(`brand.fontPreferences.${key}`, value);
  };

  const handleDensityChange = (density: 'loose' | 'normal' | 'dense') => {
    updateProjectField('layout.density', density);
  };

  const handleFamilyChange = (family: string) => {
    updateProjectField('layout.layoutFamily', family);
  };

  const handleApplySuggested = () => {
    const suggested = autoSuggestLayout(project);
    updateProjectField('layout.layoutFamily', suggested);
  };

  const handleAddQRCode = () => {
    const existingElements = project.layout.elements || [];
    const newElement = {
      id: `qr-code-${Date.now()}`,
      type: 'qr_code' as const,
      contentRef: 'brand.website',
      x: canvas.safeMarginPx,
      y: canvas.safeMarginPx,
      width: 120,
      height: 120,
      locked: true,
      style: {},
    };
    updateProjectField('layout.elements', [...existingElements, newElement]);
  };

  const handleAddAIZone = () => {
    const existingElements = project.layout.elements || [];
    const newElement = {
      id: `ai-zone-${Date.now()}`,
      type: 'ai_instruction_zone' as const,
      contentRef: 'keep this area clean for product shadows',
      x: canvas.safeMarginPx,
      y: canvas.safeMarginPx,
      width: 200,
      height: 100,
      locked: true,
      style: {},
    };
    updateProjectField('layout.elements', [...existingElements, newElement]);
  };

  const handleImport = () => {
    const { sections } = parseSpreadsheet(importText);
    if (sections && sections.length > 0) {
      updateProjectField('content.sections', sections);
      setImportText('');
    } else {
      alert('Failed to parse any sections. Please ensure your data is in CSV or TSV format and contains a "title" column.');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    setImportText(pastedText);
    
    const { sections } = parseSpreadsheet(pastedText);
    if (sections && sections.length > 0) {
      updateProjectField('content.sections', sections);
    } else {
      alert('Failed to parse pasted data. Please check the CSV/TSV format.');
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverFileZone(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processUploadedFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processUploadedFile(files[0]);
    }
  };

  const processUploadedFile = (file: File): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const fileName = file.name.toLowerCase();
      
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) {
          alert("Could not read file content.");
          resolve();
          return;
        }

        try {
          if (fileName.endsWith('.json')) {
            const parsed = JSON.parse(text);
            const sanitizedSections = validateAndSanitizeSections(parsed);
            updateProjectField('content.sections', sanitizedSections);
            alert(`Successfully imported ${sanitizedSections.length} sections from JSON.`);
          } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
            const { sections } = parseSpreadsheet(text);
            if (sections && sections.length > 0) {
              updateProjectField('content.sections', sections);
              alert(`Successfully imported ${sections.length} sections from CSV/TSV.`);
            } else {
              alert("Failed to parse CSV/TSV. Ensure it has a header row and 'title' column.");
            }
          } else {
            alert("Unsupported file format. Please upload .json, .csv, or .tsv files.");
          }
        } catch (err: unknown) {
          alert(`Error importing file: ${err instanceof Error ? err.message : String(err)}`);
        }
        resolve();
      };

      reader.onerror = () => {
        alert("Failed to read file.");
        resolve();
      };

      reader.readAsText(file);
    });
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }

    try {
      const res = await fetch('/api/upload?bulk=true', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Bulk upload failed');
      }

      interface UploadedAsset {
        id: string;
        name: string;
        type: string;
        filePath: string;
        thumbnailPath?: string | null;
        mimeType?: string;
        mime?: string;
        sizeBytes?: number;
        size?: number;
        width?: number | null;
        height?: number | null;
        focalPointX?: number | null;
        focalPointY?: number | null;
        createdAt: string | number | Date;
        updatedAt: string | number | Date;
      }

      const uploadedAssets = await res.json();
      
      const formattedAssets: Asset[] = (Array.isArray(uploadedAssets) ? uploadedAssets : [uploadedAssets]).map((a: UploadedAsset) => ({
        id: a.id,
        name: a.name,
        type: (['image', 'logo', 'font'].includes(a.type) ? a.type : 'image') as Asset['type'],
        filePath: a.filePath,
        thumbnailPath: a.thumbnailPath || null,
        mimeType: a.mimeType || a.mime || 'image/png',
        sizeBytes: a.sizeBytes || a.size || 0,
        dimensions: a.width && a.height ? { width: a.width, height: a.height } : null,
        focalPoint: {
          x: typeof a.focalPointX === 'number' ? a.focalPointX : 0.5,
          y: typeof a.focalPointY === 'number' ? a.focalPointY : 0.5,
        },
        createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
        updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : new Date(a.updatedAt).toISOString(),
      }));

      useEditorStore.setState((state) => ({
        assets: [...state.assets, ...formattedAssets],
      }));

      alert(`Successfully uploaded ${formattedAssets.length} image(s).`);
    } catch (err: unknown) {
      console.error('Failed to upload images:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const recommendedLayout = autoSuggestLayout(project);

  // Score color formatting
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 text-sm text-zinc-700">
      {/* Navigation tabs */}
      <div className="flex border-b border-zinc-200 -mx-5 -mt-5 mb-5 bg-zinc-50">
        {(['settings', 'layouts', 'import'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            data-testid={`tab-${tab}-btn`}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition ${
              activeTab === tab
                ? 'border-zinc-950 text-zinc-950 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-6">
          {/* 1. Preset Selector */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Canvas Preset</label>
            <select
              data-testid="preset-select"
              value={canvas.id || 'letter'}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              {CANVAS_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-zinc-500 mt-1 flex flex-col gap-0.5">
              <span>Dimensions: {canvas.widthPx} x {canvas.heightPx} px</span>
              <span>DPI: {canvas.dpi} | Margin: {canvas.safeMarginPx} px ({canvas.unit})</span>
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* 2. Brand Colors */}
          <div className="flex flex-col gap-3">
            <label className="font-semibold text-zinc-950">Brand Colors</label>
            {(['background', 'primary', 'secondary', 'muted'] as const).map((colorKey) => (
              <div key={colorKey} className="flex items-center gap-3">
                <span className="w-24 capitalize text-xs text-zinc-500">{colorKey}</span>
                <div className="flex flex-1 items-center gap-2 border border-zinc-300 rounded px-2 py-1 bg-zinc-50">
                  <input
                    type="color"
                    value={brand.colors[colorKey] || '#ffffff'}
                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                    className="w-6 h-6 border-none p-0 cursor-pointer rounded bg-transparent"
                  />
                  <input
                    type="text"
                    value={brand.colors[colorKey] || ''}
                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                    placeholder="#HEX"
                    className="flex-1 min-w-0 bg-transparent focus:outline-none uppercase font-mono text-xs text-zinc-800"
                  />
                </div>
              </div>
            ))}
          </div>

          <hr className="border-zinc-200" />

          {/* 3. Font Preferences */}
          <div className="flex flex-col gap-3">
            <label className="font-semibold text-zinc-950">Font Preferences</label>
            {(['heading', 'body', 'price'] as const).map((fontKey) => (
              <div key={fontKey} className="flex flex-col gap-1">
                <span className="capitalize text-xs text-zinc-500">{fontKey} Font</span>
                <input
                  type="text"
                  value={brand.fontPreferences[fontKey] || ''}
                  onChange={(e) => handleFontChange(fontKey, e.target.value)}
                  placeholder="e.g. Inter, Arial"
                  className="border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layouts Tab */}
      {activeTab === 'layouts' && (
        <div className="flex flex-col gap-6">
          {/* Layout Family Selector */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Layout Family</label>
            <select
              data-testid="layout-family-select"
              value={layout.layoutFamily || 'inventory_board'}
              onChange={(e) => handleFamilyChange(e.target.value)}
              className="w-full border border-zinc-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
            >
              <option value="inventory_board">Inventory Board</option>
              <option value="hero_grid">Hero Grid Flyer</option>
              <option value="menu_listing">Menu Listing Board</option>
              <option value="comparison_chart">Comparison Chart</option>
              <option value="social_carousel">Social Carousel</option>
            </select>
          </div>

          {/* Auto Recommendation Box */}
          <div className="bg-zinc-50 border border-zinc-200 rounded p-4 flex flex-col gap-2.5">
            <span className="font-semibold text-xs text-zinc-500 uppercase tracking-wider">
              AI Layout Recommendation
            </span>
            <div className="text-sm text-zinc-900">
              Recommended Layout: <span className="font-bold capitalize">{recommendedLayout.replace('_', ' ')}</span>
            </div>
            <button
              type="button"
              data-testid="apply-suggestion-btn"
              onClick={handleApplySuggested}
              className="w-full bg-zinc-950 hover:bg-zinc-800 text-white rounded py-2 text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
            >
              Apply Suggestion
            </button>
          </div>

          <hr className="border-zinc-200" />

          {/* Layout Density Picker */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Layout Density</label>
            <div className="grid grid-cols-3 gap-2">
              {(['loose', 'normal', 'dense'] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => handleDensityChange(density)}
                  className={`border py-2 px-3 rounded font-medium capitalize transition ${
                    layout.density === density
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-zinc-200" />

          <hr className="border-zinc-200" />

          {/* Manual Canvas Elements */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Add Elements</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="add-qr-code-btn"
                onClick={handleAddQRCode}
                className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded py-2 text-xs font-semibold uppercase tracking-wider transition cursor-pointer text-center"
              >
                Add QR Code
              </button>
              <button
                type="button"
                data-testid="add-ai-zone-btn"
                onClick={handleAddAIZone}
                className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded py-2 text-xs font-semibold uppercase tracking-wider transition cursor-pointer text-center"
              >
                Add AI Zone
              </button>
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* Score and Warnings */}
          <div className="flex flex-col gap-3">
            <label className="font-semibold text-zinc-950">Layout Evaluation</label>
            <div className={`border rounded-lg p-4 flex flex-col items-center gap-2 text-center ${getScoreColorClass(layout.score)}`}>
              <span className="text-3xl font-extrabold">{layout.score}</span>
              <span className="text-xs font-semibold uppercase tracking-wider">Layout Score</span>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <span className="font-semibold text-xs text-zinc-500 uppercase tracking-wider">
                Warnings Checklist ({layout.warnings.length})
              </span>
              {layout.warnings.length === 0 ? (
                <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Layout meets all constraints!</span>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {layout.warnings.map((warning, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded p-2.5 flex gap-2"
                    >
                      <svg className="w-4 h-4 fill-current text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="flex flex-col gap-6">
          {/* 1. Drag & Drop File Import Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-zinc-950">File Import (CSV or JSON)</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverFileZone(true);
              }}
              onDragLeave={() => setIsDragOverFileZone(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                isDragOverFileZone
                  ? 'border-zinc-950 bg-zinc-100/50'
                  : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100/50 hover:border-zinc-400'
              }`}
              data-testid="file-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <svg className="w-8 h-8 text-zinc-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-medium text-zinc-700 block">
                Drag & drop a JSON or CSV/TSV file here
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">
                or click to browse from your device
              </span>
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* 2. Clipboard Paste Parser */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-zinc-950">Clipboard Paste Parser</label>
              <span className="text-xs text-zinc-500">
                Paste spreadsheet rows (CSV/TSV format) copied from Google Sheets or Excel directly into the text area below.
              </span>
            </div>

            <textarea
              data-testid="import-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              onPaste={handlePaste}
              placeholder={`Section, Title, Price, Description\nAppetizers, Garlic Bread, 5.99, Toasted with garlic and butter\nAppetizers, Cheese Sticks, 7.99, Mozzarella cheese sticks`}
              className="w-full h-32 border border-zinc-300 rounded p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none bg-white"
            />

            <button
              type="button"
              data-testid="import-submit-btn"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white rounded py-2 text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
            >
              Parse & Import Data
            </button>
          </div>

          <hr className="border-zinc-200" />

          {/* 3. Bulk Image Uploader */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Bulk Image Uploader</label>
            <span className="text-xs text-zinc-500">
              Upload multiple images concurrently to populate the gallery.
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={isUploadingImages}
              onChange={handleBulkImageUpload}
              className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 disabled:opacity-50 cursor-pointer"
              data-testid="bulk-file-upload"
            />
            {isUploadingImages && (
              <span className="text-xs text-zinc-500 italic">Uploading images, please wait...</span>
            )}
          </div>

          <hr className="border-zinc-200" />

          {/* 4. Visual Asset Gallery */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-zinc-950">Visual Asset Gallery</label>
            <span className="text-xs text-zinc-500">
              Drag an image asset from here and drop it onto any item row in the content table.
            </span>
            {assets.length === 0 ? (
              <div className="border border-zinc-200 rounded p-4 text-center text-zinc-400 text-xs bg-zinc-50">
                No assets uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 border border-zinc-200 rounded p-3 bg-zinc-50 max-h-60 overflow-y-auto">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', asset.id);
                      e.dataTransfer.setData('asset-id', asset.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="relative group aspect-square border border-zinc-300 rounded overflow-hidden bg-white cursor-grab active:cursor-grabbing hover:border-zinc-500 transition flex items-center justify-center"
                    title={asset.name}
                    data-testid={`gallery-asset-${asset.id}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.filePath}
                      alt={asset.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center p-1 text-[10px] text-white text-center break-all select-none">
                      {asset.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

interface RawLayoutHints {
  cardSize?: string;
  imageFit?: string;
  preferredAspectRatio?: string;
}

interface RawItem {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  price?: number | null;
  priceDisplay?: string;
  salePrice?: number | null;
  badge?: string | null;
  imageAssetId?: string | null;
  priority?: string;
  visibility?: string;
  layoutHints?: RawLayoutHints | null;
  metadata?: { tags?: string[] } | null;
}

interface RawSection {
  id?: string;
  title: string;
  subtitle?: string;
  priority?: string;
  layoutHint?: string;
  order?: number;
  items?: RawItem[];
}

const sanitizeMetadata = (meta: any) => {
  if (!meta || typeof meta !== 'object') {
    return { tags: [] };
  }
  const cleanMeta: Record<string, any> = { tags: [] };
  for (const key of Object.keys(meta)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (key === 'tags' && Array.isArray(meta.tags)) {
      cleanMeta.tags = meta.tags
        .filter((t: any) => typeof t === 'string' || typeof t === 'number')
        .map((t: any) => sanitizeSpreadsheetFormula(String(t)));
    } else {
      const val = meta[key];
      if (typeof val === 'string') {
        cleanMeta[key] = sanitizeSpreadsheetFormula(val);
      } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
        cleanMeta[key] = val;
      }
    }
  }
  return cleanMeta;
};

const validateAndSanitizeSections = (parsedData: unknown): Section[] => {
  let rawSections: RawSection[] = [];
  if (Array.isArray(parsedData)) {
    rawSections = parsedData as RawSection[];
  } else if (parsedData && typeof parsedData === 'object') {
    const dataObj = parsedData as Record<string, unknown>;
    if (Array.isArray(dataObj.sections)) {
      rawSections = dataObj.sections as RawSection[];
    } else if (
      dataObj.content &&
      typeof dataObj.content === 'object' &&
      Array.isArray((dataObj.content as Record<string, unknown>).sections)
    ) {
      rawSections = (dataObj.content as Record<string, unknown>).sections as RawSection[];
    } else {
      throw new Error("Invalid JSON structure. Must be an array of sections or an object containing a 'sections' array.");
    }
  } else {
    throw new Error("Invalid JSON structure. Must be an array of sections or an object containing a 'sections' array.");
  }

  const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  return rawSections.map((sec: RawSection, secIdx: number) => {
    if (!sec || typeof sec !== 'object' || !sec.title) {
      throw new Error("Each section must be an object with a 'title' field.");
    }
    const sectionId = sec.id || generateId();
    const items = Array.isArray(sec.items) ? sec.items : [];

    const sanitizedItems: Item[] = items.map((item: RawItem) => {
      if (!item || typeof item !== 'object' || !item.title) {
        throw new Error("Each item must be an object with a 'title' field.");
      }
      return {
        id: item.id || generateId(),
        sectionId: sectionId,
        title: sanitizeSpreadsheetFormula(String(item.title)),
        subtitle: sanitizeSpreadsheetFormula(String(item.subtitle || '')),
        description: sanitizeSpreadsheetFormula(String(item.description || '')),
        price: typeof item.price === 'number' ? item.price : null,
        priceDisplay: item.priceDisplay !== undefined ? sanitizeSpreadsheetFormula(String(item.priceDisplay)) : '',
        salePrice: typeof item.salePrice === 'number' ? item.salePrice : null,
        badge: item.badge ? sanitizeSpreadsheetFormula(String(item.badge)) : null,
        imageAssetId: item.imageAssetId ? String(item.imageAssetId) : null,
        priority: (item.priority && ['hero', 'featured', 'normal', 'compact'].includes(item.priority) ? item.priority : 'normal') as Item['priority'],
        visibility: (item.visibility && ['visible', 'hidden'].includes(item.visibility) ? item.visibility : 'visible') as Item['visibility'],
        layoutHints: {
          cardSize: item.layoutHints?.cardSize && ['normal', 'compact', 'wide'].includes(item.layoutHints.cardSize) ? (item.layoutHints.cardSize as Item['layoutHints']['cardSize']) : 'normal',
          imageFit: item.layoutHints?.imageFit && ['contain', 'cover', 'crop', 'transparent', 'full_bleed'].includes(item.layoutHints.imageFit) ? (item.layoutHints.imageFit as Item['layoutHints']['imageFit']) : 'contain',
          preferredAspectRatio: item.layoutHints?.preferredAspectRatio ? String(item.layoutHints.preferredAspectRatio) : '4:3',
        },
        metadata: sanitizeMetadata(item.metadata)
      };
    });

    return {
      id: sectionId,
      title: sanitizeSpreadsheetFormula(String(sec.title)),
      subtitle: sanitizeSpreadsheetFormula(String(sec.subtitle || '')),
      priority: (sec.priority && ['high', 'normal', 'low'].includes(sec.priority) ? sec.priority : 'normal') as Section['priority'],
      layoutHint: (sec.layoutHint && ['grid', 'list', 'featured_hero'].includes(sec.layoutHint) ? sec.layoutHint : 'grid') as Section['layoutHint'],
      order: typeof sec.order === 'number' ? sec.order : secIdx,
      items: sanitizedItems
    };
  });
};
