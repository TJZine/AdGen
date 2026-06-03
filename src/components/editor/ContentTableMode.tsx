"use client";

import React from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '@/lib/store/editorStore';
import { Section, Item } from '@/lib/schemas/project';

// Drag Handle SVG Component
const DragHandleIcon = () => (
  <svg
    className="w-4 h-4 text-zinc-400 cursor-grab active:cursor-grabbing hover:text-zinc-600 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 8h16M4 16h16"
    />
  </svg>
);

const areItemsEqual = (prev: Item, next: Item): boolean => {
  return (
    prev.id === next.id &&
    prev.sectionId === next.sectionId &&
    prev.title === next.title &&
    prev.subtitle === next.subtitle &&
    prev.description === next.description &&
    prev.price === next.price &&
    prev.priceDisplay === next.priceDisplay &&
    prev.salePrice === next.salePrice &&
    prev.badge === next.badge &&
    prev.imageAssetId === next.imageAssetId &&
    prev.priority === next.priority &&
    prev.visibility === next.visibility &&
    prev.layoutHints?.cardSize === next.layoutHints?.cardSize &&
    prev.layoutHints?.imageFit === next.layoutHints?.imageFit &&
    prev.layoutHints?.preferredAspectRatio === next.layoutHints?.preferredAspectRatio
  );
};

const areItemPropsEqual = (prevProps: ItemRowProps, nextProps: ItemRowProps): boolean => {
  return areItemsEqual(prevProps.item, nextProps.item);
};

// Sortable Row for Items
interface ItemRowProps {
  item: Item;
}

