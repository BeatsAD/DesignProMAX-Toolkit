import { decodeSplitSource,generateSplitOutputs,type SplitOutput } from './split';
import { detectSplitRegions,type SplitRegion } from '../engine/shared/image-split';
import { calculateTransparentCropBounds } from '../engine/shared/transparent-crop';
import type { ImageSource,ImageResult,Settings } from '../shared/workspace';
import { createEmbeddedOcrRuntime,validateOcrEmbeddedPayload } from './ocr-assets';
import { rpc } from '../ui/bridge';
import { sha256Utf8 } from '../ui/sha256';
import { runOcrWorker,runOcrWorkerData } from './ocr-client';
declare const __BROWSER_PREVIEW__:boolean;

export type Output=ImageResult&{url:string;id:string};
export async function processImage(source:ImageSource,tool:string,p:any,signal:AbortSignal):Promise<{outputs:Output[];regions:SplitRegion[]}>{
  const decoded=await decodeSplitSource({nodeId:source.nodeId,nodeName:source.name,width:source.width,height:source.height,imageBytes:source.bytes,mimeType:source.mimeType,fingerprint:source.fingerprint},signal);
  try{
    let regions:SplitRegion[];
    if(tool==='transparentCrop'){
      if(source.mimeType!=='image/png')throw new Error('SELECT_IMAGE');
      const pixels=decoded.canvas.getContext('2d')!.getImageData(0,0,source.width,source.height);const box=calculateTransparentCropBounds(pixels.data,source.width,source.height);if(!box)throw new Error('EMPTY');
      regions=[{id:'crop',x:box.left,y:box.top,width:box.width,height:box.height,confirmed:true}];
    }else regions=detectSplitRegions(decoded.pixels.data,decoded.pixels.width,decoded.pixels.height,source.width,source.height,p.mode,p.rows,p.columns).regions;
    if(!regions.length)throw new Error('EMPTY');
    const outputs=await generateSplitOutputs(decoded,regions,source.name,p.padding??0,signal);
    return{regions,outputs:outputs.map((o:SplitOutput)=>({id:o.id,name:o.name,bytes:Array.from(o.bytes),width:o.bounds.width,height:o.bounds.height,offsetX:o.bounds.x,offsetY:o.bounds.y,url:o.url}))};
  }finally{decoded.dispose();}
}
let payloadCache:unknown;
async function ocrPayload(signal:AbortSignal){
  if(payloadCache)return validateOcrEmbeddedPayload(payloadCache);
  if(__BROWSER_PREVIEW__){const response=await fetch('/ocr-payload.json',{signal});if(!response.ok)throw new Error('OCR');payloadCache=await response.json();}
  else {let text='',total=0,checksum='';do {const chunk=await rpc<{text:string;offset:number;total:number;checksum:string}>('GET_RESOURCE',{id:'ocr',offset:text.length},signal);if(chunk.offset!==text.length||chunk.total>25000000||chunk.total<=0||chunk.total<text.length+chunk.text.length||!chunk.text.length)throw new Error('OCR');if(total&&chunk.total!==total||checksum&&chunk.checksum!==checksum)throw new Error('OCR');total=chunk.total;checksum=chunk.checksum;text+=chunk.text;}while(text.length<total);
    const digest=await sha256Utf8(text,signal);if(digest!==checksum)throw new Error('OCR');payloadCache=JSON.parse(text);
  }
  return validateOcrEmbeddedPayload(payloadCache);
}
export async function recognizeDetailed(source:ImageSource,signal:AbortSignal,onProgress:(p:number)=>void){
  const data=await ocrPayload(signal);if(signal.aborted)throw new Error('CANCELLED');
  const runtime=createEmbeddedOcrRuntime(undefined,data);
  try{return await runOcrWorkerData(runtime,source.bytes,signal,onProgress);}finally{runtime.release();}
}
export async function recognize(source:ImageSource,signal:AbortSignal,onProgress:(p:number)=>void):Promise<string>{return(await recognizeDetailed(source,signal,onProgress)).text;}
export async function removeBackground(source:ImageSource,settings:Settings,signal:AbortSignal):Promise<Output>{
  if(!settings.allowUpload||!settings.apiKey)throw new Error('UPLOAD_DISABLED');
  const endpoint=settings.provider==='removebg'?'https://api.remove.bg/v1.0/removebg':`${settings.serviceUrl.replace(/\/$/,'')}/remove-background`;
  if(!/^https:\/\//.test(endpoint))throw new Error('INVALID_URL');
  const form=new FormData();form.append(settings.provider==='removebg'?'image_file':'image',new Blob([new Uint8Array(source.bytes)],{type:source.mimeType}),'selected-image.png');form.append('format','png');form.append('size','auto');
  const request=new AbortController();const cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)request.abort();const deadline=setTimeout(()=>request.abort(),45000);
  try{const response=await fetch(endpoint,{method:'POST',body:form,headers:settings.provider==='removebg'?{'X-Api-Key':settings.apiKey}:{Authorization:`Bearer ${settings.apiKey}`},signal:request.signal});
  if(!response.ok)throw new Error('EXTERNAL');const blob=await response.blob();if(blob.size>32*1024*1024)throw new Error('IMAGE_LIMIT');const bytes=Array.from(new Uint8Array(await blob.arrayBuffer()));
  const image=await createImageBitmap(blob);const output={id:'cutout',name:source.name+'_cutout',bytes,width:image.width,height:image.height,url:URL.createObjectURL(blob)};image.close();return output;}catch(error){if(request.signal.aborted)throw new Error(signal.aborted?'CANCELLED':'TIMEOUT');if(error instanceof TypeError)throw new Error('EXTERNAL');throw error;}finally{clearTimeout(deadline);signal.removeEventListener('abort',cancel);}
}
