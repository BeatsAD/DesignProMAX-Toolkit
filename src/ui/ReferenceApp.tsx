import {useEffect} from 'react';
import App from '../reference/ui/App';
import {LanguageBootstrap,useLocale} from '../reference/i18n';
import {rpc} from './bridge';
import '../reference/ui/styles.css';
import './reference-additions.css';
import './figma-theme.css';
import './figma-typography.css';
import './design-consistency.css';
declare const __BROWSER_PREVIEW__:boolean;
function LiveApp(){const locale=useLocale();useEffect(()=>{if(__BROWSER_PREVIEW__)window.parent.postMessage({kind:'toolkit-preview-locale',locale},location.origin);},[locale]);useEffect(()=>{if(!__BROWSER_PREVIEW__)return;const publish=()=>void rpc('STATE').then(state=>window.parent.postMessage({kind:'toolkit-preview-state',state},location.origin));const handler=(event:MessageEvent)=>{if(event.source!==window.parent||event.origin!==location.origin||event.data?.kind!=='toolkit-preview-request')return;const{id,command,payload}=event.data;const allowed=['SELECT','SCENARIO','UNDO','UPLOAD','PAGE','STATE'];if(typeof id!=='string'||!allowed.includes(command))return;void rpc(command,payload).then(state=>{window.dispatchEvent(new Event('toolkit-preview-changed'));window.parent.postMessage({kind:'toolkit-preview-result',id,state},location.origin);}).catch(()=>window.parent.postMessage({kind:'toolkit-preview-result',id,error:'Preview operation failed'},location.origin));};window.addEventListener('message',handler);window.addEventListener('toolkit-preview-changed',publish);publish();return()=>{window.removeEventListener('message',handler);window.removeEventListener('toolkit-preview-changed',publish);};},[]);return <App key="reference-app"/>;}
export function ReferenceApp(){return <LanguageBootstrap><LiveApp/></LanguageBootstrap>;}
