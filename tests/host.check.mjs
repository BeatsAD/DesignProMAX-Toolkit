import assert from 'node:assert/strict';
import test from 'node:test';
import { read, startHost } from './helpers.mjs';

test('ready handshake reports version and current selection without document traversal', () => {
  const host = startHost();
  assert.equal(host.messages.length, 0);
  host.figma.currentPage.selection = [{ id: '1:1' }, { id: '1:2' }];
  host.figma.ui.onmessage({ type: 'UI_READY' });
  assert.equal(host.messages[0].version, JSON.parse(read('package.json')).version);
  assert.equal(host.messages[0].selectionCount, 2);
});

test('selection and page changes update ready UI without recreating it', () => {
  const host = startHost();
  host.listeners.get('selectionchange')();
  assert.equal(host.messages.length, 0);
  host.figma.ui.onmessage({ type: 'UI_READY' });
  host.figma.currentPage.selection = [{ id: '2:1' }];
  host.listeners.get('currentpagechange')();
  host.figma.currentPage.selection = [];
  host.listeners.get('selectionchange')();
  assert.equal(host.messages.at(-2).type, 'WORKSPACE_CHANGED');
  assert.equal(host.messages.at(-1).type, 'WORKSPACE_CHANGED');
  assert.equal(host.windows.length, 1);
});

test('invalid messages do not execute actions; explicit close closes the plugin', () => {
  const host = startHost();
  for (const invalid of [null, 'CLOSE_PLUGIN', {}, { type: 'DELETE_NODES' }]) host.figma.ui.onmessage(invalid);
  assert.equal(host.closed.length, 0);
  assert.equal(host.messages.length, 0);
  host.figma.ui.onmessage({ type: 'CLOSE_PLUGIN' });
  assert.equal(host.closed.length, 1);
});
