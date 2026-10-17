import {useCallback,useEffect,useRef,type RefObject} from 'react';
import {compactContentHeight} from '../shared/window-size';

export function useCompactDockSizing({active,showLabels,sizeRef,busyRef,send}:{
  active:boolean;
  showLabels:boolean;
  sizeRef:RefObject<{width:number;height:number}>;
  busyRef:RefObject<string|undefined>;
  send:(type:'MINIMIZE_UI',payload:{minimized:boolean;width:number;height:number})=>void;
}) {
  const topbarRef=useRef<HTMLElement>(null);
  const toolbarRef=useRef<HTMLElement>(null);
  const getHeight=useCallback(()=>compactContentHeight(
    topbarRef.current?.offsetHeight || 48,
    toolbarRef.current?.offsetHeight || (showLabels ? 58 : 48)
  ),[showLabels]);

  useEffect(()=>{
    if(!active)return;
    let frame=0,lastSize='';
    const sync=()=>{
      frame=0;
      if(busyRef.current)return;
      const width=sizeRef.current.width,height=getHeight(),key=`${width}:${height}`;
      if(key===lastSize)return;
      lastSize=key;
      if(window.innerWidth!==width||window.innerHeight!==height)send('MINIMIZE_UI',{minimized:true,width,height});
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
    // Observe intrinsic rows, never the 100vh workspace (which would feed back
    // into its own window size). offsetHeight ignores entry animation transforms.
    const observer=new ResizeObserver(schedule);
    if(topbarRef.current)observer.observe(topbarRef.current);
    if(toolbarRef.current)observer.observe(toolbarRef.current);
    window.addEventListener('resize',schedule);
    document.fonts?.addEventListener('loadingdone',schedule);
    schedule();
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);document.fonts?.removeEventListener('loadingdone',schedule);};
  },[active,getHeight,busyRef,sizeRef,send]);

  return{topbarRef,toolbarRef,getHeight};
}
