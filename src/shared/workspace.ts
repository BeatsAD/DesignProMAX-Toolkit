import type {ThemePreference} from './theme';
export const TOOLS = ['cutout','transparentCrop','imageSplit','textFill','textRecognition','textSplitMerge','cleanup','replace','statistics','sizeFit'] as const;
export type Tool = typeof TOOLS[number];
export type Settings = { locale?: string; provider: 'removebg'|'custom'; apiKey: string; serviceUrl: string; allowUpload: boolean; theme: ThemePreference; customValues: string };
export const DEFAULT_SETTINGS: Settings = { provider:'removebg',apiKey:'',serviceUrl:'',allowUpload:false,theme:'system',customValues:'' };
export type Layer = { id:string; name:string; type:string; width:number; height:number; x:number; y:number; visible:boolean; locked:boolean; text?:string; parentId?:string; image?:string; depth:number };
export type Workspace = { selection:string[]; layers:Layer[]; pages:{id:string;name:string}[]; pageId:string; version:string; preview:boolean };
export type Row = { id:string; name:string; before:string; after:string; runnable:boolean; detail?:{moved:number;resized:number;frozen:number}; };
export type Preview = { token:string; rows:Row[]; total:number; blocked:number; tool:Tool };
export type ImageSource = { nodeId:string; name:string; bytes:number[]; fingerprint:string; placementFingerprint?:string; width:number; height:number; mimeType:string };
export type ImageResult = { name:string; bytes:number[]; width:number; height:number; offsetX?:number;offsetY?:number;sourceWidth?:number;sourceHeight?:number };
export type Params = Record<string,unknown>;
export function isWriteRequest(command: string, payload: Params = {}): boolean {
  return command === 'APPLY' || command === 'WRITE_IMAGES' || command === 'REFERENCE' && /^(RUN_|APPLY_)/.test(String(payload.type ?? ''));
}
export type CancelSignal = { readonly aborted:boolean; addEventListener:(type:'abort',listener:()=>void,options?:{once?:boolean})=>void; removeEventListener:(type:'abort',listener:()=>void)=>void };
export type Rpc = <T=unknown>(command:string,payload?:Params,signal?:CancelSignal)=>Promise<T>;
