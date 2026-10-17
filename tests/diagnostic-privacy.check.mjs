import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSync} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {loadModule} from './load-module.mjs';
import {read} from './helpers.mjs';

const modules = await Promise.all(['src/engine/shared/diagnostics.ts', 'src/reference/shared/diagnostics.ts'].map(loadModule));
const secrets = ['FAKE_URL_SECRET', 'FAKE_KEY', 'fictional-client@example.test', 'FAKE_DOCUMENT', 'FAKE_NODE', 'FAKE_SESSION'];
const leak = secrets.join(' ');
function unsafeSnapshot() {
  const entry = {id: leak, timestamp: leak, version: leak, source: 'main', level: 'error', event: 'request:failed',
    requestId: leak, messageType: 'RUN_TEXT_FILL', errorCode: leak, message: leak, detail: leak,
    data: {apiKey: leak, imageBytes: [1, 2], text: leak, nodeName: leak, nested: {status: leak}, status: 429, htmlBytes: 123}};
  return {entries: [entry], settings: {apiKey: 'FAKE_KEY', removeBgApiKey: 'FAKE_KEY',
    customImageServiceUrl: 'https://service.example.test/FAKE_NODE?token=FAKE_URL_SECRET', customValues: leak,
    apiBaseUrl: leak, allowImageUpload: true, themeMode: 'dark'},
    recentContext: [{...entry, feature: leak, selection: {count: 3, types: {TEXT: 3, [leak]: 1}}}],
    environment: {product: leak, version: leak, exportedAt: leak, userAgent: leak, language: leak,
      platform: leak, cutoutProvider: leak, diagnosticLogCount: 1, aiServiceConfigured: true,
      detailedDiagnostics: true, viewport: {width: 380, height: 650}},
    feedbackTemplate: {problemDescription: leak, actualResult: leak, expectedResult: leak, reproductionSteps: [leak]},
    diagnosticSettings: {detailedEnabled: true, unknown: leak}, unknown: leak};
}
function assertPrivate(snapshot) {
  const json = JSON.stringify(snapshot);
  for (const secret of secrets) assert.ok(!json.includes(secret), secret);
  assert.ok(!json.includes('service.example.test'));
  assert.equal(snapshot.entries[0].messageType, 'RUN_TEXT_FILL');
  assert.equal(snapshot.entries[0].errorCode, 'UNKNOWN_ERROR');
  assert.equal(snapshot.entries[0].data.status, 429);
  assert.equal(snapshot.entries[0].data.htmlBytes, 123);
  assert.equal(snapshot.feedbackTemplate, undefined);
}
for (const [index, module] of modules.entries()) {
  test(`diagnostic export ${index}: credentials, URLs, arbitrary errors and document content never enter JSON`, () => {
    const input = unsafeSnapshot();
    const snapshot = module.exportDiagnostics(input);
    assertPrivate(snapshot);
    assert.deepEqual(snapshot.settings, {allowImageUpload: true, themeMode: 'dark'});
    assert.deepEqual(snapshot.recentContext[0].selection, {count: 3, types: {TEXT: 3}});
    assert.equal(input.entries[0].message, leak, 'export does not mutate caller data');
    assertPrivate(module.exportDiagnostics(snapshot));
  });
  test(`diagnostic store ${index}: detailed/error/context records are safe before export and clear together`, () => {
    const store = module.createDiagnosticStore({maxEntries: 2, maxContext: 2});
    const entry = unsafeSnapshot().entries[0];
    store.record({...entry, level: 'info'});
    assert.equal(store.getEntries().length, 0);
    store.record(entry);
    store.recordContext({...entry, feature: leak});
    store.setDetailedEnabled(true);
    store.record({...entry, level: 'info', errorCode: 'STALE'});
    assertPrivate(module.exportDiagnostics({entries: store.getEntries()}));
    assert.ok(!JSON.stringify(store.getEntries()).includes('FAKE_'));
    assert.ok(!JSON.stringify(store.getRecentContext()).includes('FAKE_'));
    assert.equal(store.getEntries()[1].errorCode, 'STALE');
    store.getEntries()[0].message = leak;
    assert.equal(store.getEntries()[0].message, undefined, 'callers cannot mutate retained records');
    store.clear();
    assert.equal(store.getEntries().length, 0);
    assert.equal(store.getRecentContext().length, 0);
  });
  test(`diagnostic export ${index}: unknown metadata, strings in numeric fields and malformed values fail closed`, () => {
    const snapshot = unsafeSnapshot();
    Object.assign(snapshot.entries[0], {event: leak, messageType: leak, source: leak, level: leak,
      durationMs: Infinity, data: {status: leak, htmlBytes: -1, count: NaN}});
    const result = module.exportDiagnostics(snapshot);
    for (const secret of secrets) assert.ok(!JSON.stringify(result).includes(secret));
    assert.deepEqual(result.entries[0].data, {});
    assert.equal(result.entries[0].event, 'other');
    assert.equal(result.entries[0].messageType, 'OTHER');
    assert.equal(result.entries[0].durationMs, undefined);
  });
}

test('actual download serializer reapplies privacy boundary after UI/main merge without uploading', async () => {
  const source = read('src/reference/features/settings/ui/SettingsPage.tsx');
  const code = source.slice(source.indexOf('function downloadDiagnosticSnapshot('));
  const compiled = buildSync({stdin: {contents: code, loader: 'ts'}, write: false}).outputFiles[0].text;
  let blob, clicked = false, revoked = false;
  const link = {click() {clicked = true;}, remove() {}};
  const context = {Blob, Date, JSON, exportDiagnostics: modules[0].exportDiagnostics,
    document: {createElement() {return link;}, body: {appendChild() {}}},
    URL: {createObjectURL(value) {blob = value; return 'blob:local-test';}, revokeObjectURL() {revoked = true;}}};
  runInNewContext(compiled + '\nglobalThis.download = downloadDiagnosticSnapshot;', context);
  context.download(unsafeSnapshot());
  assertPrivate(JSON.parse(await blob.text()));
  assert.ok(clicked && revoked);
  assert.match(link.download, /^designpromax-diagnostic-.*\.json$/);
});

test('production controller export excludes saved credentials and URL tokens without changing saved settings', async () => {
  const {Controller} = await loadModule('src/engine/controller.ts');
  const memory = new Map();
  const controller = new Controller({document: {currentPage: {selection: []}}, clientStorage: {
    getAsync: async key => memory.get(key), setAsync: async (key, value) => memory.set(key, value)
  }});
  const request = (type, payload = {}) => controller.request('REFERENCE', {type, payload});
  const url = 'https://service.example.test/FAKE_NODE?token=FAKE_URL_SECRET';
  await request('SAVE_SETTINGS', {apiKey: 'FAKE_KEY', removeBgApiKey: 'FAKE_KEY', customImageServiceUrl: url});
  await assert.rejects(request('FAKE_DOCUMENT'), /INVALID/);
  const exported = await request('EXPORT_DIAGNOSTIC_LOGS');
  for (const secret of secrets) assert.ok(!JSON.stringify(exported).includes(secret));
  assert.ok(exported.entries.some(entry => entry.messageType === 'OTHER' && entry.errorCode === 'INVALID'));
  const settings = await request('GET_SETTINGS');
  assert.equal(settings.apiKey, 'FAKE_KEY');
  assert.equal(settings.removeBgApiKey, 'FAKE_KEY');
  assert.equal(settings.customImageServiceUrl, url);
});
