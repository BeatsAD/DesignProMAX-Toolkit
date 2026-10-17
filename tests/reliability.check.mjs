import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {loadModule} from './load-module.mjs';
import {root} from './helpers.mjs';
const {Controller}=await loadModule('src/engine/controller.ts');
const {handleRunTextSplitMerge,handlePreviewTextSplitMerge}=await loadModule('src/engine/features/text-split-merge/main/handler.ts');
const {handleRunFindReplace}=await loadModule('src/engine/main/handlers/local-tools.ts');
const font={family:'Inter',style:'Regular'};
const png=Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfasAAAAASUVORK5CYII=','base64'));
const rules=[{fieldType:'custom:state',fieldLabel:'State',enabled:true,source:'custom',fillMode:'fixed',customValues:['Updated']}];
const merge={mode:'merge',separator:'custom',customSeparator:' / '};
function fixture(undo=false){
 let serial=0,createdImages=0;const byId=new Map();
 const page={id:'page:2',name:'Current',type:'PAGE',children:[],selection:[],appendChild(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);this.children.push(n);n.parent=this;}};
 const host={document:{currentPage:page,children:[page]},clientStorage:{getAsync:async()=>undefined,setAsync:async()=>{}},loadFontAsync:async()=>{},commitUndo(){},viewport:{scrollAndZoomIntoView(){}},getNodeByIdAsync:async id=>byId.get(id)};
 function node(type,id,props={}){const n={id,name:id,type,x:0,y:0,width:100,height:20,visible:true,locked:false,parent:page,removed:false,...props,remove(){this.removed=true;this.parent.children=this.parent.children.filter(n=>n!==this);page.selection=page.selection.filter(n=>n!==this);byId.delete(id);},resize(w,h){this.width=w;this.height=h;}};page.children.push(n);byId.set(id,n);return n;}
 const text=(id,value)=>node('TEXT',id,{characters:value,fontName:font,fontSize:16});
 host.getImageByHref=()=>({getBytesAsync:async()=>new Uint8Array(png)});
 host.createImage=()=>({hash:'image:'+ ++createdImages});
 host.createRectangle=()=>node('RECTANGLE','new:'+ ++serial);
 if(undo){let saved;host.beginUndoStep=()=>{saved={children:[...page.children],selection:[...page.selection],nodes:[...byId.values()].map(n=>({n,characters:n.characters,x:n.x,y:n.y,width:n.width,height:n.height,fills:n.fills,children:n.children?[...n.children]:undefined}))};};host.rollbackUndoStep=()=>{page.children=[...saved.children];page.selection=[...saved.selection];for(const n of byId.values())if(!saved.nodes.some(x=>x.n===n))n.removed=true;byId.clear();for(const {n,...values}of saved.nodes){Object.assign(n,values,{removed:false});byId.set(n.id,n);}};}
 const controller=new Controller(host);return{host,page,node,text,controller,byId,images:()=>createdImages,req:(type,payload={})=>controller.request('REFERENCE',{type,payload})};
}
function gateFont(host){let resolve,entered;const waiting=new Promise(r=>entered=r);host.loadFontAsync=()=>{entered();return new Promise(r=>resolve=r);};return{waiting,release:()=>resolve()};}
function imageFixture(undo=false){const f=fixture(undo);f.image=f.node('RECTANGLE','source',{width:1,height:1,fills:[{type:'IMAGE',imageHash:'original',scaleMode:'FIT'}]});f.page.selection=[f.image];return f;}
const crop=(f,source,mode='newLayer')=>({mode,confirmed:true,items:[{nodeId:f.image.id,sourceToken:source.sourceToken,resultImageBytes:png,bounds:{left:0,top:0,width:1,height:1}}]});

