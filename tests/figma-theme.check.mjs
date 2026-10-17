import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './load-module.mjs';
import {startHost} from './helpers.mjs';

const {isThemePreference, resolveTheme} = await loadModule('src/shared/theme.ts');
const theme = await loadModule('src/ui/figma-theme.ts');

test('host appearance and manual preference resolve independently, including opposite themes', () => {
  for (const host of ['light', 'dark']) {
    assert.equal(resolveTheme('system', host), host);
    for (const manual of ['light', 'dark']) assert.equal(resolveTheme(manual, host), manual);
  }
  for (const invalid of [null, undefined, '', 'blue', 1, {}]) assert.equal(isThemePreference(invalid), false);
});

test('Figma classes take priority over OS appearance and live observation has a complete cleanup', () => {
  const classes = new Set(['figma-dark']), dataset = {};
  let observerCallback, observed, disconnected = false, removed = false;
  const media = {matches:false, addEventListener:(_event, callback)=>{media.callback=callback;}, removeEventListener:(_event, callback)=>{removed=callback===media.callback;}};
  globalThis.document = {documentElement:{classList:{contains:name=>classes.has(name)}, dataset}};
  globalThis.window = {matchMedia:()=>media};
  globalThis.MutationObserver = class {
    constructor(callback) { observerCallback=callback; }
    observe(element, options) { observed={element,options}; }
    disconnect() { disconnected=true; }
  };
  assert.equal(theme.readHostTheme(), 'dark');
  theme.applyTheme('system', 'dark');
  assert.deepEqual(dataset, {theme:'dark',themeSource:'host'});
  theme.applyTheme('light', 'dark');
  assert.deepEqual(dataset, {theme:'light',themeSource:'override'});
  let notifications=0;
  const cleanup=theme.subscribeHostTheme(()=>notifications++);
  assert.deepEqual(observed.options.attributeFilter, ['class']);
  classes.delete('figma-dark'); classes.add('figma-light'); media.matches=true;
  observerCallback();
  assert.equal(theme.readHostTheme(), 'light');
  theme.applyTheme('dark', 'light');
  assert.equal(dataset.themeSource, 'override');
  classes.delete('figma-light'); media.callback();
  assert.equal(theme.readHostTheme(), 'dark');
  assert.equal(notifications, 2);
  cleanup();
  assert.ok(disconnected && removed);
});

test('production settings default to host, retain old manual choices, persist across reopen and reject invalid themes', async () => {
  const values=new Map();
  const storage={getAsync:async key=>structuredClone(values.get(key)),setAsync:async(key,value)=>values.set(key,structuredClone(value))};
  function transport() {
    const host=startHost({clientStorage:storage});
    return async(command,payload={})=>{
      await host.figma.ui.onmessage({type:'RPC',requestId:'theme',command,payload});
      const reply=host.messages.at(-1);
      if(!reply.ok) throw new Error(reply.error);
      return reply.data;
    };
  }
  const first=transport(), request=(type,payload={})=>first('REFERENCE',{type,payload});
  assert.equal((await request('GET_SETTINGS')).themeMode, 'system');
  assert.equal(values.size, 0, 'following the host must not write settings on startup');
  await first('SETTINGS_SAVE',{locale:'en',theme:'dark'});
  assert.equal((await request('GET_SETTINGS')).themeMode, 'dark', 'legacy manual choice is preserved');
  await request('SAVE_SETTINGS',{themeMode:'light',compactToolLabelsVisible:false});
  const reopen=transport();
  assert.equal((await reopen('REFERENCE',{type:'GET_SETTINGS'})).themeMode, 'light');
  await reopen('REFERENCE',{type:'SAVE_SETTINGS',payload:{themeMode:'system'}});
  const saved=await transport()('REFERENCE',{type:'GET_SETTINGS'});
  assert.equal(saved.themeMode, 'system');
  assert.equal(saved.compactToolLabelsVisible, false);
  await assert.rejects(request('SAVE_SETTINGS',{themeMode:'blue'}));
  assert.equal((await request('GET_SETTINGS')).themeMode, 'system');
});
