import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const read = path => readFileSync(resolve(root, path), 'utf8');

export function startHost(overrides = {}) {
  const messages = [];
  const windows = [];
  const listeners = new Map();
  const closed = [];
  const figma = {
    currentPage: { selection: [] },
    ui: { onmessage: undefined, postMessage: message => messages.push(message) },
    on: (event, callback) => listeners.set(event, callback),
    showUI: (html, options) => windows.push({ html, options }),
    closePlugin: () => closed.push(true),
    ...overrides
  };
  Object.defineProperty(figma, 'root', { get: () => { throw new Error('Startup must not scan the document'); } });
  runInNewContext(read('dist/main.js'), { figma, __html__: read('dist/ui.html') });
  return { figma, messages, windows, listeners, closed };
}
