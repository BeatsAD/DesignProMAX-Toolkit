import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const info = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
for (const input of info.inputs) {
  const path = relative(root, resolve(root, input));
  if (path.startsWith('..') || isAbsolute(path)) throw new Error(`External build input: ${input}`);
}

async function checkSource(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await checkSource(path);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      if (/\b(?:mg|pixso|jsDesign)\s*\./.test(source)) throw new Error(`Foreign host API in ${path}`);
    }
  }
}
await checkSource(resolve(root, 'src'));
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
if (JSON.stringify(manifest.editorType) !== '["figma"]' || manifest.documentAccess !== 'dynamic-page') {
  throw new Error('Manifest must target Figma with dynamic page access');
}
if (manifest.id) throw new Error('Keep account-specific plugin IDs in manifest.local.json');

const baselineIndex = process.argv.indexOf('--baseline');
if (baselineIndex !== -1) {
  const baseline = JSON.parse(await readFile(process.argv[baselineIndex + 1], 'utf8'));
  if (resolve(baseline.root) !== dirname(root)) throw new Error('Baseline belongs to a different parent project');
  for (const [path, expected] of Object.entries(baseline.files)) {
    const bytes = await readFile(resolve(baseline.root, path));
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Existing file changed: ${path}`);
  }
  const paths = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: baseline.root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of paths) {
    if (!path.startsWith('DesignProMAX-Figma/') && !(path in baseline.files)) throw new Error(`Unexpected file outside Figma: ${path}`);
  }
  console.log(`Parent isolation: ${Object.keys(baseline.files).length} existing source files unchanged`);
}
console.log(`Figma isolation: ${info.inputs.length} build inputs stay inside the independent project`);
