import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { root, startHost } from './helpers.mjs';

const source = buildSync({ absWorkingDir:root, entryPoints:['src/ui/bridge.ts'], bundle:true, write:false, format:'iife', globalName:'Bridge', define:{__BROWSER_PREVIEW__:'false'} }).outputFiles[0].text;

function bridgeWindow(deliver = () => {}) {
  const listeners = [], timers = new Map(), sent = [], received = [];
  let timerId = 0;
  const parent = {postMessage(envelope) { sent.push(envelope.pluginMessage); deliver(envelope.pluginMessage); }};
  const window = {parent, top:{}, crypto:webcrypto, addEventListener:(_type,fn)=>listeners.push(fn), setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;}, clearTimeout:id=>timers.delete(id)};
  const context = {window};
  runInNewContext(source,context);
  function reply(message, source = null, origin = '') {
    const event = {source,origin,data:{pluginMessage:message}};
    received.push(event);
    for(const listener of listeners) listener(event);
    return event;
  }
  return {bridge:context.Bridge,window,timers,sent,received,reply};
}

function nativeTransport(storage, transport = 'null') {
  const host = startHost({clientStorage:storage});
  const ui = bridgeWindow(message=>queueMicrotask(()=>void host.figma.ui.onmessage(message)));
  host.figma.ui.postMessage = message=>ui.reply(message,transport==='top'?ui.window.top:null,transport==='top'?'https://www.figma.com':'');
  return {...ui,host};
}

test('cancelling a write waits for its acknowledged result instead of discarding applied counts',async()=>{
  const ui=bridgeWindow(),abort=new AbortController();
  const call=ui.bridge.rpc('REFERENCE',{type:'RUN_TEXT_FILL'},abort.signal),request=ui.sent.at(-1);
  assert.equal(ui.bridge.hasPendingWrites(),true);abort.abort();
  assert.equal(ui.sent.at(-1).type,'CANCEL');assert.equal(ui.timers.size,1);
  ui.reply({type:'RPC_RESULT',requestId:request.requestId,bridgeToken:request.bridgeToken,ok:true,data:{successCount:1,failedCount:0,cancelled:true}});
  const result=await call;assert.equal(result.successCount,1);assert.equal(result.cancelled,true);assert.equal(ui.bridge.hasPendingWrites(),false);
});

test('read cancellation stays immediate, while an unacknowledged cancelled write times out as unknown',async()=>{
  const ui=bridgeWindow(),readAbort=new AbortController();const read=ui.bridge.rpc('REFERENCE',{type:'GET_SELECTION'},readAbort.signal);readAbort.abort();await assert.rejects(read,/CANCELLED/);assert.equal(ui.timers.size,0);
  const abort=new AbortController(),write=ui.bridge.rpc('REFERENCE',{type:'APPLY_IMAGE_SPLIT'},abort.signal);abort.abort();[...ui.timers.values()][0].fn();await assert.rejects(write,/TIMEOUT/);assert.equal(ui.bridge.hasPendingWrites(),false);
});

for(const transport of ['null','top'])test(`production main and UI bridge round-trip first language read/save, reopen, session and selection through a source=${transport} relay`, async () => {
  const values = new Map();
  const storage = {getAsync:async key=>structuredClone(values.get(key)),setAsync:async(key,value)=>{values.set(key,structuredClone(value));}};
  const first = nativeTransport(storage,transport);
  const initial = await first.bridge.rpc('SETTINGS_READ');
  assert.equal(initial.locale,undefined);
  assert.equal(values.size,0);
  await first.bridge.rpc('SETTINGS_SAVE',{locale:'ja'});
  assert.equal(values.get('figma.toolkit.settings.v1').locale,'ja');
  first.bridge.sendMessage({type:'UI_READY'});
  await new Promise(resolve=>setImmediate(resolve));
  const session = first.received.find(event=>event.data.pluginMessage.type==='SESSION_STATE');
  assert.ok(first.bridge.receiveSession(session));
  first.host.listeners.get('selectionchange')();
  assert.equal(first.bridge.receiveHostMessage(first.received.at(-1)).type,'WORKSPACE_CHANGED');
  assert.equal(first.timers.size,0);
  const reopened = nativeTransport(storage,transport);
  assert.equal((await reopened.bridge.rpc('SETTINGS_READ')).locale,'ja');
  assert.notEqual(first.sent[0].bridgeToken,reopened.sent[0].bridgeToken);
  assert.equal(reopened.bridge.receiveHostMessage(session),undefined);
});

