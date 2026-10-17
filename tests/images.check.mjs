import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from './load-module.mjs';
const {Controller}=await loadModule('src/engine/controller.ts');
const png=Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfasAAAAASUVORK5CYII=','base64'));
function fixture(){
 let created=0;const page={id:'page',type:'PAGE',name:'Test',children:[],selection:[],appendChild(node){page.children.push(node);node.parent=page;}};
 const source={id:'source',name:'Image',type:'RECTANGLE',parent:page,x:10,y:20,width:1,height:1,visible:true,locked:false,fills:[{type:'IMAGE',imageHash:'original',scaleMode:'FIT'}]};page.children=[source];page.selection=[source];
 const host={document:{currentPage:page,children:[page]},clientStorage:{},getImageByHref:()=>({getBytesAsync:async()=>new Uint8Array(png)}),createImage:()=>{created++;return{hash:'new'};},createRectangle:()=>({id:'new',type:'RECTANGLE',resize(w,h){this.width=w;this.height=h;}}),commitUndo:()=>{}};
 return {controller:new Controller(host),page,source,created:()=>created};
}
test('image writes validate the complete batch before any image or layer is created',async()=>{
 const f=fixture(),source=await f.controller.request('READ_IMAGE');const valid={name:'Result',bytes:png,width:1,height:1};await assert.rejects(f.controller.request('WRITE_IMAGES',{confirmed:true,source,results:[valid,{...valid,width:2}]}),/INVALID/);assert.equal(f.created(),0);assert.equal(f.page.children.length,1);
 const result=await f.controller.request('WRITE_IMAGES',{confirmed:true,source,results:[valid]});assert.equal(result.success,1);assert.equal(f.page.children.length,2);assert.equal(f.source.fills[0].imageHash,'original');assert.equal(f.page.children[1].x,35);
});
test('image writes reject stale pixels and changed geometry, and locked replacements create no images',async()=>{
 const f=fixture(),source=await f.controller.request('READ_IMAGE');const payload={confirmed:true,replace:true,source,results:[{name:'Result',bytes:png,width:1,height:1}]};await assert.rejects(f.controller.request('WRITE_IMAGES',{...payload,source:{...source,fingerprint:'changed'}}),/STALE/);f.page.locked=true;await assert.rejects(f.controller.request('WRITE_IMAGES',payload),/LOCKED/);f.page.locked=false;f.source.rotation=30;await assert.rejects(f.controller.request('WRITE_IMAGES',payload),/STALE/);assert.equal(f.created(),0);
});
test('background removal requires both consent and a personal key before contacting a service',async()=>{
 globalThis.window={addEventListener:()=>{},parent:{}};const {removeBackground}=await loadModule('src/image/process.ts');let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;return{ok:false};};const source={bytes:png,mimeType:'image/png',name:'Test'};
 try{for(const settings of [{allowUpload:false,apiKey:'test'},{allowUpload:true,apiKey:''}])await assert.rejects(removeBackground(source,settings,new AbortController().signal),/UPLOAD_DISABLED/);assert.equal(calls,0);await assert.rejects(removeBackground(source,{allowUpload:true,apiKey:'test',provider:'removebg'},new AbortController().signal),/EXTERNAL/);assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;delete globalThis.window;}
});
