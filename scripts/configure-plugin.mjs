import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginId = process.argv[2];
if (!pluginId || !/^\d+$/.test(pluginId)) {
  console.error('Usage: npm run configure:plugin -- <real Figma plugin ID>');
  process.exitCode = 1;
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  await writeFile(resolve(root, 'manifest.local.json'), JSON.stringify({ ...manifest, id: pluginId }, null, 2) + '\n');
  console.log('Saved manifest.local.json. Import this manifest in Figma after npm run build.');
}
