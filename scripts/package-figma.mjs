import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function createFigmaArchive(root = project) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const info = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
  if (pkg.version !== info.version || info.startupHtmlBytes >= 1572864) throw new Error('Build version/budget mismatch; run npm run verify');
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  if (manifest.id) throw new Error('Shared manifest must not contain an account-specific ID');
  const releaseManifest = { ...manifest, main: 'code.js', ui: 'ui.html' };
  const files = {};
  const mappings = [
    ['code.js', 'dist/main.js'], ['ui.html', 'dist/ui.html'],
    ['LICENSE', 'LICENSE'], ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
    ['INSTALL.md', 'docs/PREBUILT.md'], ['PRIVACY.md', 'docs/PRIVACY.md'],
    ['src/assets/ocr/provenance.json', 'src/assets/ocr/provenance.json'],
    ['src/assets/home-banner.provenance.json', 'src/assets/home-banner.provenance.json'],
    ...git(['ls-files', '--', 'licenses/']).split('\n').filter(Boolean).map(path => [path, path])
  ];
  for (const [destination, source] of mappings) {
    if (!(await lstat(resolve(root, source))).isFile()) throw new Error(`Expected a regular file: ${source}`);
    files[destination] = new Uint8Array(await readFile(resolve(root, source)));
  }
  if (files['code.js'].length !== info.mainBytes || files['ui.html'].length !== info.fullOfflineHtmlBytes) throw new Error('Build bytes do not match build-info');
  files['manifest.json'] = strToU8(JSON.stringify(releaseManifest, null, 2) + '\n');
  files['CONFIGURE.html'] = strToU8((await readFile(resolve(root, 'scripts/release-configure.html'), 'utf8')).replace('__MANIFEST_JSON__', JSON.stringify(releaseManifest).replace(/</g, '\\u003c')));
  files['SOURCE.json'] = strToU8(JSON.stringify({ version: pkg.version, commit: git(['rev-parse', 'HEAD']), source: pkg.repository.url, trackedChanges: Boolean(git(['status', '--porcelain', '--untracked-files=no'])), startupHtmlBytes: info.startupHtmlBytes, files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, digest(bytes)])) }, null, 2) + '\n');
  const entries = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => [`DesignProMAX-Toolkit/${path}`, [bytes, { mtime: new Date('2020-01-01T00:00:00Z') }]]));
  return { version: pkg.version, files, bytes: zipSync(entries, { level: 9 }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: project, encoding: 'utf8' }).trim()) throw new Error('Commit tracked changes before packaging');
  const { version, bytes } = await createFigmaArchive();
  const folder = resolve(project, 'output/releases', version);
  await mkdir(folder, { recursive: true });
  const name = `DesignProMAX-Toolkit-v${version}-figma.zip`;
  await writeFile(resolve(folder, name), bytes);
  await writeFile(resolve(folder, 'SHA256SUMS'), `${digest(bytes)}  ${name}\n`);
  console.log(`${resolve(folder, name)} (${bytes.length} bytes)`);
}
