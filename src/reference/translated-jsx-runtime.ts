import {jsx as reactJsx,jsxs as reactJsxs,Fragment} from 'react/jsx-runtime';
import {translateUi} from './i18n';
export {Fragment};
function translatedChildren(children:any):any{
 if(typeof children==='string')return translateUi(children);
 if(!Array.isArray(children))return children;
 if(children.every(child=>typeof child==='string'||typeof child==='number')){
  const joined=children.join(''),translated=translateUi(joined);
  if(translated!==joined)return translated;
 }
 return children.map(child=>typeof child==='string'?translateUi(child):child);
}
function propsFor(type:any,props:any){
 if(!props||props['data-i18n-skip'])return props;
 const next={...props},preserve=String(props['data-i18n-preserve']??'').split(',');
 for(const key of ['title','aria-label','ariaLabel','placeholder','alt','label','description','summary','detail','hint','body','confirmText'])if(!preserve.includes(key)&&typeof next[key]==='string')next[key]=translateUi(next[key]);
 next.children=translatedChildren(next.children);
 return next;
}
export const jsx=(type:any,props:any,key?:any)=>reactJsx(type,propsFor(type,props),key);
export const jsxs=(type:any,props:any,key?:any)=>reactJsxs(type,propsFor(type,props),key);
