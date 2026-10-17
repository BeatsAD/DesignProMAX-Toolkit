import assert from 'node:assert/strict';
import test from 'node:test';
import {startHost} from './helpers.mjs';
import {loadModule} from './load-module.mjs';
const {compactContentHeight,normalizeWindowSize}=await loadModule('src/shared/window-size.ts');

test('compact windows fit both toolbar variants and taller content without a viewport feedback loop',()=>{
  assert.deepEqual(normalizeWindowSize({}),{width:380,height:650});
  assert.equal(compactContentHeight(48,58),110);
  assert.equal(compactContentHeight(48,48),100);
  assert.equal(compactContentHeight(60.5,58.25),123);
  for(const height of [100,110,123])assert.equal(normalizeWindowSize({width:420,height,minimized:true}).height,height);
  assert.equal(normalizeWindowSize({width:420,height:100}).height,400);
  assert.deepEqual(normalizeWindowSize({width:Infinity,height:NaN,minimized:true},{width:420,height:110}),{width:420,height:110});
});

test('latest Figma runtime accepts measured compact heights and restores normal windows',async()=>{
  const host=startHost(),sizes=[];
  host.figma.ui.resize=(width,height)=>sizes.push({width,height});
  for(const [type,payload]of [
    ['MINIMIZE_UI',{minimized:true,width:380,height:110}],
    ['MINIMIZE_UI',{minimized:true,width:380,height:100}],
    ['RESIZE_UI',{width:420,height:800}],
    ['MINIMIZE_UI',{minimized:false,width:1000,height:800}],
    ['MINIMIZE_UI',{minimized:true,width:420,height:1}],
    ['RESIZE_UI',{width:420,height:100}]
  ]){
    await host.figma.ui.onmessage({type:'RPC',requestId:'resize',command:'REFERENCE',payload:{type,payload}});
    assert.equal(host.messages.at(-1).ok,true);
  }
  assert.deepEqual(sizes,[{width:380,height:110},{width:380,height:100},{width:420,height:800},{width:1000,height:800},{width:420,height:80},{width:420,height:400}]);
  assert.equal(host.windows.length,1);
});