const SortableItemRow = React.memo<ItemRowProps>(({ item }) => {
  const updateItem = useEditorStore((s) => s.updateItem);
  const selectElement = useEditorStore((s) => s.selectElement);
  const isSelected = useEditorStore((s) => s.selectedElementId === item.id);
  
  const [isDragOver, setIsDragOver] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      updateItem(item.id, { price: null });
    } else {
      const parsed = parseFloat(val);
      updateItem(item.id, { price: isNaN(parsed) ? null : parsed });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const assetId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('asset-id');
    if (assetId) {
      updateItem(item.id, { imageAssetId: assetId });
    }
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={() => selectElement(item.id)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-b border-zinc-100 transition hover:bg-zinc-50 cursor-pointer ${
        isSelected ? 'bg-zinc-100 hover:bg-zinc-100 font-medium' : ''
      } ${isDragOver ? 'bg-zinc-200 ring-2 ring-zinc-500 border-dashed' : ''}`}
    >
      {/* Drag Handle */}
      <td className="p-3 w-10 text-center" {...attributes} {...listeners}>
        <div className="flex justify-center items-center">
          <DragHandleIcon />
        </div>
      </td>

      {/* Title */}
      <td className="p-2 min-w-[150px]">
        <input
          type="text"
          value={item.title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateItem(item.id, { title: e.target.value })}
          placeholder="Item Title"
          className="w-full bg-transparent px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none"
        />
      </td>

      {/* Subtitle */}
      <td className="p-2 min-w-[150px]">
        <input
          type="text"
          value={item.subtitle || ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateItem(item.id, { subtitle: e.target.value })}
          placeholder="Subtitle (optional)"
          className="w-full bg-transparent px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none"
        />
      </td>

      {/* Description */}
      <td className="p-2 min-w-[200px]">
        <input
          type="text"
          value={item.description || ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateItem(item.id, { description: e.target.value })}
          placeholder="Description"
          className="w-full bg-transparent px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none"
        />
      </td>

      {/* Price */}
      <td className="p-2 w-28">
        <input
          type="text"
          value={item.price !== null ? item.price : ''}
          onClick={(e) => e.stopPropagation()}
          onChange={handlePriceChange}
          placeholder="e.g. 19.99"
          className="w-full bg-transparent px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none text-right font-mono"
        />
      </td>

      {/* Badge */}
      <td className="p-2 w-28">
        <input
          type="text"
          value={item.badge || ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateItem(item.id, { badge: e.target.value || null })}
          placeholder="e.g. SALE"
          className="w-full bg-transparent px-2 py-1 border border-transparent rounded hover:border-zinc-300 focus:border-zinc-500 focus:bg-white focus:outline-none uppercase"
        />
      </td>

      {/* Visibility */}
      <td className="p-2 w-32">
        <select
          value={item.visibility || 'visible'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateItem(item.id, { visibility: e.target.value as 'visible' | 'hidden' })}
          className="w-full bg-transparent border border-transparent hover:border-zinc-300 rounded px-1 py-1 focus:border-zinc-500 focus:bg-white focus:outline-none"
        >
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </td>
    </tr>
  );
}, areItemPropsEqual);
SortableItemRow.displayName = 'SortableItemRow';

const areSectionsEqual = (prevProps: SectionWrapperProps, nextProps: SectionWrapperProps): boolean => {
  const prev = prevProps.section;
  const next = nextProps.section;

  if (
    prev.id !== next.id ||
    prev.title !== next.title ||
    prev.subtitle !== next.subtitle ||
    prev.priority !== next.priority ||
    prev.layoutHint !== next.layoutHint ||
    prev.order !== next.order
  ) {
    return false;
  }

  if (prev.items.length !== next.items.length) return false;
  for (let i = 0; i < prev.items.length; i++) {
    if (!areItemsEqual(prev.items[i], next.items[i])) {
      return false;
    }
  }

  return true;
};

// Sortable Section Wrapper
interface SectionWrapperProps {
  section: Section;
  children: React.ReactNode;
}

const SortableSectionWrapper = React.memo<SectionWrapperProps>(({ section, children }) => {
  const updateSection = useEditorStore((s) => s.updateSection);
  const selectElement = useEditorStore((s) => s.selectElement);
  const isSelected = useEditorStore((s) => s.selectedElementId === section.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg bg-white overflow-hidden shadow-sm transition ${
        isSelected ? 'border-zinc-800 ring-1 ring-zinc-800' : 'border-zinc-200'
      }`}
    >
      {/* Section Header bar */}
      <div
        onClick={() => selectElement(section.id)}
        className="bg-zinc-50 border-b border-zinc-200 p-4 flex items-center gap-3 cursor-pointer select-none"
      >
        <div {...attributes} {...listeners}>
          <DragHandleIcon />
        </div>
        <div className="flex-1 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={section.title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateSection(section.id, { title: e.target.value })}
            placeholder="Section Title"
            className="text-base font-bold bg-transparent border border-transparent hover:border-zinc-300 focus:border-zinc-500 focus:bg-white rounded px-2 py-0.5 focus:outline-none w-64 shrink-0"
          />
          <input
            type="text"
            value={section.subtitle || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
            placeholder="Section Subtitle (optional)"
            className="text-sm text-zinc-500 bg-transparent border border-transparent hover:border-zinc-300 focus:border-zinc-500 focus:bg-white rounded px-2 py-0.5 focus:outline-none flex-1"
          />
        </div>

        {/* Priority and Layout Hint inline */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={section.priority || 'normal'}
            onChange={(e) => updateSection(section.id, { priority: e.target.value as 'high' | 'normal' | 'low' })}
            className="text-xs border border-zinc-300 bg-white rounded px-2 py-1 font-medium text-zinc-700"
          >
            <option value="high">High Priority</option>
            <option value="normal">Normal Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <select
            value={section.layoutHint || 'grid'}
            onChange={(e) => updateSection(section.id, { layoutHint: e.target.value as 'grid' | 'list' | 'featured_hero' })}
            className="text-xs border border-zinc-300 bg-white rounded px-2 py-1 font-medium text-zinc-700"
          >
            <option value="grid">Grid Layout</option>
            <option value="list">List Layout</option>
            <option value="featured_hero">Hero Layout</option>
          </select>
        </div>
      </div>

      {/* Items Table container */}
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}, areSectionsEqual);
SortableSectionWrapper.displayName = 'SortableSectionWrapper';

export const ContentTableMode: React.FC = () => {
  const sections = useEditorStore((state) => state.project.content.sections);
  const reorderSections = useEditorStore((state) => state.reorderSections);
  const reorderItems = useEditorStore((state) => state.reorderItems);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts after moving 8px to allow standard click selections on fields
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const isSectionDrag = sections.some((s) => s.id === active.id);

    if (isSectionDrag) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const updated = arrayMove(sections, oldIndex, newIndex);
        reorderSections(updated.map((s) => s.id));
      }
    } else {
      // Find containing section of dragged item and over item
      let activeSectionId = '';
      let overSectionId = '';

      for (const section of sections) {
        if (section.items.some((it) => it.id === active.id)) {
          activeSectionId = section.id;
        }
        if (section.items.some((it) => it.id === over.id)) {
          overSectionId = section.id;
        }
      }

      // Restrict reordering within the same section only
      if (activeSectionId && activeSectionId === overSectionId) {
        const section = sections.find((s) => s.id === activeSectionId)!;
        const oldIndex = section.items.findIndex((it) => it.id === active.id);
        const newIndex = section.items.findIndex((it) => it.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const updated = arrayMove(section.items, oldIndex, newIndex);
          reorderItems(activeSectionId, updated.map((it) => it.id));
        }
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 flex flex-col gap-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section) => (
            <SortableSectionWrapper key={section.id} section={section}>
              {section.items.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">
                  No items in this section.
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-sm text-zinc-800">
                  <thead className="bg-zinc-50/50 border-b border-zinc-200 text-zinc-500 font-semibold text-xs uppercase select-none">
                    <tr>
                      <th className="p-3 w-10 text-center"></th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Subtitle</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 w-28 text-right">Price</th>
                      <th className="p-3 w-28">Badge</th>
                      <th className="p-3 w-32">Visibility</th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={section.items.map((it) => it.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {section.items.map((item) => (
                        <SortableItemRow
                          key={item.id}
                          item={item}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              )}
            </SortableSectionWrapper>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
