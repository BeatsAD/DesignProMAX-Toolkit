import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncDevelopmentPlugin } from '../scripts/sync-development-plugin.mjs';

async function fixture() {
  const output = new URL('../output/', import.meta.url);
  await mkdir(output, { recursive: true });
  const root = await mkdtemp(fileURLToPath(new URL('registration-test-', output)));
  const folder = resolve(root, 'DesignProMAX Toolkit');
  await mkdir(folder);
  await mkdir(resolve(root, 'dist'));
  const local = { name: 'Test', id: '1692829640748273555', main: 'dist/main.js', ui: 'dist/ui.html' };
  await writeFile(resolve(root, 'manifest.local.json'), JSON.stringify(local));
  await writeFile(resolve(folder, 'manifest.json'), JSON.stringify(local));
  await writeFile(resolve(folder, 'code.js'), 'original template');
  await writeFile(resolve(folder, 'ui.html'), 'original UI');
  await writeFile(resolve(root, 'dist/main.js'), 'latest code');
  await writeFile(resolve(root, 'dist/ui.html'), '<html>最新界面</html>');
  return { root, folder };
}

test('registered entry resolves exact build bytes from its original linked location and updates on rebuild', async () => {
  const { root, folder } = await fixture();
  const legacy = resolve(root, 'original-location');
  await symlink(folder, legacy, 'dir');
  await syncDevelopmentPlugin(root);
  const manifest = JSON.parse(await readFile(resolve(legacy, 'manifest.json'), 'utf8'));
  for (const [field, source] of [['main', 'main.js'], ['ui', 'ui.html']]) {
    assert.ok(!manifest[field].includes('..'));
    assert.deepEqual(await readFile(resolve(legacy, manifest[field])), await readFile(resolve(root, 'dist', source)));
  }
  await writeFile(resolve(root, 'dist/main.js'), 'newer build');
  await syncDevelopmentPlugin(root);
  assert.equal(await readFile(resolve(legacy, manifest.main), 'utf8'), 'newer build');
  assert.equal(await readFile(resolve(root, 'output/figma-registration/generated-code.js.original'), 'utf8'), 'original template');
});

test('sync refuses to replace a different registered plugin and skips unconfigured checkouts', async () => {
  const { root, folder } = await fixture();
  await writeFile(resolve(folder, 'manifest.json'), JSON.stringify({ id: '123' }));
  await assert.rejects(syncDevelopmentPlugin(root), /ID mismatch/);
  assert.equal(await readFile(resolve(folder, 'code.js'), 'utf8'), 'original template');
  assert.equal(await syncDevelopmentPlugin(resolve(root, 'not-configured')), false);
});
