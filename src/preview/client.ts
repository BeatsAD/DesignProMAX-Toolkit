import { Controller } from '../engine/controller';
import type { HostNode,HostRuntime } from '../engine/main/host-runtime';
import type { Rpc } from '../shared/workspace';

type Data = {id:string;name:string;type:string;x?:number;y?:number;width?:number;height?:number;characters?:string;visible?:boolean;locked?:boolean;fills?:any;children?:Data[];fontName?:any;fontSize?:number;constraints?:any;layoutMode?:string};
let serial=100;let pages:HostNode[]=[];let current:HostNode;let selected:HostNode[]=[];let scenario='text';let history:string[]=[];
const images=new Map<string,Uint8Array>();
function plain(n:HostNode):Data {return {id:n.id,name:n.name,type:n.type,x:n.x,y:n.y,width:n.width,height:n.height,characters:n.characters,visible:n.visible,locked:n.locked,fills:n.fills,children:n.children?.map(plain),fontName:n.fontName,fontSize:typeof n.fontSize==='number'?n.fontSize:14,constraints:n.constraints,layoutMode:n.layoutMode};}
function hydrate(d:Data,parent?:HostNode):HostNode {
  const n:any={x:0,y:0,width:240,height:40,visible:true,locked:false,fontName:{family:'Inter',style:'Regular'},fontSize:16,fills:[{type:'SOLID',color:{r:.1,g:.15,b:.2,a:1}}],constraints:{horizontal:'START',vertical:'START'},...d,parent};
  n.children=d.children?.map(c=>hydrate(c,n));
  n.appendChild=(c:HostNode)=>{if(c.parent?.children)c.parent.children=c.parent.children.filter(x=>x!==c);n.children??=[];n.children.push(c);c.parent=n;};
  n.remove=()=>{if(n.parent)n.parent.children=n.parent.children.filter((x:HostNode)=>x!==n);selected=selected.filter(x=>x!==n);};
  n.resize=(w:number,h:number)=>{n.width=w;n.height=h;};
  n.clone=()=>{const d=plain(n);const change=(x:Data)=>{x.id=`preview:${++serial}`;x.children?.forEach(change);};change(d);const clone=hydrate(d,n.parent);n.parent?.appendChild(clone);return clone;};
  n.getRangeFontName=()=>n.fontName;n.getRangeFontSize=()=>n.fontSize;n.getRangeFills=()=>n.fills;
  n.setRangeFontName=(_s:number,_e:number,v:unknown)=>{n.fontName=v;};n.setRangeFontSize=(_s:number,_e:number,v:number)=>{n.fontSize=v;};n.setRangeFills=(_s:number,_e:number,v:unknown)=>{n.fills=v;};
  if(n.type==='PAGE')Object.defineProperty(n,'selection',{get:()=>selected,set:v=>{selected=v;},configurable:true});
  return n;
}
const page=(children:Data[]):Data=>({id:'page:1',name:'Demo / Product overview',type:'PAGE',children});
const txt=(id:string,name:string,text:string,x=24,y=24):Data=>({id,name,type:'TEXT',characters:text,width:220,height:26,x,y});
function snapshot(){return JSON.stringify({pages:pages.map(plain),selected:selected.map(n=>n.id),current:current.id});}
function restore(value:string){const v=JSON.parse(value);pages=v.pages.map((p:Data)=>hydrate(p));current=pages.find(p=>p.id===v.current)!;selected=all().filter(n=>v.selected.includes(n.id));}
function all(n?:HostNode):HostNode[]{return n?[n,...(n.children??[]).flatMap(x=>all(x))]:pages.flatMap(p=>all(p));}
const storage={getAsync:async<T>(key:string)=>{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:undefined;},setAsync:async<T>(key:string,value:T)=>localStorage.setItem(key,JSON.stringify(value)),deleteAsync:async(key:string)=>localStorage.removeItem(key)};
const documentHost:any={get currentPage(){return current;},get children(){return pages;},name:'DesignProMAX Toolkit — sample document'};
const host:HostRuntime={document:documentHost,clientStorage:storage,ui:{onmessage:null,postMessage:()=>{}},showUI:()=>{},commitUndo:()=>{},loadFontAsync:async()=>{},listAvailableFontsAsync:async()=>['Inter','Noto Sans SC','Arial'].flatMap(family=>['Regular','Bold'].map(style=>({fontName:{family,style}}))),getImageByHref:hash=>({getBytesAsync:async()=>images.get(hash)!}),createImage:bytes=>{const hash=`image:${++serial}`;images.set(hash,bytes);return {hash};},createRectangle:()=>hydrate({id:`preview:${++serial}`,name:'Image',type:'RECTANGLE'}),createText:()=>hydrate(txt(`preview:${++serial}`,'Text','')),viewport:{scrollAndZoomIntoView:()=>{},center:{x:0,y:0}}};
(host as any).checkpoint=()=>{history.push(snapshot());if(history.length>20)history.shift();};
const imageUrls=new Map<string,string>();
(host as any).imageUrl=(hash:string)=>{if(!imageUrls.has(hash)&&images.has(hash))imageUrls.set(hash,URL.createObjectURL(new Blob([images.get(hash)!.slice().buffer],{type:'image/png'})));return imageUrls.get(hash);};
export const controller=new Controller(host,true);

