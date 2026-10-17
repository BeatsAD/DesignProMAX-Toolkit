import assert from 'node:assert/strict';
import test from 'node:test';
import {zlibSync} from 'fflate';
import {loadModule} from './load-module.mjs';
const {planPlacement,multiply,imageMapping}=await loadModule('src/engine/images/placement.ts');
const {Controller}=await loadModule('src/engine/controller.ts');
function png(w,h){
 const chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type),Buffer.from(data)]);let crc=0xffffffff;for(const b of body){crc^=b;for(let n=0;n<8;n++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}const length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(data.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,body,sum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const pixels=new Uint8Array(h*(w*4+1));for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.set([x%255,y%255,100,255],y*(w*4+1)+1+x*4);
 return Array.from(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(pixels)),chunk('IEND',[])]));
}
const original=png(100,100),cropped=png(80,60);
function fixture({mode='CROP',parentType='FRAME',layoutMode='NONE',rotation=0}={}){
 let serial=0,images=0;const page={id:'page',name:'Page',type:'PAGE',children:[],selection:[],appendChild(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);this.children.push(n);n.parent=this;}};
 const parent={id:'container',name:'Container',type:parentType,layoutMode,x:30,y:40,children:[],parent:page};page.children=[parent];
 const node={id:'source',name:'Image',type:'RECTANGLE',x:10,y:20,width:200,height:100,rotation,parent,visible:true,fills:[{type:'IMAGE',imageHash:'original',scaleMode:mode,...(mode==='CROP'?{imageTransform:[[.5,0,.25],[0,1,0]]}:{})}],resize(w,h){this.width=w;this.height=h;}};
 parent.children=[node];page.selection=[node];const host={document:{currentPage:page,children:[page]},clientStorage:{getAsync:async()=>undefined},getImageByHref:()=>({getBytesAsync:async()=>new Uint8Array(original)}),createImage:()=>{images++;return{hash:'result-'+images}},createRectangle:()=>({id:'result-'+(++serial),type:'RECTANGLE',resize(w,h){this.width=w;this.height=h;}}),commitUndo(){}};
 return {node,parent,page,controller:new Controller(host),images:()=>images};
}
const result={name:'Crop',bytes:cropped,width:80,height:60,offsetX:10,offsetY:20};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const transform=(m,x,y)=>[m[0][0]*x+m[0][1]*y+m[0][2],m[1][0]*x+m[1][1]*y+m[1][2]];

