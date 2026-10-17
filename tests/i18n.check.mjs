import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from './load-module.mjs';
import {read} from './helpers.mjs';
const {CATALOG,LANGUAGES,TOOL_NAMES,DESCRIPTIONS,translate}=await loadModule('src/ui/i18n/catalog.ts');
test('every translated phrase covers all eight UI languages and all tools',()=>{
 assert.equal(LANGUAGES.length,8);assert.ok(Object.keys(CATALOG).length>150);
 for(const [key,values] of Object.entries(CATALOG)){assert.equal(values.length,8,key);assert.ok(values.every(v=>v.trim().length),key);}
 const sources=['src/ui/App.tsx','src/ui/ToolForm.tsx'].map(read).join('\n');
 const keys=[...sources.matchAll(/\bt\('([^']+)'\)/g)].map(m=>m[1]);
 for(const key of [...keys,...Object.values(TOOL_NAMES),...Object.values(DESCRIPTIONS)])assert.ok(CATALOG[key],`Missing translation: ${key}`);
 for(const [locale]of LANGUAGES)for(const name of Object.values(TOOL_NAMES))assert.equal(translate(locale,name),CATALOG[name][LANGUAGES.findIndex(l=>l[0]===locale)]);
});
