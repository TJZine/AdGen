import { Project, LayoutElement } from '@/lib/schemas/project';

/**
 * Pure utility function to get the text value of a LayoutElement from project data.
 */
export function getElementText(el: LayoutElement, project: Project): string {
  const { content, brand } = project;
  if (el.contentRef === 'content.headline') {
    return content.headline;
  }
  if (el.contentRef === 'content.subheadline') {
    return content.subheadline;
  }
  if (el.contentRef === 'brand.defaultFooter') {
    return `${brand.defaultFooter} ${brand.defaultDisclaimer}`.trim();
  }
  if (el.type === 'section_header') {
    const section = content.sections.find((s) => s.id === el.contentRef);
    return section ? section.title : '';
  }
  if (el.contentRef.includes('.')) {
    const [itemId, field] = el.contentRef.split('.');
    for (const section of content.sections) {
      const item = section.items.find((it) => it.id === itemId);
      if (item) {
        if (field === 'title') return item.title;
        if (field === 'subtitle') return item.subtitle;
        if (field === 'description') return item.description;
        if (field === 'price') return item.priceDisplay || (item.price !== null ? `$${item.price}` : '');
        if (field === 'badge') return item.badge || '';
      }
    }
  }
  return '';
}
