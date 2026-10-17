import {rpc} from './bridge';
import {sha256Utf8} from './sha256';
declare const __BROWSER_PREVIEW__:boolean;
const cache=new Map<string,any>();
const flights=new Map<string,{promise:Promise<any>;controller:AbortController;users:number}>();
const cancelled=()=>new DOMException('Cancelled','AbortError');
export async function readResource(id:string,signal:AbortSignal):Promise<any>{
 if(!['home-banner'].includes(id))throw new Error('RESOURCE');
 if(signal.aborted)throw cancelled();if(cache.has(id))return cache.get(id);
 let flight=flights.get(id);
 if(!flight||flight.controller.signal.aborted){const controller=new AbortController();const next={controller,users:0,promise:Promise.resolve<any>(undefined)};next.promise=load(id,controller.signal).then(data=>{if(controller.signal.aborted)throw cancelled();validate(id,data);cache.set(id,data);return data;}).finally(()=>{if(flights.get(id)===next)flights.delete(id);});flight=next;flights.set(id,next);}
 const current=flight;current.users++;
 return new Promise((resolve,reject)=>{let done=false;const finish=(error?:unknown,value?:any)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);current.users--;if(!current.users)current.controller.abort();if(error)reject(error);else resolve(value);};const abort=()=>finish(cancelled());signal.addEventListener('abort',abort,{once:true});current.promise.then(value=>finish(undefined,value),error=>finish(error));if(signal.aborted)abort();});
}
async function load(id:string,signal:AbortSignal){
 if(__BROWSER_PREVIEW__){const response=await fetch(`/resources/${id}.json`,{signal});if(!response.ok)throw new Error('RESOURCE');return response.json();}
 let text='',total=0,checksum='';do{const part=await rpc<{text:string;offset:number;total:number;checksum:string}>('GET_RESOURCE',{id,offset:text.length},signal);if(part.offset!==text.length||part.total<=0||part.total>25000000||!part.text.length||part.text.length>131072||text.length+part.text.length>part.total||total&&part.total!==total||checksum&&part.checksum!==checksum)throw new Error('RESOURCE');total=part.total;checksum=part.checksum;text+=part.text;}while(text.length<total);
 const digest=await sha256Utf8(text,signal);if(digest!==checksum)throw new Error('RESOURCE');return JSON.parse(text);
}
function validate(id:string,data:any){if(id==='home-banner'){if(data?.version!==1||!['image/png','image/jpeg'].includes(data.mimeType)||typeof data.data!=='string'||data.data.length>2000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.data))throw new Error('RESOURCE');}}
