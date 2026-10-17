import {useCallback,useEffect,useRef,useState} from 'react';
import {rpc,receiveHostMessage,sendMessage} from '../../../ui/bridge';
import {APP_VERSION} from '../../../shared/constants';
import type {SelectionSnapshot,PluginSettings,HomeLayoutSettings} from '../../shared/types';
import type {KnownMessageType,PluginSessionStartedData} from '../../shared/messages';
import {createPluginError} from '../../shared/messages';

declare const __BROWSER_PREVIEW__:boolean;
const empty:SelectionSnapshot={count:0,nodes:[]};
export type BridgeRequestOptions={signal?:AbortSignal;onProgress?:(p:{current:number;total:number;text:string})=>void};
export function usePluginBridge(){
 const[selection,setSelection]=useState(empty);const[selectionRefreshFailed,setSelectionRefreshFailed]=useState(false);const[connected,setConnected]=useState(false);const flight=useRef<Promise<SelectionSnapshot>|undefined>(undefined);
 const request=useCallback(async<TData,TPayload=unknown>(type:KnownMessageType,payload?:TPayload,options:BridgeRequestOptions={}):Promise<TData>=>{
   if(__BROWSER_PREVIEW__&&['RESIZE_UI','MINIMIZE_UI'].includes(type)){window.parent.postMessage({kind:'toolkit-preview-resize',payload},location.origin);return payload as TData;}
   const writing=/^(RUN_|APPLY_)/.test(type);
   const settled=(data?:unknown,error?:unknown)=>{if(writing&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('toolkit-write-settled',{detail:{data,error}}));};
   let result:TData;
   try{result=await rpc<TData>('REFERENCE',{type,payload},options.signal);}
   catch(error){const code=error instanceof Error?error.message:'INVALID';const mapped=createPluginError(code.includes('CANCEL')?'OPERATION_CANCELLED':code==='TIMEOUT'?'REQUEST_TIMEOUT':code==='WRITE_STATE_UNKNOWN'?'WRITE_STATE_UNKNOWN':code==='BUSY'?'TASK_BUSY':'UNKNOWN_ERROR',writing&&(code==='TIMEOUT'||code==='WRITE_STATE_UNKNOWN')?'写入结果待核对，请检查画布':code.includes('CANCEL')?'操作已取消':code==='STALE'?'配置或选区已变更，请重新生成预览。':code==='INVALID'?'请检查选区和参数后重试。':code==='LOCKED'?'对象或父级已锁定':code==='UNSUPPORTED'?'当前图层结构不支持此操作':code);settled(undefined,mapped);throw mapped;}
   if(writing){
     const outcome=result as {cancelled?:boolean;message?:string};
     if(outcome.cancelled&&outcome.message)outcome.message+='，后续已停止';
     // A refresh failure must never discard a committed write acknowledgement.
     settled(result);
     void refreshSelection().then(()=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('toolkit-preview-changed',{detail:{selectionRefreshed:true}}));}).catch(()=>{});
   }
   return result;
 },[]);
 const refreshSelection=useCallback(()=>{if(flight.current)return flight.current;const current=request<SelectionSnapshot>('GET_SELECTION').then(data=>{setSelection(data);setConnected(true);setSelectionRefreshFailed(false);return data;}).catch(error=>{setSelectionRefreshFailed(true);throw error;});flight.current=current;void current.finally(()=>{if(flight.current===current)flight.current=undefined;}).catch(()=>{});return current;},[request]);
 useEffect(()=>{const changed=(event?:Event)=>{if((event as CustomEvent)?.detail?.selectionRefreshed)return;void refreshSelection().catch(()=>{});};const message=(event:MessageEvent)=>{if(receiveHostMessage(event)?.type==='WORKSPACE_CHANGED')changed();};window.addEventListener('message',message);window.addEventListener('toolkit-preview-changed',changed);return()=>{window.removeEventListener('message',message);window.removeEventListener('toolkit-preview-changed',changed);};},[refreshSelection]);
 const send=useCallback((type:KnownMessageType,payload?:unknown)=>{if(type==='UI_READY'){sendMessage({type:'UI_READY'});return;}void request(type,payload).catch(()=>{});},[request]);
 const loadSettings=useCallback(()=>request<PluginSettings>('GET_SETTINGS'),[request]);const loadHomeLayout=useCallback(()=>request<HomeLayoutSettings>('GET_HOME_LAYOUT'),[request]);const loadCompactLayout=useCallback(()=>request<HomeLayoutSettings>('GET_COMPACT_LAYOUT'),[request]);
 const pluginSession:PluginSessionStartedData={sessionId:'toolkit-reference-v3',appVersion:APP_VERSION,buildId:`figma-${APP_VERSION}`};
 return{selection,selectionRefreshFailed,connected,request,send,refreshSelection,loadSettings,loadHomeLayout,loadCompactLayout,pluginSession};
}
