"use client";

import React from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { autoSuggestLayout } from '@/lib/layout/solver';
import { parseSpreadsheet } from '@/lib/utils/csv';

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
  const { project, updateProjectField } = useEditorStore();
  const { canvas, brand, layout } = project;
  const [activeTab, setActiveTab] = React.useState<'settings' | 'layouts' | 'import'>('settings');
  const [importText, setImportText] = React.useState('');

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-zinc-950">CSV / TSV Import</label>
            <span className="text-xs text-zinc-500">
              Paste your spreadsheet rows below. The first row should contain headers (e.g., Section, Title, Price, Description).
            </span>
          </div>

          <textarea
            data-testid="import-textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`Section, Title, Price, Description\nAppetizers, Garlic Bread, 5.99, Toasted with garlic and butter\nAppetizers, Cheese Sticks, 7.99, Mozzarella cheese sticks`}
            className="w-full h-64 border border-zinc-300 rounded p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 resize-none bg-white"
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
      )}
    </aside>
  );
};
