import {isThemePreference} from '../shared/theme';
import { ReferenceController } from './reference-controller';
import { resolveNodeById, nodesForScope } from './main/handlers/nodes';
import type { HostRuntime, HostNode, HandlerContext } from './main/host-runtime';
import * as tools from './main/handlers/local-tools';
import { handlePreviewTextSplitMerge,handleRunTextSplitMerge } from './features/text-split-merge/main/handler';
import { handleScanDesignStats } from './main/handlers/design-stats';
import { sourceFingerprint } from './shared/image-split';
import { inspectTextRecognitionImage } from './shared/text-recognition';
import { DEFAULT_SETTINGS,type Settings,type Workspace,type Layer,type Preview,type Tool,type Params,type ImageSource,type ImageResult,type CancelSignal } from '../shared/workspace';
import { APP_VERSION } from '../shared/constants';
import {placementFingerprint} from './images/placement';
import {guardNodes, selectionState, nodeWriteState} from './main/write-guard';
import {writeImages} from './images/write';

export class Controller {
  private reference?:ReferenceController;
  private plan?: { token:string; tool:Tool; params:Params; raw:any; targets:HostNode[]; nodes:Map<string,string>; selection:ReturnType<typeof selectionState> };
  constructor(readonly host:HostRuntime,readonly preview=false,readonly loadPages:(pageIds?:readonly string[])=>Promise<void>=async()=>{}){}
  private all(root:HostNode=this.host.document.currentPage):HostNode[]{return [root,...(root.children??[]).flatMap(n=>this.all(n))];}
  private context(signal?:CancelSignal):HandlerContext{return {host:this.host,expectedSelection:selectionState(this.host),signal:signal?{get aborted(){return signal.aborted;},onCancel:(cb)=>{signal.addEventListener('abort',cb,{once:true});return()=>signal.removeEventListener('abort',cb);}}:undefined};}
  state():Workspace {
    const layers:Layer[]=[];
    const visit=(node:HostNode,depth:number)=>{if(node.type!=='PAGE')layers.push({id:node.id,name:node.name,type:node.type,width:node.width??0,height:node.height??0,x:node.x??0,y:node.y??0,visible:node.visible!==false,locked:node.locked===true,text:node.characters,parentId:node.parent?.id,depth});for(const child of node.children??[])visit(child,depth+1);};
    if(this.preview)visit(this.host.document.currentPage,-1);else for(const node of this.host.document.currentPage.selection){layers.push({id:node.id,name:node.name,type:node.type,width:node.width??0,height:node.height??0,x:node.x??0,y:node.y??0,visible:node.visible!==false,locked:node.locked===true,text:node.characters,depth:0});}
    for(const layer of layers){if(!this.preview)continue;const node=this.all().find(n=>n.id===layer.id);const fill=Array.isArray(node?.fills)?node.fills.find((f:any)=>f.type==='IMAGE') as any:undefined;if(fill)layer.image=(this.host as any).imageUrl?.(fill.imageHash??fill.imageRef);}
    return {layers,selection:this.host.document.currentPage.selection.map(n=>n.id),pages:(this.host.document.children??[this.host.document.currentPage]).map(p=>({id:p.id,name:p.name})),pageId:this.host.document.currentPage.id,version:APP_VERSION,preview:this.preview};
  }
  async request(command:string,p:Params={},signal?:CancelSignal):Promise<any>{
    if(signal?.aborted)throw new Error('CANCELLED');
    const ctx=this.context(signal);
    if(command==='REFERENCE'){this.reference??=new ReferenceController(this.host,this.request.bind(this),this.loadPages);return this.reference.request(String(p.type),p.payload??{},signal);}
    if(command==='STATE')return this.state();
    if(command==='SETTINGS_READ')return {...DEFAULT_SETTINGS,...await this.host.clientStorage.getAsync<Partial<Settings>>('figma.toolkit.settings.v1')};
    if(command==='SETTINGS_SAVE'){
      const old=await this.request('SETTINGS_READ');const next={...old,...p};
      if(next.locale&&!['en','zh-CN','ja','ko','fr','de','es','pt'].includes(next.locale))throw new Error('INVALID');
      if(!isThemePreference(next.theme)||!['removebg','custom'].includes(next.provider)||typeof next.allowUpload!=='boolean'||typeof next.apiKey!=='string'||next.apiKey.length>1024||typeof next.serviceUrl!=='string'||next.serviceUrl.length>2048||typeof next.customValues!=='string'||next.customValues.length>20000)throw new Error('INVALID');
      if(next.serviceUrl){if(!/^https:\/\/[^\s/@]+(?:[/:?#]|$)/.test(next.serviceUrl)||/^https:\/\/[^/]*@/.test(next.serviceUrl))throw new Error('INVALID_URL');}
      await this.host.clientStorage.setAsync('figma.toolkit.settings.v1',next);return next;
    }
    if(command==='PAGES_LOAD'){await this.loadPages();return this.state();}
    if(command==='FONTS')return tools.handleListAvailableFonts(ctx);
    if(command==='STYLES')return tools.handleScanFindReplaceStyles(ctx,p as never);
    if(command==='STATS'){if(p.allPages)await this.loadPages();return handleScanDesignStats(ctx,{includeMaterialTypes:(p.types??['image','group','text','rectangle']) as never,pageIds:p.allPages?(this.host.document.children??[]).map(n=>n.id):[this.host.document.currentPage.id]});}
    if(command==='PREVIEW'){
      const tool=p.tool as Tool;const params=p.params as Params;
      if(!params||typeof params!=='object')throw new Error('INVALID');
      if(params.scope==='allPages'||params.scope==='currentFile')await this.loadPages();
      let raw:any;
      if(tool==='textFill')raw=tools.handlePreviewTextFill(ctx,params as never);
      else if(tool==='textSplitMerge')raw=handlePreviewTextSplitMerge(ctx,params as never);
      else if(tool==='replace')raw=tools.handleFindReplacePreview(ctx,params as never);
      else if(tool==='cleanup')raw=tools.handleScanCleanup(ctx,params as never);
      else if(tool==='sizeFit')raw=await tools.handlePreviewSizeFit(ctx,params as never);
      else throw new Error('INVALID');
      const token=`plan_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ids=new Set<string>([...(raw.items??[]).map((n:any)=>n.nodeId),...(raw.sources??[]).map((n:any)=>n.nodeId)]);const targets=nodesForScope(this.host,String(params.scope??'selection')).filter(n=>ids.has(n.id));const nodes=new Map(targets.map(n=>[n.id,nodeWriteState(n)]));
      this.plan={token,tool,params,raw,targets,nodes,selection:selectionState(this.host)};
      const items=raw.items??raw.candidates??[];
      const rows=tool==='textSplitMerge'?[{id:'text-operation',name:(raw.sources??[]).map((n:any)=>n.name).join(', '),before:(raw.sources??[]).map((n:any)=>n.before).join('\n'),after:(raw.items??[]).map((n:any)=>n.after).join('\n'),runnable:raw.canRun===true}]:
        items.map((n:any)=>({id:n.nodeId??n.id,name:n.name??'',before:String(n.beforeText??n.before??(n.beforeWidth?`${n.beforeWidth} × ${n.beforeHeight}`:n.type??'')),after:String(n.afterText??n.after??(n.afterWidth?`${n.afterWidth} × ${n.afterHeight}`:'')),runnable:tool==='cleanup'?!n.locked&&!n.insideInstance:tool==='sizeFit'?n.canRun===true:n.canRun!==false&&n.status!=='skipped'&&n.status!=='failed',detail:tool==='sizeFit'?{moved:n.movedCount??0,resized:n.resizedCount??0,frozen:n.frozenCount??0}:undefined}));
      return {token,tool,rows,total:rows.length,blocked:rows.filter((n:any)=>!n.runnable).length} satisfies Preview;
    }
    if(command==='APPLY'){
      if(!Array.isArray(p.ids)||!p.ids.length)throw new Error('CONFIRM');
      const plan=this.plan;if(!plan||plan.token!==p.token||p.confirmed!==true)throw new Error('STALE');
      guardNodes({...ctx,expectedNodes:plan.nodes,expectedSelection:plan.selection},plan.targets)();
      this.plan=undefined;
      ctx.expectedNodes=new Map(plan.nodes);ctx.expectedTargets=plan.targets;ctx.expectedSelection=plan.selection;
      (this.host as any).checkpoint?.();
      let result:any;const selected=new Set(p.ids as string[]|undefined);
      const items=(plan.raw.items??plan.raw.candidates??[]).filter((n:any)=>selected.has(n.nodeId??n.id)&&n.canRun!==false);
      if(plan.tool==='textFill')result=await tools.handleRunTextFill(ctx,{items,confirmed:true});
      else if(plan.tool==='replace')result=await tools.handleRunFindReplace(ctx,{items,confirmed:true});
      else if(plan.tool==='cleanup')result=await tools.handleRunCleanup(ctx,{nodeIds:items.filter((n:any)=>n.canDelete!==false).map((n:any)=>n.nodeId??n.id),types:plan.params.types as never,includeComponentInstanceChildren:false,confirmed:true});
      else if(plan.tool==='sizeFit')result=await tools.handleRunSizeFit(ctx,{...plan.params,confirmed:true} as never);
      else if(plan.tool==='textSplitMerge')result=await handleRunTextSplitMerge(ctx,{...plan.params,expectedSources:plan.raw.sources,confirmed:true} as never);
      return {success:result?.successCount??0,failed:result?.failedCount??0,cancelled:result?.cancelled??false,state:this.state()};
    }
    if(command==='READ_IMAGE'){
      const nodes=p.nodeId?nodesForScope(this.host,'selection').filter(n=>n.id===p.nodeId):this.host.document.currentPage.selection;if(nodes.length!==1)throw new Error('SELECT_IMAGE');const node=nodes[0];
      const fills=(Array.isArray(node.fills)?node.fills:[]) as any[];const imageFills=fills.filter(f=>f.type==='IMAGE'&&f.visible!==false&&f.isVisible!==false);if(imageFills.length!==1)throw new Error('SELECT_IMAGE');
      const fill=imageFills[0];const placement=placementFingerprint(node);const selection=selectionState(this.host);const bytes=await this.host.getImageByHref!(fill.imageHash??fill.imageRef).getBytesAsync();
      if(signal?.aborted)throw new Error('CANCELLED');
      if(node.removed||placementFingerprint(node)!==placement||JSON.stringify(selection)!==JSON.stringify(selectionState(this.host)))throw new Error('STALE');
      const metadata=inspectTextRecognitionImage(bytes);if(!metadata||bytes.length>Math.min(32*1024*1024,Number(p.maxBytes)||16*1024*1024)||metadata.pixels>12000000)throw new Error('IMAGE_LIMIT');
      return {nodeId:node.id,name:node.name,bytes:Array.from(bytes),fingerprint:sourceFingerprint(bytes),placementFingerprint:placementFingerprint(node),width:metadata.width,height:metadata.height,mimeType:metadata.mimeType} satisfies ImageSource;
    }
    if(command==='WRITE_IMAGES'){
      if(p.confirmed!==true)throw new Error('CONFIRM');
      const source=p.source as ImageSource;const current=await this.request('READ_IMAGE',{nodeId:source.nodeId,maxBytes:32*1024*1024},signal);
      if(current.nodeId!==source.nodeId||current.fingerprint!==source.fingerprint||source.placementFingerprint&&current.placementFingerprint!==source.placementFingerprint)throw new Error('STALE');
      const node=await resolveNodeById(this.host,source.nodeId);
      if(signal?.aborted)throw new Error('CANCELLED');
      if(!node||node.removed||placementFingerprint(node)!==current.placementFingerprint)throw new Error('STALE');
      const {inserted,keptFrame}=writeImages(this.host,node,source,p.results as ImageResult[],p.replace===true,signal);
      if(!p.keepSelection&&inserted.length)this.host.document.currentPage.selection=inserted;
      return {success:inserted.length,insertedIds:inserted.map(n=>n.id),keptFrame,state:this.state()};
    }
    throw new Error('INVALID');
  }
}
