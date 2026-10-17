import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {root,read} from './helpers.mjs';
import {loadModule} from './load-module.mjs';
const {buildOcrWorkerBootstrapSource,OCR_EMBEDDED_CORE_PATH,OCR_EMBEDDED_LANG_PATH,validateOcrEmbeddedPayload}=await loadModule('src/image/ocr-assets.ts');
test('offline OCR worker accepts only embedded Blob resources and rejects unexpected network access',async()=>{
 const calls=[];const self={importScripts:(...urls)=>calls.push(...urls),fetch:async url=>{calls.push(url);return url;}};
 runInNewContext(buildOcrWorkerBootstrapSource({workerSourceUrl:'blob:worker',coreSourceUrl:'blob:core',engSourceUrl:'blob:eng',chiSimSourceUrl:'blob:chi'}),{self});self.importScripts(OCR_EMBEDDED_CORE_PATH);await self.fetch(OCR_EMBEDDED_LANG_PATH+'/eng.traineddata.gz');assert.deepEqual(calls,['blob:worker','blob:core','blob:eng']);assert.throws(()=>self.importScripts('https://cdn.example.com/worker.js'),/LOCAL_RESOURCE_ONLY/);await assert.rejects(self.fetch('https://cdn.example.com/model'),/LOCAL_RESOURCE_ONLY/);assert.throws(()=>validateOcrEmbeddedPayload({version:1,assets:{}}),/INVALID/);
});
test('bundled OCR models match their pinned official provenance and decompressed checksums',()=>{
 const provenance=JSON.parse(read('src/assets/ocr/provenance.json'));assert.match(provenance.commit,/^[a-f0-9]{40}$/);for(const asset of provenance.assets){const bytes=readFileSync(resolve(root,'src/assets/ocr',asset.language+'.traineddata.gz'));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.gzipSha256);assert.equal(createHash('sha256').update(gunzipSync(bytes)).digest('hex'),asset.sha256);}
});

const {runOcrWorker}=await loadModule('src/image/ocr-client.ts');
test('OCR initialization rejection and cancellation terminate the Worker immediately',async()=>{
 const runtime={workerPath:'blob:worker',corePath:'blob:core',langPath:'local',release:()=>{}};
 let terminated=0;let worker;
 const failure=()=>worker={onmessage:null,onerror:null,onmessageerror:null,terminate:()=>terminated++,postMessage:message=>queueMicrotask(()=>worker.onmessage?.({data:{...message,status:message.action==='loadLanguage'?'reject':'resolve',data:{}}}))};
 await assert.rejects(runOcrWorker(runtime,[],new AbortController().signal,()=>{},failure),/OCR/);assert.equal(terminated,1);
 const abort=new AbortController();const cancelled=runOcrWorker(runtime,[],abort.signal,()=>{},()=>worker={onmessage:null,onerror:null,onmessageerror:null,terminate:()=>terminated++,postMessage:()=>{}});abort.abort();await assert.rejects(cancelled,/CANCELLED/);assert.equal(terminated,2);assert.equal(worker.onmessage,null);
});
test('OCR worker uses four sequential jobs and returns only text',async()=>{
 const runtime={workerPath:'blob:worker',corePath:'blob:core',langPath:'local',release:()=>{}};const actions=[];let worker;
 const result=await runOcrWorker(runtime,[1,2],new AbortController().signal,()=>{},()=>worker={onmessage:null,onerror:null,onmessageerror:null,terminate:()=>{},postMessage:message=>{actions.push(message.action);queueMicrotask(()=>worker.onmessage?.({data:{...message,status:'resolve',data:message.action==='recognize'?{text:'Hello Toolkit'}:{}}}));}});assert.equal(result,'Hello Toolkit');assert.deepEqual(actions,['load','loadLanguage','initialize','recognize']);
});
test('detailed OCR keeps engine confidence rather than manufacturing perfect scores',async()=>{const{runOcrWorkerData}=await loadModule('src/image/ocr-client.ts');let worker;const data=await runOcrWorkerData({workerPath:'blob:worker',corePath:'blob:core',langPath:'local'},[1],new AbortController().signal,()=>{},()=>worker={onmessage:null,onerror:null,onmessageerror:null,terminate:()=>{},postMessage:message=>queueMicrotask(()=>worker.onmessage?.({data:{...message,status:'resolve',data:message.action==='recognize'?{text:'Review me',confidence:61,blocks:[{paragraphs:[{lines:[{text:'Review me',confidence:57}]}]}]}:{}}}))});assert.equal(data.confidence,61);assert.deepEqual(data.lines,[{text:'Review me',confidence:57}]);});
