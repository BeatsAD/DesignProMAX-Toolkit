import {SourceRecords} from './images/source-records';
import {sourceFingerprint} from './shared/image-split';
import {imageWriteErrorMessage} from '../shared/image-write-errors';
import {isThemePreference} from '../shared/theme';
import type {HostRuntime,HostNode,HandlerContext} from './main/host-runtime';
import * as tools from './main/handlers/local-tools';
import {handlePreviewTextSplitMerge,handleRunTextSplitMerge} from './features/text-split-merge/main/handler';
import {handleScanDesignStats} from './main/handlers/design-stats';
import {nodesForScope,snapshotNode} from './main/handlers/nodes';
import {DEFAULT_SETTINGS,normalizeHomeLayout,normalizeTextFillCustomFields,normalizeFindReplaceHistory,updateReplaceHistory} from './reference-storage';
import type {CancelSignal,Params,ImageSource,Rpc} from '../shared/workspace';
import {guardNodes, nodeWriteState, selectionState, type SelectionState} from './main/write-guard';
import {createDiagnosticStore,exportDiagnostics} from './shared/diagnostics';

type Plan={raw:any;params:any;targets:HostNode[];nodes:Map<string,string>;selection:SelectionState};
export class ReferenceController{
 private diagnostics=createDiagnosticStore();
 private plans=new Map<string,Plan>();private sources=new SourceRecords();
 constructor(private host:HostRuntime,private rpc:Rpc,private loadPages:(pageIds?:readonly string[])=>Promise<void>){}
 private context(signal?:CancelSignal):HandlerContext{return{host:this.host,signal:signal?{get aborted(){return signal.aborted;},onCancel:cb=>{signal.addEventListener('abort',cb,{once:true});return()=>signal.removeEventListener('abort',cb);}}:undefined};}
 private async read(key:string,fallback:any){return await this.host.clientStorage.getAsync('figma.toolkit.reference.'+key)??fallback;}
 private async save(key:string,value:any){await this.host.clientStorage.setAsync('figma.toolkit.reference.'+key,value);return value;}
 async request(type:string,p:any={},signal?:CancelSignal):Promise<any>{const start=Date.now();try{const result=await this.dispatch(type,p,signal);this.diagnostics.record({source:'main',level:'info',event:'request:complete',messageType:type,durationMs:Date.now()-start});return result;}catch(error){this.diagnostics.record({source:'main',level:'error',event:'request:failed',messageType:type,durationMs:Date.now()-start,errorCode:error instanceof Error?error.message:'INVALID'});throw error;}}
 private async dispatch(type:string,p:any={},signal?:CancelSignal):Promise<any>{
  if(signal?.aborted)throw new Error('CANCELLED');const ctx=this.context(signal);
  if(type==='GET_SELECTION')return{count:this.host.document.currentPage.selection.length,nodes:this.host.document.currentPage.selection.map(snapshotNode)};
  if(type==='GET_SETTINGS'){const previous=await this.rpc<any>('SETTINGS_READ');return {...DEFAULT_SETTINGS,removeBgApiKey:previous.apiKey,customImageServiceUrl:previous.serviceUrl,allowImageUpload:previous.allowUpload,themeMode:previous.theme,...await this.read('settings',{})};}
  if(type==='SAVE_SETTINGS'){const previous=await this.request('GET_SETTINGS');const patch=Object.fromEntries(Object.entries(p).filter(([key])=>key in DEFAULT_SETTINGS));for(const[key,value]of Object.entries(patch)){if(typeof value!==typeof (DEFAULT_SETTINGS as any)[key])throw new Error('INVALID');}if(patch.themeMode!==undefined&&!isThemePreference(patch.themeMode))throw new Error('INVALID');if(patch.customImageServiceUrl&&!/^https:\/\/[^\s/@]+(?:[/:?#]|$)/.test(String(patch.customImageServiceUrl)))throw new Error('INVALID_URL');return this.save('settings',{...previous,...patch});}
  if(type==='GET_HOME_LAYOUT'||type==='GET_COMPACT_LAYOUT')return normalizeHomeLayout(await this.read(type==='GET_HOME_LAYOUT'?'layout':'compact-layout',undefined));
  if(type==='SAVE_HOME_LAYOUT'||type==='SAVE_COMPACT_LAYOUT')return this.save(type==='SAVE_HOME_LAYOUT'?'layout':'compact-layout',normalizeHomeLayout(p));
  if(type==='GET_TEXT_FILL_CUSTOM_FIELDS')return this.read('custom-fields',[]);
  if(type==='SAVE_TEXT_FILL_CUSTOM_FIELDS')return this.save('custom-fields',normalizeTextFillCustomFields(p.fields));
  if(type==='GET_FIND_REPLACE_HISTORY')return{entries:normalizeFindReplaceHistory(await this.read('replace-history',[]))};
  if(type==='UPSERT_FIND_REPLACE_HISTORY'){const entries=updateReplaceHistory(await this.read('replace-history',[]),p);await this.save('replace-history',entries);return{entries};}
  if(type==='CLEAR_FIND_REPLACE_HISTORY'){await this.save('replace-history',[]);return{message:'历史记录已清空'};}
  if(type==='GET_MESSAGE_READ_STATE')return this.read('messages',{readIds:[]});
  if(type==='ACKNOWLEDGE_MESSAGE_WELCOME'){const old=await this.read('messages',{readIds:[]});return this.save('messages',{...old,welcomeAcknowledged:true});}
  if(type==='MARK_MESSAGE_READ'){const old=await this.read('messages',{readIds:[]});return this.save('messages',{...old,readIds:[...new Set([...old.readIds,String(p.id)])]});}
  if(type==='GET_DIAGNOSTIC_STATUS'){const detailedEnabled=await this.read('diagnostics',false);this.diagnostics.setDetailedEnabled(detailedEnabled);return{detailedEnabled,entryCount:this.diagnostics.getEntries().length};}
  if(type==='SAVE_DIAGNOSTIC_SETTINGS'){if(typeof p.detailedEnabled!=='boolean')throw new Error('INVALID');await this.save('diagnostics',p.detailedEnabled);return this.request('GET_DIAGNOSTIC_STATUS');}
  if(type==='CLEAR_DIAGNOSTIC_LOGS'){if(p.confirmed!==true)throw new Error('CONFIRM');this.diagnostics.clear();return{...this.diagnostics.getSettings(),entryCount:0};}
  if(type==='CLEAR_CACHE'){if(p.confirmed!==true||p.scope!=='cache')throw new Error('CONFIRM');this.plans.clear();this.sources.clear();await this.host.clientStorage.deleteAsync('figma.toolkit.reference.cache');return{clearedKeys:['figma.toolkit.reference.cache']};}
  if(type==='EXPORT_DIAGNOSTIC_LOGS')return exportDiagnostics({entries:this.diagnostics.getEntries(),diagnosticSettings:this.diagnostics.getSettings(),settings:await this.request('GET_SETTINGS')});
  if(type==='LIST_AVAILABLE_FONTS')return tools.handleListAvailableFonts(ctx);
  if(type==='SCAN_FIND_REPLACE_STYLES'){if(p.scope==='currentFile')await this.loadPages();return tools.handleScanFindReplaceStyles(ctx,p);}
  if(type==='GET_LOCATE_PAGES')return{pages:(this.host.document.children??[]).map(page=>({pageId:page.id,pageName:page.name,isCurrent:page.id===this.host.document.currentPage.id}))};
  if(type==='SCAN_DESIGN_STATS'){await this.loadPages(p.pageIds?.length?p.pageIds:[this.host.document.currentPage.id]);if(signal?.aborted)throw new Error('CANCELLED');return handleScanDesignStats(ctx,p);}
  const previewTypes:Record<string,string>={PREVIEW_TEXT_FILL:'textFill',FIND_REPLACE_PREVIEW:'replace',SCAN_CLEANUP:'cleanup',PREVIEW_SIZE_FIT:'sizeFit',PREVIEW_TEXT_SPLIT_MERGE:'textSplitMerge'};
  const tool=previewTypes[type];
  if(tool){if(p.scope==='allPages'||p.scope==='currentFile')await this.loadPages();let raw:any;if(tool==='textFill')raw=tools.handlePreviewTextFill(ctx,p);else if(tool==='replace')raw=tools.handleFindReplacePreview(ctx,p);else if(tool==='cleanup')raw=tools.handleScanCleanup(ctx,p);else if(tool==='sizeFit')raw=await tools.handlePreviewSizeFit(ctx,p);else raw=handlePreviewTextSplitMerge(ctx,p);const ids=new Set<string>([...(raw.items??[]).map((n:any)=>n.nodeId),...(raw.sources??[]).map((n:any)=>n.nodeId)]);const targets=nodesForScope(this.host,p.scope??'selection').filter(n=>ids.has(n.id));const nodes=new Map(targets.map(n=>[n.id,nodeWriteState(n)]));this.plans.set(tool,{raw,params:p,targets,nodes,selection:selectionState(this.host)});return raw;}
  const runTypes:Record<string,string>={RUN_TEXT_FILL:'textFill',RUN_FIND_REPLACE:'replace',RUN_CLEANUP:'cleanup',RUN_SIZE_FIT:'sizeFit',RUN_TEXT_SPLIT_MERGE:'textSplitMerge'};const run=runTypes[type];
  if(run){const plan=this.plans.get(run);if(!p.confirmed||!plan)throw new Error('STALE');
   ctx.expectedNodes=new Map(plan.nodes);ctx.expectedTargets=plan.targets;ctx.expectedSelection=plan.selection;guardNodes(ctx,plan.targets)();
   if(run==='textFill'||run==='replace'){const allowed=new Set(plan.raw.items.map((item:any)=>JSON.stringify(item)));if(!p.items?.length||p.items.some((item:any)=>!allowed.has(JSON.stringify(item))||item.canRun===false))throw new Error('STALE');}
   if(run==='cleanup'){const allowed=new Set(plan.raw.items.filter((n:any)=>!n.locked&&!n.insideInstance).map((n:any)=>n.nodeId));if(!p.nodeIds?.length||p.nodeIds.some((id:string)=>!allowed.has(id))||JSON.stringify(p.types)!==JSON.stringify(plan.params.types))throw new Error('STALE');}
   if(run==='sizeFit'){for(const key of ['targetWidth','targetHeight','axis','strategy'])if(p[key]!==plan.params[key])throw new Error('STALE');const allowed=new Set(plan.raw.items.filter((n:any)=>n.canRun).map((n:any)=>n.nodeId));if(!p.nodeIds?.length||p.nodeIds.some((id:string)=>!allowed.has(id)))throw new Error('STALE');}
   if(run==='textSplitMerge'){for(const key of Object.keys(plan.params))if(JSON.stringify(p[key])!==JSON.stringify(plan.params[key]))throw new Error('STALE');}
   if(run!=='cleanup')this.plans.delete(run);(this.host as any).checkpoint?.();if(run==='textFill')return tools.handleRunTextFill(ctx,p);if(run==='replace')return tools.handleRunFindReplace(ctx,p);if(run==='cleanup'){const result=await tools.handleRunCleanup(ctx,{...p,includeComponentInstanceChildren:false});const processed=new Set([...result.successNodeIds,...result.failedItems.map(n=>n.nodeId)]);plan.raw.items=plan.raw.items.filter((n:any)=>!processed.has(n.nodeId));const remaining=new Set(plan.raw.items.map((n:any)=>n.nodeId));plan.targets=plan.targets.filter(n=>remaining.has(n.id)&&!n.removed);plan.nodes=new Map(plan.targets.map(n=>[n.id,nodeWriteState(n)]));plan.selection=selectionState(this.host);return result;}if(run==='sizeFit')return tools.handleRunSizeFit(ctx,p);return handleRunTextSplitMerge(ctx,{...p,expectedSources:plan.raw.sources});
  }
  if(type==='SCAN_TRANSPARENT_CROP'){const nodes=nodesForScope(this.host,'selection');const items=nodes.filter(n=>Array.isArray(n.fills)&&n.fills.some((f:any)=>f.type==='IMAGE')).map(n=>({...snapshotNode(n),nodeId:n.id,mimeType:'image/png'}));return{items,skipped:nodes.length-items.length};}
  if(['GET_IMAGE_SOURCE','GET_TEXT_RECOGNITION_SOURCE','SCAN_IMAGE_SPLIT_SOURCE','GET_REMOVE_BG_SOURCE'].includes(type)){
    const source=await this.rpc<ImageSource>('READ_IMAGE',{nodeId:p.nodeId,maxBytes:type==='GET_IMAGE_SOURCE'?32*1024*1024:16*1024*1024},signal);const sourceToken=type==='GET_TEXT_RECOGNITION_SOURCE'?undefined:this.sources.register(source,type);return{...source,sourceToken,nodeName:source.name,imageBytes:source.bytes,originalBytes:source.bytes.length,sourceNodeId:source.nodeId,sourceName:source.name};
  }
  if(type==='GET_REMOVE_BG_RUNTIME_CONFIG'){const settings=await this.request('GET_SETTINGS');if(!settings.allowImageUpload)throw new Error('UPLOAD_DISABLED');return{removeBgApiKey:settings.removeBgApiKey};}
  if(type==='APPLY_IMAGE_SPLIT'){
    if(p.confirmed!==true||!Array.isArray(p.items)||!p.items.length)throw new Error('CONFIRM');
    const record=this.sources.get(p.source?.sourceToken,p.source?.nodeId,'SCAN_IMAGE_SPLIT_SOURCE');const source=record.source;
    if(source.fingerprint!==p.source.fingerprint||source.width!==p.source.width||source.height!==p.source.height)throw new Error('STALE');
    const key=JSON.stringify(p.items.map((item:any)=>[item.id,item.bounds,sourceFingerprint(new Uint8Array(item.imageBytes))]));
    const results=p.items.map((item:any)=>({name:item.name,bytes:item.imageBytes,width:item.bounds.width,height:item.bounds.height,offsetX:item.bounds.x,offsetY:item.bounds.y}));
    return this.sources.write(record,key,async()=>{const result=await this.rpc<any>('WRITE_IMAGES',{source,results,confirmed:true,keepSelection:true},signal);return{items:p.items.map((item:any,index:number)=>({id:item.id,nodeId:result.insertedIds[index]})),cancelled:false};});
  }
  if(type==='APPLY_TRANSPARENT_CROP'||type==='APPLY_REMOVE_BG'){
    if(p.mode==='replaceOriginal'&&p.confirmed!==true)throw new Error('CONFIRM');
    if(!['replaceOriginal','newLayer','keepOriginalAndInsert'].includes(p.mode))throw new Error('INVALID');
    const items=type==='APPLY_REMOVE_BG'?[{nodeId:p.sourceNodeId,sourceToken:p.sourceToken,resultImageBytes:p.resultImageBytes}]:p.items;
    let successCount=0,cancelled=false;const failures:any[]=[];
    for(const item of items){if(signal?.aborted){cancelled=true;break;}try{
      const record=this.sources.get(item.sourceToken,item.nodeId,type==='APPLY_REMOVE_BG'?'GET_REMOVE_BG_SOURCE':'GET_IMAGE_SOURCE');const source=record.source;
      const key=JSON.stringify([p.mode,item.bounds,sourceFingerprint(new Uint8Array(item.resultImageBytes))]);
      const meta=(await import('./shared/text-recognition')).inspectTextRecognitionImage(item.resultImageBytes);if(!meta)throw new Error('INVALID');
      const isCrop=type==='APPLY_TRANSPARENT_CROP';
      await this.sources.write(record,key,()=>this.rpc('WRITE_IMAGES',{source,results:[{name:source.name+'_result',bytes:Array.from(item.resultImageBytes),width:meta.width,height:meta.height,offsetX:isCrop?item.bounds?.left??0:0,offsetY:isCrop?item.bounds?.top??0:0,sourceWidth:isCrop?item.bounds?.width??meta.width:source.width,sourceHeight:isCrop?item.bounds?.height??meta.height:source.height}],replace:p.mode==='replaceOriginal',confirmed:true,keepSelection:true},signal));
      if(p.mode==='replaceOriginal')record.retired=true;successCount++;
    }catch(error){if(signal?.aborted){cancelled=true;break;}failures.push({nodeId:item.nodeId,message:imageWriteErrorMessage(error)});}}
    if(cancelled&&!successCount&&!failures.length)throw new Error('CANCELLED');
    return{successCount,failedCount:failures.length,skippedCount:0,failures,cancelled,recoverable:true,message:`完成 ${successCount} 项，失败 ${failures.length} 项`};
  }
  if(type==='RESIZE_UI'||type==='MINIMIZE_UI'||type==='UI_READY')return{width:p.width,height:p.height};
  throw new Error('INVALID');
 }
}
