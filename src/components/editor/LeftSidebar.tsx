"use client";

import React from 'react';
import { useEditorStore } from '@/lib/store/editorStore';

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

  // Score color formatting
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <aside className="w-80 border-r border-zinc-200 bg-white flex flex-col h-full overflow-y-auto p-5 gap-6 text-sm text-zinc-700">
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

      {/* 2. Density Picker */}
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

      {/* 3. Brand Colors */}
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

      {/* 4. Font Preferences */}
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

      <hr className="border-zinc-200" />

      {/* 5. Score and Warnings */}
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
    </aside>
  );
};
