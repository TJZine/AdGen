import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import { prisma, withDbRetry } from '../db';
import { ProjectSchema } from '../schemas/project';
import { renderLayoutImages } from './renderService';
import { compilePrompt, getNegativePrompt } from './promptBuilder';

/**
 * Creates the handoff ZIP package containing prompt markdowns, JSON manifest,
 * and high-resolution PNG renders.
 *
 * @param projectId - The project UUID
 * @returns Promise<Buffer> - The ZIP file as a binary Buffer
 */
export async function createHandoffPackage(projectId: string): Promise<Buffer> {
  const archiverLib = (archiver as unknown) as {
    ZipArchive: new (options?: { zlib: { level: number } }) => archiver.Archiver;
  };
  const archive = new archiverLib.ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  const buffers: Buffer[] = [];

  stream.on('data', (chunk) => buffers.push(chunk as Buffer));
  archive.pipe(stream);

  // Define finalizePromise early to catch all events/errors
  const finalizePromise = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    stream.on('error', (err) => reject(err));
    archive.on('error', (err: Error) => reject(err));
    archive.on('warning', (err: Error) => console.warn('Archiver warning:', err));
  });

  // 1. Fetch project from SQLite
  const projectRecord = await withDbRetry(() =>
    prisma.project.findUnique({
      where: { id: projectId },
    })
  );

  if (!projectRecord) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    throw new Error(`Failed to parse contentJson for project ${projectId}`);
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    throw new Error(`Project validation failed: ${projectResult.error.message}`);
  }
  const project = projectResult.data;

  // 2. Add Prompt files
  const promptMarkdown = compilePrompt(project);
  const negativePromptText = getNegativePrompt();
  archive.append(promptMarkdown, { name: 'prompts/prompt.md' });
  archive.append(negativePromptText, { name: 'prompts/negative-prompt.txt' });

  // 3. Add Manifest JSON
  const manifest = {
    projectId: project.id,
    projectName: project.name,
    canvas: project.canvas,
    exportSettings: project.exportSettings,
    exportedAt: new Date().toISOString(),
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // 4. Add README Instructions Markdown
  const readmeContent = `# AdGen AI Handoff Package

This ZIP package contains everything you need to polish your layout using an AI image generator (like Midjourney, ChatGPT, Firefly, or Ideogram).

## Package Contents
- \`prompts/prompt.md\`: Text prompt specifying style keywords, aspect ratio, and grid structure.
- \`prompts/negative-prompt.txt\`: Strict negative prompt to suppress text rendering.
- \`renders/rough-layout.png\`: Complete visual layout reference (with text).
- \`renders/rough-layout-background-only.png\`: Text-free visual reference with placeholder grid blocks. Use this as your primary image-to-image or control input.
- \`manifest.json\`: Structured metadata.

## Instructions
1. Copy the prompt from \`prompts/prompt.md\` and paste it into your AI tool.
2. Use the negative prompt from \`prompts/negative-prompt.txt\` to suppress text generation.
3. (Recommended) Upload \`renders/rough-layout-background-only.png\` as an image-to-image style reference to preserve the exact positioning of cards.
4. Download the generated polished design (make sure there are no words/letters on it).
5. Import it back into AdGen to apply the clean vector overlay text on top.
`;
  archive.append(readmeContent, { name: 'README.md' });

  // 5. Render layout images using Playwright in a single browser session
  const { full, backgroundOnly } = await renderLayoutImages(project.id);
  archive.append(full, { name: 'renders/rough-layout.png' });
  archive.append(backgroundOnly, { name: 'renders/rough-layout-background-only.png' });
  // 6. Finalize the ZIP archive in memory
  await archive.finalize();
  return finalizePromise;
}
