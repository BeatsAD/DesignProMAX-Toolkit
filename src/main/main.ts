import {normalizeWindowSize} from '../shared/window-size';
import { APP_VERSION,UI_SIZE } from '../shared/constants';
import { Controller } from '../engine/controller';
import { createHost } from './host';
import type { CancelSignal } from '../shared/workspace';
const initialHtml=__html__.replace(/<script id="figma-(?:ocr|home-banner)-payload" type="application\/json">[\s\S]*?<\/script>/g,'');
const controller=new Controller(createHost(figma),false,async pageIds=>{if(!pageIds){await figma.loadAllPagesAsync();return;}const requested=new Set(pageIds);for(const page of figma.root.children)if(requested.has(page.id))await page.loadAsync();});
let ready=false;let writing=false;let uiToken:string|undefined;const cancelled=new Map<string,()=>void>();
const commands=new Set(['STATE','SETTINGS_READ','SETTINGS_SAVE','FONTS','STYLES','STATS','PREVIEW','APPLY','READ_IMAGE','WRITE_IMAGES','PAGES_LOAD','REFERENCE']);
const writes=new Set(['APPLY','WRITE_IMAGES']);
const isWrite=(m:Record<string,any>)=>writes.has(m.command)||m.command==='REFERENCE'&&/^(RUN_|APPLY_)/.test(m.payload?.type??'');
figma.ui.onmessage=async(raw:unknown)=>{
 if(!raw||typeof raw!=='object')return;const m=raw as Record<string,any>;
 if(typeof m.bridgeToken==='string'&&/^[a-f0-9]{32}$/.test(m.bridgeToken))uiToken=m.bridgeToken;
 if(m.type==='CLOSE_PLUGIN'){figma.closePlugin();return;}
 if(m.type==='UI_READY'){ready=true;figma.ui.postMessage({type:'SESSION_STATE',version:APP_VERSION,selectionCount:figma.currentPage.selection.length,bridgeToken:uiToken});return;}
 if(m.type==='CANCEL'&&typeof m.requestId==='string'){cancelled.get(m.requestId)?.();return;}
 if(m.type!=='RPC'||typeof m.requestId!=='string'||m.requestId.length>100||typeof m.command!=='string')return;
 if(m.command==='SETTINGS_READ')console.info('[DesignProMAX Toolkit] language settings request reached main');
 const response=(ok:boolean,data?:unknown,code?:string)=>figma.ui.postMessage({type:'RPC_RESULT',requestId:m.requestId,ok,data,code,bridgeToken:m.bridgeToken});
 try{
  ready=true;
  if(m.command==='GET_RESOURCE'){
   const id=m.payload?.id;if(!['ocr','home-banner'].includes(id))throw new Error('INVALID');const tag=`<script id="figma-${id}-payload" type="application/json">`;const resourceStart=__html__.indexOf(tag);const resourceEnd=__html__.indexOf('</script>',resourceStart);if(resourceStart<0||resourceEnd<0)throw new Error('INVALID');const content=__html__.slice(resourceStart+tag.length,resourceEnd);const offset=m.payload.offset;
   if(!Number.isSafeInteger(offset)||offset<0||offset>=content.length||offset%131072!==0)throw new Error('INVALID');
   const meta=id==='ocr'?'figma-resource-sha256':`figma-resource-${id}-sha256`;const hash=new RegExp(`<meta name="${meta}" content="([a-f0-9]{64})">`).exec(__html__)?.[1];
   response(true,{text:content.slice(offset,offset+131072),offset,total:content.length,checksum:hash});return;
  }
  if(m.command==='REFERENCE'&&['RESIZE_UI','MINIMIZE_UI'].includes(m.payload?.type)){const p=m.payload.payload??{};const {width,height}=normalizeWindowSize(p);figma.ui.resize(width,height);response(true,{width,height});return;}
  if(!commands.has(m.command))throw new Error('INVALID');
  if(cancelled.has(m.requestId))throw new Error('BUSY');
  if(isWrite(m)&&writing)throw new Error('BUSY');
  let stopped=false;const listeners=new Set<()=>void>();const signal:CancelSignal={get aborted(){return stopped;},addEventListener:(_t,fn)=>{listeners.add(fn);},removeEventListener:(_t,fn)=>{listeners.delete(fn);}};
  cancelled.set(m.requestId,()=>{stopped=true;for(const fn of listeners)fn();});
  if(isWrite(m))writing=true;
  try{response(true,await controller.request(m.command,m.payload??{},signal));}finally{if(isWrite(m))writing=false;cancelled.delete(m.requestId);}
 }catch(error){const message=error instanceof Error?error.message:'INVALID';response(false,undefined,/^[A-Z_]+$/.test(message)?message:'INVALID');}
};
const changed=()=>{if(ready)figma.ui.postMessage({type:'WORKSPACE_CHANGED',bridgeToken:uiToken});};
figma.on('selectionchange',changed);figma.on('currentpagechange',changed);
figma.showUI(initialHtml,{...UI_SIZE,themeColors:true});
