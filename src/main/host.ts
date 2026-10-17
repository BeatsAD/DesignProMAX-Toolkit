import type { HostNode,HostRuntime } from '../engine/main/host-runtime';

// Normalize only platform differences. Native methods still run against actual Figma nodes.
export function createHost(api:PluginAPI):HostRuntime {
  const cache=new WeakMap<object,HostNode>();const raw=new WeakMap<object,any>();
  const paints=(value:any)=>Array.isArray(value)?value.map(p=>{const n={...p};if(n.color&&'a'in n.color){n.opacity=n.opacity??n.color.a;const{a,...rgb}=n.color;n.color=rgb;}if(n.imageRef){n.imageHash=n.imageHash??n.imageRef;delete n.imageRef;}if('isVisible'in n){n.visible=n.isVisible;delete n.isVisible;}return n;}):value;
  function wrap(node:any):any {
    if(!node)return node;if(cache.has(node))return cache.get(node);
    const proxy=new Proxy(node,{
      get(target,key){
        if(key==='isVisible')return target.visible;if(key==='isLocked')return target.locked;
        if(key==='parent')return wrap(target.parent);
        if(key==='children'||key==='selection')return target[key]?.map(wrap);
        if(key==='fontName'&&target.fontName===api.mixed)return 'mixed';
        if(key==='constraints'&&target.constraints){const aliases:Record<string,string>={MIN:'START',MAX:'END',STRETCH:'STARTANDEND'};return {horizontal:aliases[target.constraints.horizontal]??target.constraints.horizontal,vertical:aliases[target.constraints.vertical]??target.constraints.vertical};}
        if(key==='getRangeFontName')return (start:number,end:number)=>{const font=target.getRangeFontName(start,end);return font===api.mixed?'mixed':font;};
        if(key==='textStyles'&&target.type==='TEXT')return target.getStyledTextSegments(['fontName','fontSize','fills']).map((s:any)=>({start:s.start,end:s.end,textStyle:{fontName:s.fontName,fontSize:s.fontSize},fills:s.fills}));
        if(key==='appendChild')return (child:HostNode)=>target.appendChild(raw.get(child)??child);
        if(key==='clone')return ()=>wrap(target.clone());
        if(key==='findAll')return ()=>target.findAll().map(wrap);
        if(key==='setRangeFills')return (s:number,e:number,v:any)=>target.setRangeFills(s,e,paints(v));
        const v=target[key];return typeof v==='function'?v.bind(target):v;
      },
      set(target,key,value){if(key==='selection')target.selection=value.map((n:any)=>raw.get(n)??n);else if(key==='fills')target.fills=paints(value);else if(key==='isVisible')target.visible=value;else if(key==='isLocked')target.locked=value;else target[key]=value;return true;}
    });cache.set(node,proxy);raw.set(proxy,node);return proxy;
  }
  return {document:{get currentPage(){return wrap(api.currentPage);},get children(){return api.root.children.map(wrap);},get name(){return api.root.name;}},clientStorage:api.clientStorage,
    getNodeByIdAsync:async id=>wrap(await api.getNodeByIdAsync(id))??undefined,
    beginUndoStep:()=>api.commitUndo(),rollbackUndoStep:()=>api.triggerUndo(),
    ui:{onmessage:null,postMessage:v=>api.ui.postMessage(v)},showUI:(html,options)=>api.showUI(html,options),commitUndo:()=>api.commitUndo(),
    getImageByHref:hash=>{const image=api.getImageByHash(hash);if(!image)throw new Error('SELECT_IMAGE');return image;},createImage:bytes=>api.createImage(bytes),createRectangle:()=>wrap(api.createRectangle()),createText:()=>wrap(api.createText()),loadFontAsync:font=>api.loadFontAsync(font as FontName),listAvailableFontsAsync:()=>api.listAvailableFontsAsync(),viewport:{get center(){return api.viewport.center;},scrollAndZoomIntoView:nodes=>api.viewport.scrollAndZoomIntoView(nodes.map(n=>raw.get(n)))}
  };
}