async function demoImage(split:boolean):Promise<Data>{
  const canvas=document.createElement('canvas');canvas.width=split?640:480;canvas.height=split?360:240;const c=canvas.getContext('2d')!;
  if(split){c.fillStyle='#fff';c.fillRect(0,0,640,360);for(let y=0;y<2;y++)for(let x=0;x<3;x++){c.fillStyle=['#dbe9d9','#f0ddc5','#d5e3ef'][x];c.fillRect(x*215+12,y*180+12,190,150);c.fillStyle='#233a31';c.font='bold 24px sans-serif';c.fillText(`Card ${y*3+x+1}`,x*215+28,y*180+65);}}
  else {c.fillStyle='#dcebcf';c.beginPath();c.roundRect(72,44,336,152,24);c.fill();c.fillStyle='#203f2a';c.font='bold 34px sans-serif';c.fillText('Hello Toolkit',96,114);c.font='19px sans-serif';c.fillText('Local OCR · 2026',98,153);}
  const blob=await new Promise<Blob>(r=>canvas.toBlob(b=>r(b!),'image/png'));const bytes=new Uint8Array(await blob.arrayBuffer());const {hash}=await host.createImage!(bytes) as {hash:string};
  return {id:'demo:image',name:split?'Cards / six items':'Image / transparent padding',type:'RECTANGLE',width:canvas.width,height:canvas.height,x:24,y:24,fills:[{type:'IMAGE',imageHash:hash,imageRef:hash,scaleMode:'FIT'}]};
}
export async function loadScenario(next:string){scenario=next;let roots:Data[]=[];
  if(next==='image'||next==='split')roots=[await demoImage(next==='split')];
  else if(next==='layout')roots=[{id:'demo:layout',name:'Dashboard / free layout',type:'FRAME',width:720,height:460,x:0,y:0,children:[{id:'layout:side',name:'Sidebar',type:'RECTANGLE',x:24,y:24,width:150,height:412,constraints:{horizontal:'START',vertical:'STRETCH'}},{id:'layout:main',name:'Content',type:'FRAME',x:198,y:24,width:498,height:412,constraints:{horizontal:'STRETCH',vertical:'STRETCH'},children:[txt('layout:title','Title','Overview',20,20),{id:'layout:chart',name:'Chart',type:'RECTANGLE',x:20,y:70,width:458,height:300,constraints:{horizontal:'STRETCH',vertical:'STRETCH'}}]}]}];
  else if(next==='cleanup')roots=[{id:'dirty:frame',name:'Review / cleanup',type:'FRAME',width:480,height:320,children:[txt('dirty:keep','Visible title','Keep this content'),{...txt('dirty:hidden','Hidden draft','Draft copy',24,70),visible:false},txt('dirty:empty','Empty text','',24,110),{id:'dirty:group',name:'Empty group',type:'GROUP',children:[],x:24,y:150,width:80,height:30},{...txt('dirty:locked','Locked draft','Protected',24,190),visible:false,locked:true}]}];
  else roots=[{id:'demo:card',name:'Text samples',type:'FRAME',width:480,height:440,children:[txt('text:1','姓名 / Name','张三',24,32),txt('text:2','姓名 / Name','李四',24,78),txt('text:3','姓名 / Name','王五',24,124),txt('text:4','金额 / Amount','120.00',24,170),txt('text:5','金额 / Amount','180.00',24,216),txt('text:6','日期 / Date','2026-10-16',24,262),txt('text:7','Paragraph','苹果、香蕉，葡萄。橙子；',24,308)]}];
  pages=[hydrate(page(roots)),hydrate({id:'page:2',name:'Demo / Archive',type:'PAGE',children:[txt('archive:1','Archive note','Review this page')]} )];current=pages[0];selected=next==='text'?all().filter(n=>n.id.startsWith('text:')).slice(0,3):[...(current.children??[])];history=[];return controller.state();
}
export const rpc:Rpc=async(command,p={},signal)=>{
  if(command==='SCENARIO')return await loadScenario(String(p.name)) as any;
  if(command==='SELECT'){selected=all().filter(n=>(p.ids as string[]).includes(n.id));return controller.state() as any;}
  if(command==='PAGE'){current=pages.find(n=>n.id===p.id)??current;selected=[];return controller.state() as any;}
  if(command==='UNDO'){const value=history.pop();if(value)restore(value);return controller.state() as any;}
  if(command==='UPLOAD'){
    (host as any).checkpoint();const bytes=new Uint8Array(p.bytes as number[]);const {hash}=await host.createImage!(bytes) as any;const n=hydrate({id:`upload:${++serial}`,name:String(p.name),type:'RECTANGLE',width:Number(p.width),height:Number(p.height),x:24,y:24,fills:[{type:'IMAGE',imageHash:hash,imageRef:hash,scaleMode:'FIT'}]});current.appendChild!(n);selected=[n];return controller.state() as any;
  }
  return controller.request(command,p,signal);
};
