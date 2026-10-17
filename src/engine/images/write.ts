import type {HostNode,HostRuntime} from '../main/host-runtime';
import type {CancelSignal,ImageSource,ImageResult} from '../../shared/workspace';
import {inspectTextRecognitionImage} from '../shared/text-recognition';
import {mutateWithRecovery} from '../main/mutation';
import {absolute,imageFill,planPlacement,relative,worldBounds,type Matrix} from './placement';

function setGeometry(node:HostNode,width:number,height:number,transform:Matrix){
  (node.resizeWithoutConstraints??node.resize)!.call(node,width,height);
  node.x=transform[0][2];node.y=transform[1][2];node.relativeTransform=transform;
}
export function writeImages(host:HostRuntime,node:HostNode,source:ImageSource,results:ImageResult[],replace:boolean,signal?:CancelSignal){
  if(!Array.isArray(results)||!results.length||results.length>50||results.some(n=>!Array.isArray(n?.bytes))||results.reduce((s,n)=>s+n.bytes.length,0)>48*1024*1024)throw new Error('IMAGE_LIMIT');
  if(replace&&results.length!==1)throw new Error('INVALID');
  if(replace)for(let n:HostNode|null|undefined=node;n;n=n.parent)if(n.locked||n.isLocked)throw new Error('LOCKED');
  const {fill,fills,index}=imageFill(node);
  // Preflight every image and coordinate before creating any image or layer.
  const plans=results.map(result=>{
    if(!Number.isFinite(result.offsetX??0)||!Number.isFinite(result.offsetY??0)||!Number.isFinite(result.sourceWidth??result.width)||!Number.isFinite(result.sourceHeight??result.height)||(result.sourceWidth??result.width)<=0||(result.sourceHeight??result.height)<=0)throw new Error('INVALID');
    if(result.bytes.some(n=>!Number.isInteger(n)||n<0||n>255))throw new Error('INVALID');
    const meta=inspectTextRecognitionImage(new Uint8Array(result.bytes));
    if(meta?.mimeType!=='image/png'||meta.width!==result.width||meta.height!==result.height||meta.pixels>12_000_000)throw new Error('INVALID');
    return{result,...planPlacement(node,source,result,replace)};
  });
  let anchor=node;while(anchor.parent&&anchor.parent.type!=='PAGE')anchor=anchor.parent;
  if(!(anchor.width!>0&&anchor.height!>0))anchor=node;
  const originalBounds=worldBounds(absolute(anchor),anchor.width!,anchor.height!);
  const outputBounds=plans.map(p=>worldBounds(p.transform,p.width,p.height));
  const minX=Math.min(...outputBounds.map(b=>b.x));
  let shiftX=replace?0:originalBounds.x+originalBounds.width+24-minX;
  if(!replace){
    const obstacles=(host.document.currentPage.children??[]).filter(n=>n.width!>0&&n.height!>0).map(n=>worldBounds(absolute(n),n.width!,n.height!));
    // Find free page space for this batch, including outputs of earlier items.
    // This runs only on write; it never scans document descendants or startup.
    for(let pass=0;pass<=obstacles.length;pass++){
      const hits=obstacles.filter(o=>outputBounds.some(b=>b.x+shiftX<o.x+o.width+1&&b.x+b.width+shiftX>o.x-1&&b.y<o.y+o.height+1&&b.y+b.height>o.y-1));
      if(!hits.length)break;
      shiftX=Math.max(...hits.map(o=>o.x+o.width))+24-minX;
    }
  }
  if(signal?.aborted)throw new Error('CANCELLED');
  const inserted:HostNode[]=[],created:HostNode[]=[];let keptFrame=false;
  const old=replace?{fills:node.fills,width:node.width!,height:node.height!,transform:relative(node)}:undefined;
  (host as any).checkpoint?.();
  try {
    return mutateWithRecovery(host,changed=>{
      for(const plan of plans){
        const image=host.createImage!(new Uint8Array(plan.result.bytes)) as {hash:string};
        const target=replace?node:host.createRectangle!();
        if(!replace){created.push(target);changed();host.document.currentPage.appendChild!(target);}
        const paint={...fill,type:'IMAGE',imageHash:image.hash,imageRef:image.hash,scaleMode:'CROP',imageTransform:plan.paintTransform};
        delete paint.rotation;delete paint.scalingFactor;
        target.fills=replace?fills.map((p:any,i:number)=>i===index?paint:p):[paint];changed();
        if(!plan.keepFrame){const transform:Matrix=plan.transform.map(row=>[...row]) as Matrix;transform[0][2]+=shiftX;setGeometry(target,plan.width,plan.height,transform);}
        if(!replace){target.name=plan.result.name;target.opacity=node.opacity??1;}
        keptFrame ||= plan.keepFrame;inserted.push(target);
      }
      return{inserted,keptFrame};
    },()=>{
      if(old){node.fills=old.fills;setGeometry(node,old.width,old.height,old.transform);}
      for(const target of created){if(!target.remove)throw new Error('WRITE_STATE_UNKNOWN');target.remove();}
    });
  } catch(error) {
    if(error instanceof Error&&error.message==='WRITE_STATE_UNKNOWN')throw error;
    throw new Error('IMAGE_WRITE_FAILED');
  }
}
