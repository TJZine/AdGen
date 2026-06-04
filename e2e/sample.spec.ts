import { test, expect } from '@playwright/test';

test.describe('AdGen Flyer Editor E2E Flow', () => {
  test('should run the complete flyer creation, import, layout, and export flow', async ({ page, request }) => {
    // 1. Creates project and opens editor
    await page.goto('/');
    await page.click('button:has-text("Create New Project")');

    // Wait for redirect to editor page
    await page.waitForURL(/\/editor\/project_[a-f0-9-]+/);
    const url = page.url();
    const projectId = url.split('/').pop()!;
    expect(projectId).toContain('project_');

    // Verify workspace is loaded
    await expect(page.locator('[data-testid="project-name-input"]')).toHaveValue('New Flyer Project');

    // 2. Imports CSV to content table and manipulates items
    // Click on the Import tab
    await page.click('[data-testid="tab-import-btn"]');

    // Fill CSV content
    const csvContent = [
      'section,title,subtitle,price,sale_price,badge,image,priority,tags',
      'Tactical Handguns,Glock 19 Gen 5,9mm Compact,530,,,SALE,,pistol',
      'Tactical Handguns,Sig P320 Compact,9mm Duty,579,,,NEW,,pistol',
      'Optics,Holosun 507C,Red Dot Sight,310,,,HOT,,optic'
    ].join('\n');

    await page.fill('[data-testid="import-textarea"]', csvContent);

    // Stub window.alert to prevent blocking dialogs
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Successfully uploaded');
      await dialog.accept();
    });

    // Submit import
    await page.click('[data-testid="import-submit-btn"]');

    // Verify elements are updated
    await page.click('[data-testid="mode-canvas-btn"]');
    await expect(page.locator('[data-testid="canvas-preview-container"]')).toBeVisible();

    // 3. Renders layout canvas and adjusts density
    await page.click('[data-testid="tab-layouts-btn"]');
    
    // Adjust density to 'dense'
    await page.click('button:has-text("dense")');

    // Save project
    await page.click('[data-testid="save-btn"]');
    await expect(page.locator('[data-testid="save-btn"]')).toBeDisabled(); // disabled after save succeeds

    // 4. Generates export package and validates PDF/PNG endpoints
    // Validate Handoff ZIP package endpoint
    const zipResponse = await request.get(`/api/export/package?id=${projectId}`);
    expect(zipResponse.ok()).toBeTruthy();
    expect(zipResponse.headers()['content-type']).toContain('application/zip');
    expect(zipResponse.headers()['content-disposition']).toContain('.zip');

    // Validate PDF render endpoint
    const pdfResponse = await request.get(`/api/export/pdf?id=${projectId}`);
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

    // Validate PNG render endpoint
    const pngResponse = await request.get(`/api/export/render?id=${projectId}&mode=full`);
    expect(pngResponse.ok()).toBeTruthy();
    expect(pngResponse.headers()['content-type']).toContain('image/png');
  });
});
