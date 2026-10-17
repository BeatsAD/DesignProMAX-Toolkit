import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { root } from './helpers.mjs';
import { webcrypto } from 'node:crypto';

const source = buildSync({ absWorkingDir: root, entryPoints: ['src/ui/bridge.ts'], bundle: true, write: false, format: 'iife', globalName: 'Bridge', define: {__BROWSER_PREVIEW__:'false'} }).outputFiles[0].text;

test('UI wraps requests in the Figma pluginMessage envelope', () => {
  const sent = [];
  const context = { window: { crypto:webcrypto, addEventListener:()=>{}, parent: { postMessage: (...args) => sent.push(args) } } };
  runInNewContext(source, context);
  context.Bridge.sendMessage({ type: 'UI_READY' });
  assert.equal(sent[0][0].pluginMessage.type, 'UI_READY');
  assert.equal(sent[0][1], '*');
});

test('UI accepts valid host session messages and rejects other frames and malformed payloads', () => {
  let token;
  const parent = {postMessage:message=>{token=message.pluginMessage.bridgeToken;}};
  const context = { window: { crypto:webcrypto, addEventListener:()=>{}, parent } };
  runInNewContext(source, context);
  context.Bridge.sendMessage({type:'UI_READY'});
  const valid = { type: 'SESSION_STATE', version: '0.1.0', selectionCount: 2,bridgeToken:token };
  const receive = payload => context.Bridge.receiveSession({ source: parent, data: { pluginMessage: payload } });
  assert.equal(receive(valid).selectionCount, 2);
  assert.equal(context.Bridge.receiveSession({source:null,data:{pluginMessage:valid}}).selectionCount,2);
  assert.equal(receive({...valid,bridgeToken:'wrong'}),undefined);
  assert.equal(context.Bridge.receiveSession({ source: {}, data: { pluginMessage: valid } }), undefined);
  for (const invalid of [null, {}, { ...valid, selectionCount: -1 }, { ...valid, selectionCount: 1.5 }, { ...valid, selectionCount: '2' }]) {
    assert.equal(receive(invalid), undefined);
  }
});

test('RPC matches host replies, rejects spoofed frames, and sends cancellation on abort or timeout',async()=>{
 const sent=[],timers=new Map();let listener;let id=0;const parent={postMessage:(message)=>sent.push(message.pluginMessage)};
 const context={window:{crypto:webcrypto,parent,addEventListener:(_event,fn)=>{listener=fn;},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)}};runInNewContext(source,context);
 const call=context.Bridge.rpc('STATE');const request=sent.at(-1);listener({source:{},data:{pluginMessage:{type:'RPC_RESULT',requestId:request.requestId,bridgeToken:request.bridgeToken,ok:true,data:'spoof'}}});assert.equal(timers.size,1);listener({source:parent,data:{pluginMessage:{type:'RPC_RESULT',requestId:request.requestId,bridgeToken:request.bridgeToken,ok:true,data:'real'}}});assert.equal(await call,'real');assert.equal(timers.size,0);
 const abort=new AbortController();const cancelled=context.Bridge.rpc('STATE',{},abort.signal);abort.abort();await assert.rejects(cancelled,/CANCELLED/);assert.equal(sent.at(-1).type,'CANCEL');assert.equal(timers.size,0);
 const timeout=context.Bridge.rpc('STATE');[...timers.values()][0]();await assert.rejects(timeout,/TIMEOUT/);assert.equal(sent.at(-1).type,'CANCEL');assert.equal(timers.size,0);
});
