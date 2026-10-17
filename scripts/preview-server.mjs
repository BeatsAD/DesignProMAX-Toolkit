import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.FIGMA_PREVIEW_PORT||5186);
http.createServer(async(req,res)=>{
 try{const path=new URL(req.url,'http://localhost').pathname;const name=path==='/'?'workbench.html':path==='/plugin-preview'?'preview.html':path==='/ocr-payload.json'?'ocr-payload.json':path==='/resources/home-banner.json'?'home-banner.json':null;if(!name){res.writeHead(404);res.end();return;}
 const data=await readFile(root+name);res.writeHead(200,{'Content-Type':name.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(500);res.end('Build unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`DesignProMAX Toolkit browser test: http://127.0.0.1:${port}`));
