import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { createFigmaArchive } from '../scripts/package-figma.mjs';

test('release ZIP is self-contained, preserves runtime bytes and notices, and excludes local/development material', async () => {
  const { bytes, files } = await createFigmaArchive();
  const zip = unzipSync(bytes);
  const prefix = 'DesignProMAX-Toolkit/';
  for (const path of Object.keys(zip)) {
    assert.ok(path.startsWith(prefix));
    assert.doesNotMatch(path, /(?:^|\/)(?:\.env(?:\..*)?|AGENTS\.md|SPEC\.md|manifest\.local\.json|node_modules|output|dist|tests|\.git)(?:\/|$)/);
    assert.ok(!path.includes('..'));
  }
  const manifest = JSON.parse(strFromU8(zip[prefix + 'manifest.json']));
  assert.equal(manifest.id, undefined);
  assert.equal(manifest.main, 'code.js'); assert.equal(manifest.ui, 'ui.html');
  assert.deepEqual(Buffer.from(zip[prefix + manifest.main]), readFileSync(new URL('../dist/main.js', import.meta.url)));
  assert.deepEqual(Buffer.from(zip[prefix + manifest.ui]), readFileSync(new URL('../dist/ui.html', import.meta.url)));
  assert.ok(zip[prefix + 'CONFIGURE.html']); assert.ok(zip[prefix + 'INSTALL.md']);
  assert.ok(!strFromU8(zip[prefix + 'CONFIGURE.html']).includes('__MANIFEST_JSON__'));
  const receipt = JSON.parse(strFromU8(zip[prefix + 'SOURCE.json']));
  for (const [path, sha] of Object.entries(receipt.files)) assert.equal(createHash('sha256').update(zip[prefix + path]).digest('hex'), sha);
  const native = JSON.parse(strFromU8(files['licenses/ocr-native-provenance.json']));
  for (const entry of native.components) assert.equal(createHash('sha256').update(files[entry.notice]).digest('hex'), entry.sha256);
  assert.ok(native.components.length >= 9);
});
