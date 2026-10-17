import type { EmbeddedOcrRuntime } from './ocr-assets';

type OcrWorker = Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;
// Own the Worker from creation, including initialization, so cancellation and failures
// always release it. The messages follow the pinned Tesseract.js 5.1.1 worker protocol.
export async function runOcrWorkerData(runtime:EmbeddedOcrRuntime,bytes:number[],signal:AbortSignal,onProgress:(progress:number)=>void,factory:(path:string)=>OcrWorker=path=>new Worker(path)):Promise<{text:string;confidence:number;lines:{text:string;confidence:number}[]}> {
  if(signal.aborted)throw new Error('CANCELLED');
  const worker=factory(runtime.workerPath);
  let serial=0;let stopped:Error|undefined;
  const pending=new Map<string,{resolve:(data:any)=>void;reject:(error:Error)=>void}>();
  const fail=(error:Error)=>{stopped=error;for(const call of pending.values())call.reject(error);pending.clear();};
  const abort=()=>fail(new Error('CANCELLED'));
  const deadline=setTimeout(()=>fail(new Error('TIMEOUT')),45000);
  signal.addEventListener('abort',abort,{once:true});
  worker.onerror=event=>{event.preventDefault?.();fail(new Error('OCR'));};
  worker.onmessageerror=()=>fail(new Error('OCR'));
  worker.onmessage=event=>{
    const message=event.data;if(!message||typeof message.jobId!=='string')return;
    const call=pending.get(message.jobId);if(!call)return;
    if(message.status==='progress'){onProgress(Math.max(0,Math.min(1,Number(message.data?.progress)||0)));return;}
    pending.delete(message.jobId);
    if(message.status==='resolve')call.resolve(message.data);else call.reject(new Error('OCR'));
  };
  const job=(action:string,payload:unknown)=>new Promise<any>((resolve,reject)=>{
    if(stopped){reject(stopped);return;}const jobId=`ocr_${++serial}`;pending.set(jobId,{resolve,reject});
    try{worker.postMessage({workerId:'figma-local-ocr',jobId,action,payload});}catch{pending.delete(jobId);reject(new Error('OCR'));}
  });
  try{
    await job('load',{options:{lstmOnly:true,corePath:runtime.corePath,logging:false}});
    await job('loadLanguage',{langs:'chi_sim+eng',options:{langPath:runtime.langPath,cacheMethod:'none',gzip:true,lstmOnly:true}});
    await job('initialize',{langs:'chi_sim+eng',oem:1,config:{}});
    const result=await job('recognize',{image:new Uint8Array(bytes),options:{},output:{text:true,blocks:true,hocr:false,tsv:false}});
    if(typeof result?.text!=='string')throw new Error('OCR');
    const confidence=typeof result.confidence==='number'?result.confidence:0;
    const lines=(result.blocks??[]).flatMap((block:any)=>(block.paragraphs??[]).flatMap((paragraph:any)=>(paragraph.lines??[]).map((line:any)=>({text:String(line.text??''),confidence:Number(line.confidence??confidence)}))));
    return{text:result.text,confidence,lines};
  }finally{
    clearTimeout(deadline);signal.removeEventListener('abort',abort);
    worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();pending.clear();
  }
}

export async function runOcrWorker(...args:Parameters<typeof runOcrWorkerData>):Promise<string>{return(await runOcrWorkerData(...args)).text;}
