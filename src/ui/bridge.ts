import { isSessionMessage, type SessionMessage, type UiMessage } from '../shared/protocol';
import type { Rpc,CancelSignal } from '../shared/workspace';
import {isWriteRequest} from '../shared/workspace';

declare const __BROWSER_PREVIEW__:boolean;
let previewClient:Promise<{rpc:Rpc}>|undefined;
let serial=0;
let pendingWrites=0;
export const hasPendingWrites=()=>pendingWrites>0;
let bridgeToken:string|undefined;
function sessionToken():string {
  return bridgeToken??=Array.from(window.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
}
// Figma's nested iframe receives native replies from the editor's top window.
// Require the exact editor origin for that relay, plus the per-UI token below.
export function receiveHostMessage(event:MessageEvent):Record<string,any>|undefined {
  const figmaTop=event.source===window.top&&event.origin==='https://www.figma.com';
  if(event.source!==window.parent&&event.source!==null&&!figmaTop)return undefined;
  const message=event.data?.pluginMessage;
  if(!bridgeToken||!message||typeof message!=='object'||message.bridgeToken!==bridgeToken)return undefined;
  return message;
}
function post(message:Record<string,unknown>):void {
  window.parent.postMessage({pluginMessage:{...message,bridgeToken:sessionToken()}},'*');
}
const pending=new Map<string,{command:string;resolve:(v:any)=>void;reject:(e:Error)=>void;cleanup:()=>void}>();
window.addEventListener('message',event=>{
  const response=receiveHostMessage(event);
  if(response?.type!=='RPC_RESULT'||typeof response.requestId!=='string'||typeof response.ok!=='boolean')return;
  const call=pending.get(response.requestId);if(!call)return;pending.delete(response.requestId);call.cleanup();
  if(call.command==='SETTINGS_READ')console.info('[DesignProMAX Toolkit] language settings reply accepted', {ok:response.ok,sourceIsNull:event.source===null});
  if(response.ok)call.resolve(response.data);else call.reject(new Error(String(response.code??'INVALID')));
});
export const rpc:Rpc=async<T>(command:string,payload={},signal?:CancelSignal):Promise<T>=>{
  if(signal?.aborted)throw new Error('CANCELLED');
  const writing=isWriteRequest(command,payload);if(writing)pendingWrites++;
  try {
  if(__BROWSER_PREVIEW__){previewClient??=import('../preview/client').then(async client=>{await client.loadScenario('text');return client;});return await (await previewClient).rpc<T>(command,payload,signal);}
  const requestId=`rpc_${++serial}_${Date.now()}`;
  return await new Promise<T>((resolve,reject)=>{
    const timeoutMs=command==='SETTINGS_READ'?10000:60000;
    const timer=window.setTimeout(()=>{pending.delete(requestId);cleanup();post({type:'CANCEL',requestId});console.warn(`[DesignProMAX Toolkit] ${command}: no valid host reply within ${timeoutMs}ms`);reject(new Error('TIMEOUT'));},timeoutMs);
    const cancel=()=>{post({type:'CANCEL',requestId});if(writing)return;pending.delete(requestId);cleanup();reject(new Error('CANCELLED'));};
    const cleanup=()=>{window.clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
    pending.set(requestId,{command,resolve,reject,cleanup});signal?.addEventListener('abort',cancel,{once:true});
    if(command==='SETTINGS_READ')console.info('[DesignProMAX Toolkit] requesting language settings');
    try{post({type:'RPC',requestId,command,payload});}catch(error){pending.delete(requestId);cleanup();reject(error);}
  });
  } finally {if(writing)pendingWrites--;}
};

export function sendMessage(message: UiMessage): void {
  post(message);
}

export function receiveSession(event: MessageEvent): SessionMessage | undefined {
  const message: unknown = receiveHostMessage(event);
  return isSessionMessage(message) ? message : undefined;
}