test('Figma top-window replies require the exact host origin, session token, pending ID and result shape', async () => {
  const ui = bridgeWindow();
  assert.notEqual(ui.window.parent,ui.window.top);
  const pending = ui.bridge.rpc('SETTINGS_READ');
  const request = ui.sent.at(-1);
  const result = {type:'RPC_RESULT',requestId:request.requestId,bridgeToken:request.bridgeToken,ok:true,data:{locale:'en'}};
  for(const origin of ['', 'null','https://example.com','https://www.figma.com.example.com','http://www.figma.com'])ui.reply(result,ui.window.top,origin);
  for(const message of [{...result,bridgeToken:undefined},{...result,bridgeToken:'wrong'},{...result,requestId:'old-request'},{...result,ok:'true'}])ui.reply(message,ui.window.top,'https://www.figma.com');
  ui.reply(result,{},'https://www.figma.com');
  assert.equal(ui.timers.size,1);
  const event = ui.reply(result,ui.window.top,'https://www.figma.com');
  assert.equal(ui.timers.size,0,'the successful real-shaped reply must complete the request');
  assert.equal((await pending).locale,'en');
  assert.equal(ui.bridge.receiveSession({...event,data:{pluginMessage:{type:'SESSION_STATE',version:'0.3.1',selectionCount:0,bridgeToken:request.bridgeToken}}}).selectionCount,0);
});

test('relay accepts only an authenticated pending reply and times out settings reads at ten seconds with a fresh retry', async () => {
  const ui = bridgeWindow();
  const pending = ui.bridge.rpc('SETTINGS_READ');
  const request = ui.sent.at(-1);
  const result = {type:'RPC_RESULT',requestId:request.requestId,bridgeToken:request.bridgeToken,ok:true,data:{locale:'ko'}};
  for(const message of [{...result,bridgeToken:undefined},{...result,bridgeToken:'wrong'},{...result,requestId:'not-pending'},{...result,ok:'true'}]) ui.reply(message);
  ui.reply(result,{}); // Even a known token does not admit another frame.
  assert.equal(ui.timers.size,1);
  const timer = [...ui.timers.values()][0];
  assert.equal(timer.ms,10000);
  timer.fn();
  await assert.rejects(pending,/TIMEOUT/);
  assert.equal(ui.sent.at(-1).type,'CANCEL');
  assert.equal(ui.timers.size,0);
  ui.reply(result); // A late reply cannot complete the next attempt.
  const retry = ui.bridge.rpc('SETTINGS_READ');
  const next = ui.sent.at(-1);
  assert.notEqual(next.requestId,request.requestId);
  ui.reply(result);
  assert.equal(ui.timers.size,1);
  ui.reply({...result,requestId:next.requestId});
  assert.equal((await retry).locale,'ko');
  assert.equal(ui.timers.size,0);
});

test('a real main-thread storage failure reaches the UI without overwriting saved settings and permits another read', async () => {
  let fail = true, writes = 0;
  const ui = nativeTransport({getAsync:async()=>{if(fail)throw new Error('storage unavailable');return {locale:'de'};},setAsync:async()=>{writes++;}});
  await assert.rejects(ui.bridge.rpc('SETTINGS_READ'),/INVALID/);
  fail = false;
  assert.equal((await ui.bridge.rpc('SETTINGS_READ')).locale,'de');
  assert.equal(writes,0);
  assert.equal(ui.timers.size,0);
});
