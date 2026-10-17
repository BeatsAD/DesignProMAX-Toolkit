import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readOptional(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Keep the Figma-registered folder self-contained, including through a directory link.
export async function syncDevelopmentPlugin(root) {
  const folder = resolve(root, 'DesignProMAX Toolkit');
  const localBytes = await readOptional(resolve(root, 'manifest.local.json'));
  const registeredBytes = await readOptional(resolve(folder, 'manifest.json'));
  if (!localBytes || !registeredBytes) return false;
  const local = JSON.parse(localBytes);
  const registered = JSON.parse(registeredBytes);
  if (!/^\d+$/.test(local.id ?? '') || registered.id !== local.id) {
    throw new Error('Development plugin ID mismatch; registered files were not changed');
  }
  const main = await readFile(resolve(root, 'dist/main.js'));
  const ui = await readFile(resolve(root, 'dist/ui.html'));
  const backupFolder = resolve(root, 'output/figma-registration');
  await mkdir(backupFolder, { recursive: true });
  for (const name of ['code.js', 'ui.html']) {
    const original = await readOptional(resolve(folder, name));
    const backup = resolve(backupFolder, `generated-${name}.original`);
    if (original && !await readOptional(backup)) await copyFile(resolve(folder, name), backup);
  }
  await writeFile(resolve(folder, 'code.js'), main);
  await writeFile(resolve(folder, 'ui.html'), ui);
  await writeFile(resolve(folder, 'manifest.json'), JSON.stringify({ ...local, main: 'code.js', ui: 'ui.html' }, null, 2) + '\n');
  return true;
}
