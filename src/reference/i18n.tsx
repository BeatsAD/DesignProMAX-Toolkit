import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {LANGUAGES,CATALOG,type Locale} from '../ui/i18n/catalog';
import {UI_ALIASES} from './locale-aliases';
import {EXTRA_ROWS} from './locale-extra';
import {REFERENCE_ROWS} from './locale-rows';
import {TEMPLATE_ROWS} from './locale-templates';
import {COMPLETE_ROWS} from './locale-complete';
import {HELP_ROWS} from './locale-help';
import {SETTINGS_ROWS} from './locale-settings';
import {ERROR_ROWS,ERROR_CODE_KEYS} from './locale-errors';
import {DETAIL_ROWS} from './locale-details';
import {HELP_EXTRA_ROWS} from './locale-help-extra';
import {DYNAMIC_ROWS} from './locale-dynamic';
import {VALIDATION_ROWS} from './locale-validation';
import {MISC_ROWS,SPECIAL_ROWS,FIELD_ROWS,REPORT_ROWS} from './locale-misc';
import {RISK_ROWS,WEIGHT_ROWS} from './locale-risk';
import {CONSISTENCY_ROWS} from './locale-consistency';
import {PRECISE_ROWS} from './locale-precise';
import {rpc} from '../ui/bridge';
let locale:Locale='en';const listeners=new Set<()=>void>();
export function currentLocale(){return locale;}
export function setLocale(next:Locale){locale=next;document.documentElement.lang=next;listeners.forEach(fn=>fn());}
export function useLocale(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>locale);}
const english=new Map<string,string[]>();const reverse=new Map<string,string[]>();for(const values of Object.values(CATALOG)){reverse.set(values[1],values);english.set(values[0],values);}
for(const line of (REFERENCE_ROWS+EXTRA_ROWS+COMPLETE_ROWS+HELP_ROWS+SETTINGS_ROWS+ERROR_ROWS+DETAIL_ROWS+HELP_EXTRA_ROWS+DYNAMIC_ROWS+VALIDATION_ROWS+MISC_ROWS+FIELD_ROWS+REPORT_ROWS+RISK_ROWS+WEIGHT_ROWS+TEMPLATE_ROWS+PRECISE_ROWS+CONSISTENCY_ROWS).trim().split('\n').filter(Boolean)){const columns=line.split('|');if(columns.length!==8)throw new Error('Invalid locale row width: '+columns[0]);const [zh,en,ja,ko,fr,de,es,pt]=columns;if([zh,en,ja,ko,fr,de,es,pt].some(v=>!v))throw new Error('Invalid reference translation '+zh);const values=[en,zh,ja,ko,fr,de,es,pt];reverse.set(zh,values);english.set(en,values);}
for(const [key,values]of Object.entries(SPECIAL_ROWS)){reverse.set(key,values);english.set(values[0],values);}
export const UI_TRANSLATION_ROWS=[...reverse.entries()];
function makeTemplate([source,values]:[string,string[]]){
 const slots:number[]=[];let pos=0,pattern='^';const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const match of source.matchAll(/%(\d+)/g)){const numeric=/^%1 (?:个|项|张|条|位)/.test(source)&&match[1]==='1';pattern+=escape(source.slice(pos,match.index))+(numeric?'([0-9.,]+)':'([\\s\\S]+?)');slots.push(Number(match[1]));pos=match.index!+match[0].length;}
 pattern+=escape(source.slice(pos))+'$';return{source,regex:new RegExp(pattern),slots,values,staticLength:source.replace(/%\d+/g,'').length};
}
const templates=UI_TRANSLATION_ROWS.filter(([key])=>/%\d+/.test(key)).map(makeTemplate).sort((a,b)=>b.staticLength-a.staticLength);
const LOCALIZED_SLOTS:Record<string,number[]>={'打开%1':[1],'收起%1':[1],'展开%1配置':[1],'收起%1配置':[1],'%1条件':[1],'%1填充方式':[1],'%1脱敏方式':[1],'%1选择器':[1],'%1功能页面':[1],'默认姓名 / %1 / %2':[1,2],'默认数据 / %1%2':[1,2],'当前%1':[1],'替换%1':[1],'当前选中对象 / %1':[1],'当前选区未发现可替换的%1':[1],'将使用“%1”适配 %2 个根容器。':[1],'图层“%1”%2，已冻结该区域并继续处理其余安全内容。':[2]};
export function translateUi(value:unknown,depth=0):any{
 if(typeof value!=='string'||locale==='zh-CN'||depth>5)return value;
 const key=value.trim();if(!key)return value;
 if(ERROR_CODE_KEYS[key])return translateUi(ERROR_CODE_KEYS[key],depth+1);
 if(key.startsWith('NUMERIC_CONFIG_INVALID:'))return translateUi(key.slice('NUMERIC_CONFIG_INVALID:'.length),depth+1);
 if(/^(?:年|月|日|时|分|秒|星期){2,}$/.test(key))return (key.match(/星期|[年月日时分秒]/g)??[]).map(part=>translateUi(part,depth+1)).join(' / ');
 const index=LANGUAGES.findIndex(item=>item[0]===locale),row=reverse.get(key)??english.get(UI_ALIASES[key]);
 if(row)return value.slice(0,value.indexOf(key))+row[index]+value.slice(value.indexOf(key)+key.length);
 const parts=value.split(/(，|、|：| · | \/ )/);
 if(parts.length>1&&parts.every((part,i)=>i%2===1||!/[\u3400-\u9fff]/.test(part)||/^(?:年|月|日|时|分|秒|星期){2,}$/.test(part.trim())||reverse.has(part.trim())||english.has(UI_ALIASES[part.trim()])))return parts.map((part,i)=>i%2===1?(part==='，'||part==='、'?', ':part==='：'?': ':part):translateUi(part,depth+1)).join('');
 for(const template of templates){const match=template.regex.exec(value);if(match){const vars=new Map(template.slots.map((slot,i)=>[slot,LOCALIZED_SLOTS[template.source]?.includes(slot)?translateUi(match[i+1],depth+1):match[i+1]]));return template.values[index].replace(/%(\d+)/g,(_all,n)=>vars.get(Number(n))??'');}}
 return value;
}
export function LanguageBootstrap({children}:{children:ReactNode}){
 const[state,setState]=useState<'loading'|'choose'|'ready'|'readError'>('loading'),[first,setFirst]=useState<Locale>('en'),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(false);
 const dialog=useRef<HTMLElement>(null);
 async function load(){setState('loading');try{const saved=await rpc<any>('SETTINGS_READ');if(LANGUAGES.some(item=>item[0]===saved.locale)){setLocale(saved.locale);setState('ready');}else setState('choose');}catch{setState('readError');}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(state!=='choose')return;const root=dialog.current,previous=document.activeElement as HTMLElement|null;const controls=()=>Array.from(root?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);controls()[0]?.focus();const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const items=controls(),first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};root?.addEventListener('keydown',trap);return()=>{root?.removeEventListener('keydown',trap);previous?.focus();};},[state]);
 async function confirm(){setSaving(true);setSaveError(false);try{await rpc('SETTINGS_SAVE',{locale:first});setLocale(first);setState('ready');}catch{setSaveError(true);}finally{setSaving(false);}}
 if(state==='ready')return children;
 if(state==='loading')return <div className="language-loading" role="status">{translateUi('正在读取语言设置')}</div>;
 if(state==='readError')return <div className="language-loading"><p role="alert">{translateUi('设置读取失败，已保留原设置。请重新读取。')}</p><button className="btn primary" onClick={()=>void load()}>{translateUi('重新读取')}</button></div>;
 const row=LANGUAGES.findIndex(item=>item[0]===first);
 return <div className="modal-backdrop"><section ref={dialog} className="confirm-dialog language-start" role="dialog" aria-modal="true" aria-labelledby="initial-language-title" aria-busy={saving}><h2 id="initial-language-title">{CATALOG['Choose your language'][row]}</h2><div className="language-start-options">{LANGUAGES.map(([code,name])=><button className={'btn '+(code===first?'primary':'secondary')} disabled={saving} aria-pressed={code===first} key={code} onClick={()=>{setFirst(code);setLocale(code);}}>{name}</button>)}</div><div className="dialog-actions"><button className="btn primary" disabled={saving} onClick={()=>void confirm()}>{CATALOG.Continue[row]}</button></div>{saveError&&<p role="alert">{translateUi('语言保存失败，请重试；原语言设置已保留。')}</p>}</section></div>;
}

export function hasUiTranslation(key:string):boolean{key=key.trim();return reverse.has(key)||english.has(UI_ALIASES[key])||!!ERROR_CODE_KEYS[key]||templates.some(t=>t.regex.test(key))||(key.startsWith('NUMERIC_CONFIG_INVALID:')&&hasUiTranslation(key.slice('NUMERIC_CONFIG_INVALID:'.length)));}