test('Crop replacement trims only visible transparent margins and preserves image coordinates',()=>{
 const f=fixture(),source={width:100,height:100},plan=planPlacement(f.node,source,result,true);
 near(plan.width,200);near(plan.height,60);near(plan.transform[0][2],10);near(plan.transform[1][2],40);
 for(const [u,v]of[[0,0],[.5,.5],[1,1]]){const before=transform(imageMapping(f.node,source,f.node.fills[0]),u,.2+.6*v),after=transform(plan.paintTransform,u,v);near(after[0]*80+10,before[0]*100);near(after[1]*60+20,before[1]*100);}
});
test('new Crop output includes the full processed image rather than the original clipped viewport',()=>{
 const f=fixture(),plan=planPlacement(f.node,{width:100,height:100},result,false);near(plan.width,320);near(plan.height,60);for(const [u,v]of[[0,0],[1,1]]){const p=transform(plan.paintTransform,u,v);near(p[0],u);near(p[1],v);}
});
test('FIT and FILL derive centered aspect-preserving source mappings',()=>{
 for(const mode of ['FIT','FILL']){const f=fixture({mode}),source={width:200,height:100};f.node.width=100;const m=imageMapping(f.node,source,f.node.fills[0]);if(mode==='FIT'){near(m[1][1],2);near(m[1][2],-.5);}else{near(m[0][0],.5);near(m[0][2],.25);}}
});
test('rotated image paints retain their source UVs after transparent crop',()=>{
 for(const rotation of [90,180,270]){const f=fixture({mode:'FIT'});f.node.fills[0].rotation=rotation;const source={width:100,height:100},p=planPlacement(f.node,source,result,true);const map=imageMapping(f.node,source,f.node.fills[0]);const localX=(p.transform[0][2]-f.node.x)/f.node.width,localY=(p.transform[1][2]-f.node.y)/f.node.height;for(const [u,v]of[[.2,.3],[.7,.8]]){const a=transform(map,localX+u*p.width/f.node.width,localY+v*p.height/f.node.height),b=transform(p.paintTransform,u,v);near(b[0]*80+10,a[0]*100);near(b[1]*60+20,a[1]*100);}}
});
test('new layers bypass automatic layout, instances and rotated ancestor coordinates without changing sources',async()=>{
 for(const options of [{layoutMode:'HORIZONTAL'},{parentType:'INSTANCE'},{rotation:30}]){const f=fixture(options),snapshot=JSON.stringify(f.node.fills),source=await f.controller.request('READ_IMAGE');const r=await f.controller.request('WRITE_IMAGES',{source,results:[result],confirmed:true});assert.equal(r.success,1);assert.equal(f.page.children.at(-1).parent,f.page);assert.equal(f.parent.children.length,1);assert.equal(JSON.stringify(f.node.fills),snapshot);assert.equal(f.node.width,200);assert.ok(f.page.children.at(-1).relativeTransform);}
});
test('replacement inside automatic layout and instances keeps geometry and compensates the cropped paint',async()=>{
 for(const options of [{layoutMode:'HORIZONTAL'},{parentType:'INSTANCE'}]){const f=fixture(options),source=await f.controller.request('READ_IMAGE');const r=await f.controller.request('WRITE_IMAGES',{source,results:[result],replace:true,confirmed:true});assert.equal(r.keptFrame,true);assert.equal(f.node.width,200);assert.equal(f.node.height,100);assert.equal(f.node.x,10);assert.equal(f.node.y,20);near(f.node.fills[0].imageTransform[0][0],.625);near(f.node.fills[0].imageTransform[0][2],.1875);}
});
test('rotated ordinary rectangles can replace pixels and move the new local crop origin correctly',async()=>{
 const f=fixture({rotation:30}),source=await f.controller.request('READ_IMAGE');await f.controller.request('WRITE_IMAGES',{source,results:[result],replace:true,confirmed:true});near(f.node.width,200);near(f.node.height,60);near(f.node.x,20);near(f.node.y,20+20*Math.sqrt(3)/2);near(f.node.relativeTransform[1][0],-.5);
});
test('changed Crop fills, invalid matrices and invalid later batch items cause no document writes',async()=>{
 const f=fixture(),source=await f.controller.request('READ_IMAGE');f.node.fills[0].imageTransform[0][2]=.3;await assert.rejects(f.controller.request('WRITE_IMAGES',{source,results:[result],confirmed:true}),/STALE/);assert.equal(f.images(),0);
 f.node.fills[0].imageTransform=[[0,0,0],[0,0,0]];const invalid=await f.controller.request('READ_IMAGE');await assert.rejects(f.controller.request('WRITE_IMAGES',{source:invalid,results:[result],confirmed:true}),/IMAGE_TRANSFORM_INVALID/);assert.equal(f.images(),0);
 const good=fixture(),current=await good.controller.request('READ_IMAGE');await assert.rejects(good.controller.request('WRITE_IMAGES',{source:current,results:[result,{...result,width:81}],confirmed:true}),/INVALID/);assert.equal(good.images(),0);
});
test('TILE can create independent output; direct replacement has an actionable per-item failure',async()=>{
 const f=fixture({mode:'TILE'}),source=await f.controller.request('READ_IMAGE');await f.controller.request('WRITE_IMAGES',{source,results:[result],confirmed:true,keepSelection:true});assert.equal(f.images(),1);const cropSource=await f.controller.request('REFERENCE',{type:'GET_IMAGE_SOURCE',payload:{nodeId:f.node.id}});const r=await f.controller.request('REFERENCE',{type:'APPLY_TRANSPARENT_CROP',payload:{confirmed:true,mode:'replaceOriginal',items:[{nodeId:f.node.id,sourceToken:cropSource.sourceToken,resultImageBytes:cropped,bounds:{left:10,top:20,width:80,height:60}}]}});assert.equal(r.failedCount,1);assert.match(r.failures[0].message,/平铺.*新建/);assert.equal(f.node.fills[0].imageHash,'original');
});
test('a failing replacement restores the original paint and dimensions',async()=>{
 const f=fixture(),source=await f.controller.request('READ_IMAGE'),old=JSON.stringify(f.node.fills);let calls=0;f.node.resize=function(w,h){if(++calls===1)throw new Error('Host refused');this.width=w;this.height=h;};await assert.rejects(f.controller.request('WRITE_IMAGES',{source,results:[result],replace:true,confirmed:true}),/IMAGE_WRITE_FAILED/);assert.equal(JSON.stringify(f.node.fills),old);assert.equal(f.node.width,200);assert.equal(f.node.height,100);
});
test('background-removal resampling maps the entire original source instead of an accidental top-left crop',async()=>{
 const f=fixture({mode:'FIT'});const source=await f.controller.request('REFERENCE',{type:'GET_REMOVE_BG_SOURCE',payload:{nodeId:f.node.id}});const r=await f.controller.request('REFERENCE',{type:'APPLY_REMOVE_BG',payload:{sourceNodeId:f.node.id,sourceToken:source.sourceToken,resultImageBytes:png(50,50),mode:'replaceOriginal',confirmed:true}});assert.equal(r.successCount,1);near(f.node.width,100);near(f.node.height,100);near(f.node.fills[0].imageTransform[0][0],1);
});

test('successive new outputs occupy free page space without colliding with earlier results',async()=>{
 const f=fixture(),source=await f.controller.request('READ_IMAGE');
 for(let i=0;i<2;i++)await f.controller.request('WRITE_IMAGES',{source,results:[result],confirmed:true,keepSelection:true});
 const [a,b]=f.page.children.slice(-2);assert.ok(b.x>=a.x+a.width+24-1e-6);assert.equal(f.parent.children.length,1);assert.equal(f.node.fills[0].imageHash,'original');
});
test('a stale item reports its own failure and does not prevent valid later crop items from writing',async()=>{
 const f=fixture();const source=await f.controller.request('REFERENCE',{type:'GET_IMAGE_SOURCE',payload:{nodeId:f.node.id}});
 const item={nodeId:f.node.id,sourceToken:source.sourceToken,resultImageBytes:cropped,bounds:{left:10,top:20,width:80,height:60}};
 const r=await f.controller.request('REFERENCE',{type:'APPLY_TRANSPARENT_CROP',payload:{mode:'newLayer',confirmed:true,items:[{...item,nodeId:'missing'},item]}});
 assert.equal(r.failedCount,1);assert.equal(r.successCount,1);assert.match(r.failures[0].message,/重新生成裁剪预览/);assert.equal(f.images(),1);
});
