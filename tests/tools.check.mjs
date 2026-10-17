import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from './load-module.mjs';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const client=await loadModule('src/preview/client.ts');const {parameters,defaults}=await loadModule('src/ui/ToolForm.tsx');defaults.textFill.customValues='Open\nDone';
const req=client.rpc;const state=()=>req('STATE');const preview=(tool,p)=>req('PREVIEW',{tool,params:p});
const apply=p=>req('APPLY',{token:p.token,ids:p.rows.filter(r=>r.runnable).map(r=>r.id),confirmed:true});

test('text fill previews without writes, applies selected rows once, and browser undo restores',async()=>{
 await client.loadScenario('text');const original=await state();const plan=await preview('textFill',parameters('textFill',defaults.textFill,original.selection));assert.equal(plan.rows.length,3);assert.deepEqual(await state(),original);
 await assert.rejects(req('APPLY',{token:plan.token,ids:[plan.rows[0].id]}),/STALE/);
 const result=await req('APPLY',{token:plan.token,ids:[plan.rows[0].id],confirmed:true});assert.equal(result.success,1);assert.equal(result.state.layers.find(n=>n.id==='text:1').text,plan.rows[0].after);assert.equal(result.state.layers.find(n=>n.id==='text:2').text,'李四');await assert.rejects(apply(plan),/STALE/);assert.deepEqual(await req('UNDO'),original);
});
test('selection changes invalidate a pending operation; cancellation does not write',async()=>{
 await client.loadScenario('text');const plan=await preview('textFill',parameters('textFill',defaults.textFill,[]));await req('SELECT',{ids:['text:4']});await assert.rejects(apply(plan),/STALE/);const abort=new AbortController();abort.abort();await assert.rejects(req('PREVIEW',{tool:'textFill',params:{}},abort.signal),/CANCELLED/);assert.equal((await state()).layers.find(n=>n.id==='text:1').text,'张三');
});
test('custom fill retains all four modes and removed preset payloads are rejected',async()=>{
 await client.loadScenario('text');
 for(const mode of ['sequence','cycle','fixed','random']){const plan=await preview('textFill',parameters('textFill',{...defaults.textFill,fillMode:mode,customValues:'Open\nDone'},[]));assert.equal(plan.rows.length,3);assert.ok(plan.rows.every(row=>['Open','Done'].includes(row.after)));if(mode==='fixed')assert.deepEqual(plan.rows.map(row=>row.after),['Open','Open','Open']);if(mode==='sequence'||mode==='cycle')assert.deepEqual(plan.rows.map(row=>row.after),['Open','Done','Open']);}
 for(const fieldType of ['name','phone','bureau','region','number','datetime','address','company'])await assert.rejects(preview('textFill',{scope:'selection',rules:[{fieldType,enabled:true,source:'default',fillMode:'cycle'}]}),/INVALID/);
});
test('split preserves punctuation and creates new text; merge joins selected texts',async()=>{
 await client.loadScenario('text');await req('SELECT',{ids:['text:7']});let plan=await preview('textSplitMerge',parameters('textSplitMerge',defaults.textSplitMerge,[]));assert.equal(plan.rows[0].runnable,true);assert.match(plan.rows[0].after,/苹果、/);let result=await apply(plan);assert.ok(result.success>0);assert.ok(result.state.layers.length>9);await req('UNDO');
 await req('SELECT',{ids:['text:1','text:2','text:3']});plan=await preview('textSplitMerge',parameters('textSplitMerge',{...defaults.textSplitMerge,mode:'merge',separator:' / '},[]));assert.equal(plan.rows[0].after,'张三 / 李四 / 王五');result=await apply(plan);assert.ok(result.success>0);assert.ok(result.state.layers.some(n=>n.text==='张三 / 李四 / 王五'));
});
test('find/replace supports text and font size without changing unrelated text',async()=>{
 await client.loadScenario('text');let plan=await preview('replace',parameters('replace',{...defaults.replace,find:'张',replace:'赵'},[]));assert.equal(plan.rows.length,1);const result=await apply(plan);assert.equal(result.state.layers.find(n=>n.id==='text:1').text,'赵三');
 plan=await preview('replace',parameters('replace',{...defaults.replace,mode:'fontSize',sourceStyle:'16',targetStyle:'24'},[]));assert.equal(plan.rows.filter(n=>n.runnable).length,3);assert.equal((await apply(plan)).success,3);
});
test('cleanup respects locks, deletes only checked candidates, and restores with undo',async()=>{
 await client.loadScenario('cleanup');const original=await state();const plan=await preview('cleanup',parameters('cleanup',defaults.cleanup,[]));assert.equal(plan.rows.length,3);assert.ok(!plan.rows.some(n=>n.id==='dirty:locked'));const result=await req('APPLY',{token:plan.token,ids:['dirty:hidden'],confirmed:true});assert.equal(result.success,1);assert.ok(result.state.layers.some(n=>n.id==='dirty:locked'));assert.ok(result.state.layers.some(n=>n.id==='dirty:empty'));assert.deepEqual(await req('UNDO'),original);
});
test('size adaptation updates the selected frame and keeps sidebar width; read-only inventory spans pages',async()=>{
 await client.loadScenario('layout');const original=await state();const plan=await preview('sizeFit',parameters('sizeFit',defaults.sizeFit,original.selection));assert.equal(plan.rows[0].runnable,true);assert.deepEqual(await state(),original);const result=await apply(plan);assert.equal(result.success,1);assert.equal(result.state.layers.find(n=>n.id==='demo:layout').width,960);assert.equal(result.state.layers.find(n=>n.id==='layout:side').width,150);assert.deepEqual(await req('UNDO'),original);const inventory=await req('STATS',{allPages:true});assert.equal(inventory.pages.length,2);assert.ok(inventory.total>0);assert.deepEqual(await state(),original);
});
test('settings validate URLs, preserve previous values after invalid writes, and never upload without consent',async()=>{
 storage.clear();const original=await req('SETTINGS_READ');assert.equal(original.allowUpload,false);await req('SETTINGS_SAVE',{locale:'ko'});await assert.rejects(req('SETTINGS_SAVE',{serviceUrl:'http://example.com'}),/INVALID_URL/);await assert.rejects(req('SETTINGS_SAVE',{locale:'invalid'}),/INVALID/);assert.equal((await req('SETTINGS_READ')).locale,'ko');assert.equal((await req('SETTINGS_READ')).serviceUrl,'');
});