test('dynamic-page selected text writes do not inspect an unloaded preceding page',async()=>{
 const f=fixture(),n=f.text('target','Original');f.page.selection=[n];let forbiddenReads=0;
 f.host.document.children.unshift({id:'unloaded',type:'PAGE',get children(){forbiddenReads++;throw new Error('Page is not loaded');}});
 const plan=await f.req('PREVIEW_TEXT_FILL',{scope:'selection',rules});const before=forbiddenReads;
 const result=await f.req('RUN_TEXT_FILL',{items:plan.items,confirmed:true});assert.equal(result.successCount,1);assert.equal(n.characters,'Updated');
 // Preview invalidation may enumerate loaded pages, but ID lookup itself uses the native async API.
 assert.equal(forbiddenReads-before,0);
});
for(const mode of ['merge','split'])test(`${mode} cancellation while a font is loading causes no mutation`,async()=>{
 const f=fixture(),a=f.text('a','A,B'),b=f.text('b','B');f.page.selection=mode==='merge'?[a,b]:[a];
 const params=mode==='merge'?merge:{mode:'split',delimiters:[','],customDelimiters:',',retainDelimiter:false,trimWhitespace:true,direction:'vertical',gap:8};
 a.clone=()=>f.text('clone','A,B');const abort=new AbortController(),ctx={host:f.host,signal:{get aborted(){return abort.signal.aborted;},onCancel(){return()=>{};}}};
 const plan=handlePreviewTextSplitMerge(ctx,params);assert.equal(plan.canRun,true);
 const gate=gateFont(f.host);const pending=handleRunTextSplitMerge(ctx,{...params,confirmed:true,expectedSources:plan.sources});await gate.waiting;abort.abort();gate.release();await assert.rejects(pending,/TASK_CANCELLED/);assert.equal(a.characters,'A,B');assert.equal(f.page.children.length,2);
});
test('whole-node replacement checks cancellation after loading original fonts',async()=>{
 const f=fixture(),n=f.text('a','Original');f.page.selection=[n];const abort=new AbortController(),gate=gateFont(f.host);
 const pending=handleRunFindReplace({host:f.host,signal:{get aborted(){return abort.signal.aborted;},onCancel(){return()=>{};}}},{confirmed:true,items:[{nodeId:n.id,status:'ready',beforeText:'Original',afterText:'Updated',beforeStyle:{},afterStyle:{},applyMode:'wholeNode'}]});
 await gate.waiting;abort.abort();gate.release();await assert.rejects(pending,/TASK_CANCELLED/);assert.equal(n.characters,'Original');
});
test('edits, locks, removals and selection changes during font loading never get overwritten',async()=>{
 for(const change of ['edit','lock','remove','selection']){const f=fixture(),n=f.text('a','Original');f.page.selection=[n];const plan=await f.req('PREVIEW_TEXT_FILL',{scope:'selection',rules}),gate=gateFont(f.host);
 const pending=f.req('RUN_TEXT_FILL',{items:plan.items,confirmed:true});await gate.waiting;
 if(change==='edit')n.characters='Collaborator edit';if(change==='lock')n.locked=true;if(change==='remove')n.remove();if(change==='selection')f.page.selection=[];
 gate.release();const result=await pending;assert.equal(result.successCount,0,change);assert.equal(n.characters,change==='edit'?'Collaborator edit':'Original');}
});
test('cancelled text batches acknowledge earlier writes and leave later targets alone',async()=>{
 const f=fixture(),a=f.text('a','A'),b=f.text('b','B');f.page.selection=[a,b];const plan=await f.req('PREVIEW_TEXT_FILL',{scope:'selection',rules});const abort=new AbortController();let value=a.characters;
 Object.defineProperty(a,'characters',{get:()=>value,set:v=>{value=v;queueMicrotask(()=>abort.abort());}});
 const result=await f.controller.request('REFERENCE',{type:'RUN_TEXT_FILL',payload:{items:plan.items,confirmed:true}},abort.signal);
 assert.equal(result.successCount,1);assert.equal(result.cancelled,true);assert.equal(a.characters,'Updated');assert.equal(b.characters,'B');assert.match(result.message,/操作已停止/);assert.match(result.message,/成功 1 项/);assert.match(result.message,/已完成的修改保留/);
});
test('merge deletion failure restores every source and preserves the preceding edit',async()=>{
 const f=fixture(true),a=f.text('a','A'),b=f.text('b','B'),c=f.text('c','C');a.x=17;f.page.selection=[a,b,c];c.remove=()=>{throw new Error('Native removal rejected');};const ctx={host:f.host},plan=handlePreviewTextSplitMerge(ctx,merge);
 await assert.rejects(handleRunTextSplitMerge(ctx,{...merge,confirmed:true,expectedSources:plan.sources}),/Native removal rejected/);
 assert.deepEqual(f.page.children.map(n=>n.characters),['A','B','C']);assert.equal(a.x,17);assert.equal(b.removed,false);
});
test('unavailable rollback retains the full merged content and explicitly reports unknown state',async()=>{
 const f=fixture(),a=f.text('a','A'),b=f.text('b','B'),c=f.text('c','C');f.page.selection=[a,b,c];c.remove=()=>{throw new Error('Native removal rejected');};const ctx={host:f.host},plan=handlePreviewTextSplitMerge(ctx,merge);
 await assert.rejects(handleRunTextSplitMerge(ctx,{...merge,confirmed:true,expectedSources:plan.sources}),/WRITE_STATE_UNKNOWN/);assert.equal(a.characters,'A / B / C');
});
test('cleanup excludes instance children by default and mixed preview can run ordinary candidates',async()=>{
 for(const include of [false,true]){const f=fixture(),outside=f.text('outside','Outside'),inside=f.text('inside','Inside');outside.visible=inside.visible=false;
 const instance=f.node('INSTANCE','instance',{children:[inside]});inside.parent=instance;f.page.children=f.page.children.filter(n=>n!==inside);f.page.selection=[outside,instance];
 const p={scope:'selection',types:['hidden'],includeLocked:false,includeComponentInstanceChildren:include};const plan=await f.req('SCAN_CLEANUP',p);assert.equal(plan.items.length,include?2:1);
 const result=await f.req('RUN_CLEANUP',{nodeIds:plan.items.filter(n=>!n.insideInstance).map(n=>n.nodeId),types:p.types,confirmed:true});assert.equal(result.successCount,1);assert.ok(!f.page.children.includes(outside));assert.equal(inside.removed,false);}
});
test('plain replacement writes dollar sequences literally',async()=>{
 for(const replacement of ['Price $&','$$',"$`","$'",'$1','价格 $100']){const f=fixture(),n=f.text('a','A');f.page.selection=[n];
 const plan=await f.req('FIND_REPLACE_PREVIEW',{scope:'selection',target:'text',applyMode:'wholeNode',findText:'A',replaceText:replacement,matchMode:'contains',caseSensitive:true});assert.equal(plan.items[0].afterText,replacement);
 assert.equal((await f.req('RUN_FIND_REPLACE',{items:plan.items,confirmed:true})).successCount,1);assert.equal(n.characters,replacement);}
});
test('later image failure removes all outputs from the failed batch',async()=>{
 const f=imageFixture();let count=0;const create=f.host.createRectangle;f.host.createRectangle=()=>{const n=create();if(++count===2)n.resize=()=>{throw new Error('Native resize rejected');};return n;};
 const source=await f.controller.request('READ_IMAGE');await assert.rejects(f.controller.request('WRITE_IMAGES',{source,confirmed:true,results:[{name:'one',bytes:png,width:1,height:1},{name:'two',bytes:png,width:1,height:1}]}),/IMAGE_WRITE_FAILED/);
 assert.deepEqual(f.page.children.map(n=>n.id),['source']);
});
test('image preview tokens stay bound to the original placement across unrelated source reads',async()=>{
 const f=imageFixture(),source=await f.req('GET_IMAGE_SOURCE',{nodeId:f.image.id});f.image.x=240;await f.req('GET_TEXT_RECOGNITION_SOURCE',{nodeId:f.image.id});
 const result=await f.req('APPLY_TRANSPARENT_CROP',crop(f,source));assert.equal(result.successCount,0);assert.equal(result.failedCount,1);assert.equal(f.images(),0);
});
test('replaying a completed image write returns the receipt without duplicating its layer',async()=>{
 const f=imageFixture(),source=await f.req('GET_IMAGE_SOURCE',{nodeId:f.image.id}),p=crop(f,source);
 assert.equal((await f.req('APPLY_TRANSPARENT_CROP',p)).successCount,1);assert.equal((await f.req('APPLY_TRANSPARENT_CROP',p)).successCount,1);assert.equal(f.images(),1);assert.equal(f.page.children.length,2);
});
test('a missing or cross-tool source token never authorizes an image write',async()=>{
 const f=imageFixture(),source=await f.req('GET_REMOVE_BG_SOURCE',{nodeId:f.image.id});
 assert.equal((await f.req('APPLY_TRANSPARENT_CROP',crop(f,source))).failedCount,1);
 assert.equal((await f.req('APPLY_TRANSPARENT_CROP',crop(f,{sourceToken:''}))).failedCount,1);assert.equal(f.images(),0);
});
test('statistics loads only the requested pages',async()=>{
 const f=fixture();let ids;f.controller=new Controller(f.host,false,async selected=>{ids=selected;});await f.controller.request('REFERENCE',{type:'SCAN_DESIGN_STATS',payload:{pageIds:[f.page.id],includeMaterialTypes:['text']}});assert.deepEqual(ids,[f.page.id]);
});
test('a committed hook result survives a failing selection refresh',async()=>{
 globalThis.require=createRequire(import.meta.url);
 const bundle=await build({stdin:{contents:`import {createElement} from 'react';import {renderToString} from 'react-dom/server';import {usePluginBridge} from './src/reference/ui/hooks/usePluginBridge';let bridge;function Probe(){bridge=usePluginBridge();return null;}renderToString(createElement(Probe));export async function run(){return bridge.request('APPLY_IMAGE_SPLIT',{confirmed:true});}`,resolveDir:root,sourcefile:'hook-probe.ts'},bundle:true,write:false,format:'esm',platform:'node',define:{__BROWSER_PREVIEW__:'false',__APP_VERSION__:'"test"'},plugins:[{name:'rpc-fixture',setup(b){b.onResolve({filter:/ui\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function rpc(command,payload){if(payload.type==='GET_SELECTION')throw new Error('TIMEOUT');return{items:[{id:'one',nodeId:'created:1'}],cancelled:false};}export function receiveHostMessage(){}export function sendMessage(){}`,loader:'js'}));}}]});
 const probe=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));const result=await probe.run();assert.equal(result.items[0].nodeId,'created:1');await new Promise(r=>setImmediate(r));
});
test('failed native mutations commit their own undo step before rollback',async()=>{
 const {mutateWithRecovery}=await loadModule('src/engine/main/mutation.ts');const calls=[];
 const host={beginUndoStep(){calls.push('begin');},commitUndo(){calls.push('commit');},rollbackUndoStep(){calls.push('rollback');}};
 assert.throws(()=>mutateWithRecovery(host,changed=>{changed();throw Error('Injected');},()=>assert.fail('Native rollback expected')),/Injected/);
 assert.deepEqual(calls,['begin','commit','rollback']);calls.length=0;
 assert.throws(()=>mutateWithRecovery(host,()=>{throw Error('Before write');},()=>{}),/Before write/);assert.deepEqual(calls,['begin']);
});
test('all matched ranges of a node apply right to left without stale checks between own writes',async()=>{
 const f=fixture(),n=f.text('a','A-A-A');n.setRangeFontName=()=>{};n.setRangeFontSize=()=>{};f.page.selection=[n];
 const p=await f.req('FIND_REPLACE_PREVIEW',{scope:'selection',target:'text',applyMode:'matchedRange',findText:'A',replaceText:'longer',matchMode:'contains',caseSensitive:true});
 assert.equal(p.items.length,3);const r=await f.req('RUN_FIND_REPLACE',{items:p.items,confirmed:true});assert.equal(r.successCount,3);assert.equal(n.characters,'longer-longer-longer');
});
test('split failure after cloning removes every new node and restores source text',async()=>{
 const f=fixture(),a=f.text('a','A,B');f.page.selection=[a];a.clone=()=>{const n=f.text('clone','A,B');Object.defineProperty(n,'characters',{get:()=>'',set(){throw Error('Injected clone setter');}});return n;};
 const p={mode:'split',delimiters:[','],customDelimiters:',',retainDelimiter:false,trimWhitespace:true,direction:'vertical',gap:8},ctx={host:f.host},plan=handlePreviewTextSplitMerge(ctx,p);
 await assert.rejects(handleRunTextSplitMerge(ctx,{...p,confirmed:true,expectedSources:plan.sources}),/Injected clone setter/);assert.equal(a.characters,'A,B');assert.deepEqual(f.page.children.map(n=>n.id),['a']);
});
test('unknown image writes cannot be blindly replayed and source records are bounded',async()=>{
 const {SourceRecords}=await loadModule('src/engine/images/source-records.ts'),records=new SourceRecords();
 const source={nodeId:'a',bytes:[],width:1,height:1};const token=records.register(source,'crop'),record=records.get(token,'a','crop');let calls=0;
 const run=async()=>{calls++;throw Error('WRITE_STATE_UNKNOWN');};await assert.rejects(records.write(record,'op',run),/WRITE_STATE_UNKNOWN/);await assert.rejects(records.write(record,'op',run),/WRITE_STATE_UNKNOWN/);assert.equal(calls,1);
 for(let i=0;i<128;i++)records.register({...source,nodeId:String(i)},'crop');assert.throws(()=>records.get(token,'a','crop'),/STALE/);
});
const {removeImageBackgroundInUi}=await loadModule('src/reference/ui/remove-bg.ts');
const bgSettings={cutoutProvider:'removebg',allowImageUpload:true,removeBgApiKey:'fixture-secret-token',apiKey:'fixture-custom-token',customImageServiceUrl:'https://fixture.invalid'};
const bgPayload={quality:'standard'};
test('current background-removal implementation requires consent and real credentials before fetch',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected network');};
 try{for(const [settings,error]of [[{...bgSettings,allowImageUpload:false},/IMAGE_UPLOAD_DISABLED/],[{...bgSettings,removeBgApiKey:''},/REMOVE_BG_API_KEY_REQUIRED/],[{...bgSettings,removeBgApiKey:'********'},/脱敏占位/],[{...bgSettings,cutoutProvider:'none'},/API_NOT_CONFIGURED/]])await assert.rejects(removeImageBackgroundInUi(settings,new Uint8Array(png),bgPayload),error);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('current background-removal implementation reports HTTP failures without leaking keys',async()=>{
 const old=globalThis.fetch;
 try{for(const status of [401,402,403,429,500]){globalThis.fetch=async()=>new Response(JSON.stringify({errors:[{title:'Rejected '+bgSettings.removeBgApiKey}]}),{status});await assert.rejects(removeImageBackgroundInUi(bgSettings,new Uint8Array(png),bgPayload),error=>{assert.match(error.message,new RegExp('HTTP '+status));assert.ok(!error.message.includes(bgSettings.removeBgApiKey));return true;});}}finally{globalThis.fetch=old;}
});
test('current background-removal implementation supports custom service, success, cancel and timeout',async()=>{
 const old=globalThis.fetch,oldSet=globalThis.setTimeout;
 try{
  globalThis.fetch=async(url,init)=>{assert.equal(url,'https://fixture.invalid/remove-background');assert.equal(init.headers.Authorization,'Bearer '+bgSettings.apiKey);return new Response(new Uint8Array(png));};assert.deepEqual([...await removeImageBackgroundInUi({...bgSettings,cutoutProvider:'custom'},new Uint8Array(png),bgPayload)],png);
  const abort=new AbortController();globalThis.fetch=async(url,{signal})=>new Promise((_,reject)=>{if(signal.aborted)reject(new DOMException('Aborted','AbortError'));else signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const pending=removeImageBackgroundInUi(bgSettings,new Uint8Array(png),bgPayload,abort.signal);abort.abort();await assert.rejects(pending,/Aborted/);
  globalThis.setTimeout=(fn,ms,...args)=>oldSet(fn,ms===120000?1:ms,...args);await assert.rejects(removeImageBackgroundInUi(bgSettings,new Uint8Array(png),bgPayload),/请求超时/);
 }finally{globalThis.fetch=old;globalThis.setTimeout=oldSet;}
});
test('own auto-layout movements do not invalidate later batch targets, while concurrent edits still do',async()=>{
 for(const concurrent of [false,true]){
  const f=fixture(),a=f.text('a','A'),b=f.text('b','B'),frame=f.node('FRAME','layout',{layoutMode:'HORIZONTAL',children:[a,b]});a.parent=b.parent=frame;f.page.children=[frame];f.page.selection=[a,b];
  let value=a.characters;Object.defineProperty(a,'characters',{get:()=>value,set:v=>{value=v;b.x=400;}});
  const p=await f.req('PREVIEW_TEXT_FILL',{scope:'selection',rules});let gate;
  if(concurrent)gate=gateFont(f.host);
  const pending=f.req('RUN_TEXT_FILL',{items:p.items,confirmed:true});
  if(concurrent){await gate.waiting;b.characters='Collaborator edit';gate.release();}
  const r=await pending;assert.equal(r.successCount,concurrent?0:2);assert.equal(b.characters,concurrent?'Collaborator edit':'Updated');
 }
});
test('a replacement style failure rolls back text and reports no false successes',async()=>{
 const f=fixture(true),n=f.text('a','Before');f.page.selection=[n];const plan=await f.req('FIND_REPLACE_PREVIEW',{scope:'selection',target:'text',applyMode:'wholeNode',findText:'Before',replaceText:'After',matchMode:'contains',caseSensitive:true});
 Object.defineProperty(n,'fontSize',{get:()=>16,set(){throw Error('Native style failure');},configurable:true});
 const result=await f.req('RUN_FIND_REPLACE',{items:plan.items,confirmed:true});assert.equal(result.successCount,0);assert.equal(result.failedCount,1);assert.equal(n.characters,'Before');
});
test('an unknown mutation outcome takes precedence over a simultaneous cancellation',async()=>{
 const {runItemBatch}=await loadModule('src/engine/main/task.ts');let stopped=false;
 await assert.rejects(runItemBatch({signal:{get aborted(){return stopped;}}},[1],async()=>{stopped=true;throw Error('WRITE_STATE_UNKNOWN');}),/WRITE_STATE_UNKNOWN/);
});
