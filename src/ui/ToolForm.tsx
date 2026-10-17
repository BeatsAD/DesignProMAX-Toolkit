import { Field,NumberField,Select,Check,type T } from './Controls';
import type { Tool,Params } from '../shared/workspace';

export const defaults:Record<Tool,any>={
  textFill:{scope:'selection',name:'Custom',fillMode:'cycle',customValues:''},
  textSplitMerge:{mode:'split',delimiters:'、，。；',separator:'\n',retain:true,direction:'vertical',gap:8},
  replace:{mode:'text',scope:'selection',find:'',replace:'',sourceStyle:'',targetStyle:'',caseSensitive:false,includeHidden:false},
  cleanup:{scope:'currentPage',types:['hidden','emptyText','emptyGroup','transparent','zeroSize','outsideFrame']},
  sizeFit:{targetWidth:960,targetHeight:640,axis:'width',strategy:'smart'},statistics:{allPages:false,types:['image','group','text','rectangle']},
  imageSplit:{mode:'auto',rows:0,columns:0,padding:0},transparentCrop:{},textRecognition:{},cutout:{}
};
export function parameters(tool:Tool,p:any,ids:string[]):Params {
  if(tool==='textFill')return {scope:p.scope,rules:[{fieldType:'custom:manual',fieldLabel:p.name,keywords:[p.name],enabled:true,source:'custom',fillMode:p.fillMode,fallback:true,customValues:p.customValues.split(/[\n,，]/).map((value:string)=>value.trim()).filter(Boolean)}]};
  if(tool==='textSplitMerge')return p.mode==='split'?{mode:'split',delimiters:Array.from(p.delimiters),retainDelimiter:p.retain?'previous':'discard',trimWhitespace:true,direction:p.direction,gap:p.gap}:{mode:'merge',separator:'custom',customSeparator:p.separator};
  if(tool==='replace'){
    const style=(value:string)=>p.mode==='font'?{fontFamily:value,fontStyle:'Regular'}:p.mode==='fontSize'?{fontSize:Number(value)}:{color:value};
    return {mode:p.mode,scope:p.scope,target:p.mode==='text'?'text':'style',applyMode:p.mode==='text'?'wholeNode':'matchedRange',findText:p.mode==='text'?p.find:'',replaceText:p.mode==='text'?p.replace:'',matchMode:'contains',caseSensitive:p.caseSensitive,includeHiddenText:p.includeHidden,includeLockedText:false,...p.mode==='text'?{}:{styleFind:style(p.sourceStyle),styleReplace:style(p.targetStyle)}};
  }
  if(tool==='cleanup')return {scope:p.scope,types:p.types,includeLocked:false,includeComponentInstanceChildren:false};
  if(tool==='sizeFit')return {...p,nodeIds:ids};
  return p;
}
export function ToolForm({tool,p,set,t}:{tool:Tool;p:any;set:(patch:Params)=>void;t:T}){
  const input=(key:string,label:string,type='text')=><Field label={t(label)}><input type={type} value={p[key]} onChange={e=>set({[key]:e.target.value})}/></Field>;
  const num=(key:string,label:string,min=0,max=10000)=><NumberField label={t(label)} value={p[key]} min={min} max={max} onChange={v=>set({[key]:v})}/>;
  const select=(key:string,label:string,options:[string,string][])=><Select label={t(label)} value={String(p[key])} onChange={v=>set({[key]:v})} options={options} t={t}/>;
  const scope=select('scope','Scope',tool==='textFill'?[['selection','Selection'],['currentFrame','Current frame']]:[['selection','Selection'],['currentPage','Current page'],[tool==='replace'?'currentFile':'allPages','All pages']]);
  if(tool==='textFill')return <div className="form-grid">
    {scope}{input('name','Field')}
    {select('fillMode','Mode',[['sequence','Sequence'],['random','Random range'],['cycle','Cycle'],['fixed','Fixed']])}
    <div className="span-all"><Field label={t('Custom values, one per line')}><textarea rows={5} value={p.customValues} onChange={e=>set({customValues:e.target.value})}/></Field></div>
  </div>;
  if(tool==='textSplitMerge')return <div className="form-grid">{select('mode','Mode',[['split','Split'],['merge','Merge']])}{p.mode==='split'?<>{input('delimiters','Delimiters')}{select('direction','Axis',[['vertical','Vertical'],['horizontal','Horizontal']])}{num('gap','Gap')}<Check label={t('Keep punctuation')} checked={p.retain} onChange={retain=>set({retain})}/></>:<Field label={t('Separator')}><textarea rows={2} value={p.separator} onChange={e=>set({separator:e.target.value})}/></Field>}</div>;
  if(tool==='replace')return <div className="form-grid">{select('mode','Mode',[['text','Text'],['font','Font'],['fontSize','Font size'],['color','Color']])}{scope}{p.mode==='text'?<>{input('find','Find')}{input('replace','Replace with')}</>:<>{input('sourceStyle','Source value')}{input('targetStyle','Target value')}</>}<Check label={t('Case sensitive')} checked={p.caseSensitive} onChange={caseSensitive=>set({caseSensitive})}/><Check label={t('Include hidden text')} checked={p.includeHidden} onChange={includeHidden=>set({includeHidden})}/></div>;
  if(tool==='cleanup')return <><div className="form-grid">{scope}</div><div className="checks-grid">{[['hidden','Hidden layers'],['emptyText','Empty text'],['emptyGroup','Empty groups'],['transparent','Transparent layers'],['zeroSize','Zero-size layers'],['outsideFrame','Outside frames']].map(([id,label])=><Check key={id} label={t(label)} checked={p.types.includes(id)} onChange={v=>set({types:v?[...p.types,id]:p.types.filter((x:string)=>x!==id)})}/>)}</div></>;
  if(tool==='sizeFit')return <div className="form-grid">{num('targetWidth','Width',1,20000)}{num('targetHeight','Height',1,20000)}{select('axis','Axis',[['width','Width'],['height','Height'],['both','Both axes']])}{select('strategy','Strategy',[['smart','Smart structure'],['conservative','Explicit constraints']])}</div>;
  if(tool==='statistics')return <><Check label={t('All pages')} checked={p.allPages} onChange={allPages=>set({allPages})}/><p className="small muted">{t('Counts top-level frames and the selected object types.')}</p><div className="checks-grid">{[['image','Images'],['group','Groups'],['text','Text'],['rectangle','Rectangles']].map(([id,label])=><Check key={id} label={t(label)} checked={p.types.includes(id)} onChange={v=>set({types:v?[...p.types,id]:p.types.filter((x:string)=>x!==id)})}/>)}</div></>;
  if(tool==='imageSplit')return <div className="form-grid">{select('mode','Mode',[['auto','Automatic'],['cards','Cards'],['elements','Elements']])}{num('padding','Padding',0,100)}{num('rows','Rows',0,20)}{num('columns','Columns',0,20)}</div>;
  return null;
}
