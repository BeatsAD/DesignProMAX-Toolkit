import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import { read, startHost } from './helpers.mjs';

test('actual production HTML passed to showUI stays below 1.5 MiB and is self contained', () => {
  const host = startHost();
  assert.equal(host.windows.length, 1);
  const html = host.windows[0].html;
  const bytes = Buffer.byteLength(html, 'utf8');
  assert.ok(bytes < 1_572_864, `Startup HTML is ${bytes} bytes`);
  assert.equal(bytes, JSON.parse(read('dist/build-info.json')).startupHtmlBytes);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|INLINE_SCRIPT|INLINE_STYLE/i);
  assert.equal(host.windows[0].options.themeColors, true);
  assert.equal(host.windows[0].options.width, 380);
  assert.equal(host.windows[0].options.height, 650);
});

test('Figma build version is independent and has no foreign host or removed tool inputs', () => {
  const info = JSON.parse(read('dist/build-info.json'));
  assert.equal(info.version, JSON.parse(read('package.json')).version);
  assert.equal(info.platform, 'figma');
  for (const input of info.inputs) {
    assert.doesNotMatch(input, /^\.\.\/|DesignProMAX-(?:Pixso|JSDesign)|vector-map|icon-library|preview\/client/);
  }
  const manifest = JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.editorType, ['figma']);
  assert.equal(manifest.documentAccess, 'dynamic-page');
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['*']);
  assert.match(manifest.networkAccess.reasoning,/consent/);
  assert.equal(manifest.id, undefined);
});


test('OCR assets are absent from showUI and chunk transport reconstructs the exact checksummed offline resource', async()=>{
  const host=startHost();const info=JSON.parse(read('dist/build-info.json'));
  assert.doesNotMatch(host.windows[0].html,/<script id="figma-ocr-payload"/);
  assert.ok(info.fullOfflineHtmlBytes>info.startupHtmlBytes+4_000_000);
  let content='',total=1;
  while(content.length<total){await host.figma.ui.onmessage({type:'RPC',requestId:'chunk',command:'GET_RESOURCE',payload:{id:'ocr',offset:content.length}});const message=host.messages.at(-1);assert.equal(message.ok,true);assert.equal(message.data.offset,content.length);assert.equal(message.data.checksum,info.resourceChecksum);total=message.data.total;content+=message.data.text;}
  assert.equal(content,read('dist/ocr-payload.json'));
  assert.equal(createHash('sha256').update(content).digest('hex'),info.resourceChecksum);
  for(const offset of [-1,1,total,Infinity]){await host.figma.ui.onmessage({type:'RPC',requestId:'bad',command:'GET_RESOURCE',payload:{id:'ocr',offset}});assert.equal(host.messages.at(-1).ok,false);}
});
test('reference banner stays outside showUI and round-trip through byte-checked chunks',async()=>{const host=startHost();for(const id of ['home-banner']){assert.ok(!host.windows[0].html.includes(`<script id="figma-${id}-payload"`));let content='',total=1,checksum;while(content.length<total){await host.figma.ui.onmessage({type:'RPC',requestId:'resource',command:'GET_RESOURCE',payload:{id,offset:content.length}});const m=host.messages.at(-1);assert.equal(m.ok,true);assert.equal(m.data.offset,content.length);content+=m.data.text;total=m.data.total;checksum=m.data.checksum;}assert.equal(content,read(`dist/${id}.json`));assert.equal(createHash('sha256').update(content,'utf8').digest('hex'),checksum);}});

test('production banner resource contains the new optimized text-free artwork, not the legacy banner',()=>{const resource=JSON.parse(read('dist/home-banner.json'));assert.equal(resource.mimeType,'image/jpeg');const bytes=Buffer.from(resource.data,'base64');assert.deepEqual(bytes,Buffer.from(readFileSync(new URL('../src/assets/home-banner-no-text.jpg',import.meta.url))));assert.ok(bytes.length<412823);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);});

test('removed common fields have no production modules, payloads or resource route',async()=>{
 const info=JSON.parse(read('dist/build-info.json'));for(const input of info.inputs)assert.doesNotMatch(input,/administrative-regions|text-fill-regions|numeric-fill|datetime-fill|DateTimePicker/);
 const host=startHost();assert.doesNotMatch(read('dist/ui.html'),/<script id="figma-text-regions-payload"|figma-resource-text-regions-sha256/);
 await host.figma.ui.onmessage({type:'RPC',requestId:'removed',command:'GET_RESOURCE',payload:{id:'text-regions',offset:0}});assert.equal(host.messages.at(-1).ok,false);
});
