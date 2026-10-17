import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { build, buildSync } from 'esbuild';
import { root, startHost } from './helpers.mjs';

const common = { absWorkingDir:root, bundle:true, write:false, format:'iife', define:{__BROWSER_PREVIEW__:'false'} };
const hashSource = buildSync({...common,entryPoints:['src/ui/sha256.ts'],globalName:'Hash'}).outputFiles[0].text;
const resourceSource = buildSync({...common,entryPoints:['src/ui/resources.ts'],globalName:'Resources'}).outputFiles[0].text;
// Exercise real OCR resource loading/validation/decompression; replace only the
// recognition worker, which needs a browser and is unrelated to integrity.
const ocrSource = (await build({...common,entryPoints:['src/image/process.ts'],globalName:'Images',plugins:[{
  name:'recognition-worker-fixture',setup(build) {
    build.onResolve({filter:/^\.\/ocr-client$/},()=>({path:'worker',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const runOcrWorkerData=async()=>({text:"worker reached"});export const runOcrWorker=runOcrWorkerData;'}));
  }
}]})).outputFiles[0].text;

function environment(crypto, overrides = {}) {
  return { crypto, TextEncoder, TextDecoder, Uint8Array, Uint32Array, DataView, ArrayBuffer,
    AbortController, DOMException, Blob, URL, atob, setTimeout, clearTimeout, ...overrides };
}
const insecureCrypto = () => ({getRandomValues:array=>webcrypto.getRandomValues(array)});
const expectedHash = text => createHash('sha256').update(text,'utf8').digest('hex');

test('SHA-256 works without Web Crypto for known vectors, UTF-8 and block/padding boundaries', async () => {
  const context = environment(insecureCrypto());
  runInNewContext(hashSource,context);
  assert.equal(await context.Hash.sha256Utf8('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const text of ['', '北京 🧰 café \ud800', ...[55,56,63,64,65,119,120,127,128,262143,262144,262145,1_000_000].map(n=>'a'.repeat(n))]) {
    assert.equal(await context.Hash.sha256Utf8(text),expectedHash(text),`UTF-8 bytes: ${Buffer.byteLength(text)}`);
  }
});

test('SHA-256 keeps the native path and supports cancellation during fallback work', async () => {
  let nativeCalls = 0;
  const native = environment({subtle:{digest:(...args)=>{nativeCalls++;return webcrypto.subtle.digest(...args);}}});
  runInNewContext(hashSource,native);
  assert.equal(await native.Hash.sha256Utf8('本地资源'),expectedHash('本地资源'));
  assert.equal(nativeCalls,1);
  const controller = new AbortController();
  let yields = 0;
  const fallback = environment(insecureCrypto(),{setTimeout:fn=>{yields++;controller.abort();queueMicrotask(fn);}});
  runInNewContext(hashSource,fallback);
  await assert.rejects(fallback.Hash.sha256Utf8('x'.repeat(1_000_000),controller.signal),{name:'AbortError'});
  assert.equal(yields,1);
  await assert.rejects(fallback.Hash.sha256Utf8('abc',controller.signal),{name:'AbortError'});
});

function nativeResources(source = resourceSource) {
  const host = startHost();
  const listeners = [], sent = [];
  let transform = message => message;
  const window = {top:{},crypto:insecureCrypto(),addEventListener:(_type,fn)=>listeners.push(fn),setTimeout,clearTimeout};
  window.parent = {postMessage:({pluginMessage})=>{
    sent.push(pluginMessage);
    queueMicrotask(()=>void host.figma.ui.onmessage(pluginMessage));
  }};
  host.figma.ui.postMessage = message => {
    const event = {source:window.top,origin:'https://www.figma.com',data:{pluginMessage:transform(message)}};
    for (const listener of listeners) listener(event);
  };
  const context = environment(window.crypto,{window});
  runInNewContext(source,context);
  return {host,sent,context,read:context.Resources?.readResource,transform:fn=>{transform=fn;}};
}

test('production banner loads through native bridge without crypto.subtle, merge reads and cache only success', async () => {
  const ui = nativeResources();
  assert.equal(ui.context.crypto.subtle,undefined);
  const cancelled = new AbortController(), active = new AbortController();
  const first = ui.read('home-banner',cancelled.signal);
  const second = ui.read('home-banner',active.signal);
  cancelled.abort();
  await assert.rejects(first,{name:'AbortError'});
  const banner = await second;
  assert.equal(banner.mimeType,'image/jpeg');
  assert.equal(Buffer.from(banner.data,'base64').length,76211);
  assert.equal(await ui.read('home-banner',new AbortController().signal),banner);
  assert.equal(ui.sent.filter(m=>m.command==='GET_RESOURCE').length,1);
  await assert.rejects(ui.read('text-regions',new AbortController().signal),/RESOURCE/);
  assert.equal(ui.host.windows.length,1,'resource reads must not recreate the UI');
});

test('native resource rejects corrupt content and permits a fresh retry without crypto.subtle', async () => {
  const ui = nativeResources();
  ui.transform(message=>message.data?.text ? {...message,data:{...message.data,text:message.data.text.replace(/("data":")(.)/,(_match,prefix,char)=>prefix+(char==='A'?'B':'A'))}} : message);
  await assert.rejects(ui.read('home-banner',new AbortController().signal),/RESOURCE/);
  ui.transform(message=>message);
  assert.equal((await ui.read('home-banner',new AbortController().signal)).mimeType,'image/jpeg');
  assert.equal(ui.sent.filter(m=>m.command==='GET_RESOURCE').length,2);
});

test('OCR uses the same fallback to verify the complete production payload before worker startup', async () => {
  const ui = nativeResources(ocrSource);
  const result = await ui.context.Images.recognizeDetailed({bytes:[1],mimeType:'image/png'},new AbortController().signal,()=>{});
  assert.equal(result.text,'worker reached');
  assert.ok(ui.sent.filter(m=>m.command==='GET_RESOURCE'&&m.payload.id==='ocr').length>1);
});
