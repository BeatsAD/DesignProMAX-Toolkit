import {prepareReferenceJsx} from './reference-jsx.mjs';
import {syncDevelopmentPlugin} from './sync-development-plugin.mjs';
import { build } from 'esbuild';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,isAbsolute,relative,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const inlineImagePlugin={name:'inline-reference-images',setup(build){build.onResolve({filter:/\?inline$/},args=>({path:resolve(args.resolveDir,args.path.split('?')[0]),namespace:'inline-image'}));build.onLoad({filter:/.*/,namespace:'inline-image'},async args=>({contents:`export default ${JSON.stringify('data:image/png;base64,'+(await readFile(args.path)).toString('base64'))};`,loader:'js'}));build.onLoad({filter:/src\/reference\/(?:ui|features)\/.*\.tsx$/},async args=>({contents:prepareReferenceJsx(await readFile(args.path,'utf8'),args.path),loader:'tsx'}));build.onResolve({filter:/^@toolkit\/i18n-jsx\/jsx-runtime$/},()=>({path:resolve(root,'src/reference/translated-jsx-runtime.ts')}));}};
const common={absWorkingDir:root,bundle:true,write:false,metafile:true,minify:true,target:'es2020',format:'iife',platform:'browser',legalComments:'inline',jsx:'automatic',jsxImportSource:'react',plugins:[inlineImagePlugin],define:{__APP_VERSION__:JSON.stringify(pkg.version),'process.env.NODE_ENV':'"production"',__BROWSER_PREVIEW__:'false','import.meta.env.DEV':'false'}};
const main=await build({...common,entryPoints:['src/main/main.ts'],outfile:'dist/main.js'});
const ui=await build({...common,entryPoints:['src/ui/main.tsx'],outfile:'dist/ui.js'});
const workbench=await build({...common,entryPoints:['src/preview/workbench.tsx'],outfile:'dist/workbench.js'});
const preview=await build({...common,define:{...common.define,__BROWSER_PREVIEW__:'true'},entryPoints:['src/ui/main.tsx'],outfile:'dist/preview.js'});
for(const result of [main,ui,preview,workbench])for(const input of Object.keys(result.metafile.inputs)){const p=relative(root,resolve(root,input));if(p.startsWith('..')||isAbsolute(p))throw new Error(`External input: ${input}`);}
const template=(await readFile(resolve(root,'src/ui/index.html'),'utf8')).replace('DesignProMAX — Figma','DesignProMAX Toolkit');
function htmlFor(bundle,filename){const js=bundle.outputFiles.find(f=>f.path.endsWith('/'+filename+'.js'))?.text;const css=bundle.outputFiles.find(f=>f.path.endsWith('/'+filename+'.css'))?.text;if(!js||!css)throw new Error('Missing assets');return template.replace('<!-- INLINE_STYLE -->',()=>`<style>${css.replace(/<\/style/gi,'<\\/style')}</style>`).replace('<!-- INLINE_SCRIPT -->',()=>`<script>${js.replace(/<\/script/gi,'<\\/script')}</script>`);}
const assets={};for(const [name,path,mimeType,gzip]of [
 ['worker','node_modules/tesseract.js/dist/worker.min.js','application/javascript',true],
 ['core','node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js','application/javascript',true],
 ['eng','src/assets/ocr/eng.traineddata.gz','application/gzip',false],
 ['chiSim','src/assets/ocr/chi_sim.traineddata.gz','application/gzip',false]
]){const bytes=await readFile(resolve(root,path));assets[name]={encoding:gzip?'gzip-base64':'base64',mimeType,data:(gzip?gzipSync(bytes):bytes).toString('base64')};}
const payload=JSON.stringify({version:1,assets});const checksum=createHash('sha256').update(payload).digest('hex');
const initial=htmlFor(ui,'ui').replace('</head>',`<meta name="figma-resource-sha256" content="${checksum}"></head>`);
const extraResources={'home-banner':JSON.stringify({version:1,mimeType:'image/jpeg',data:(await readFile(resolve(root,'src/assets/home-banner-no-text.jpg'))).toString('base64')})};
let full=initial.replace('</body>',()=>`<script id="figma-ocr-payload" type="application/json">${payload}</script></body>`);
for(const[id,data]of Object.entries(extraResources)){const hash=createHash('sha256').update(data).digest('hex');full=full.replace('</head>',`<meta name="figma-resource-${id}-sha256" content="${hash}"></head>`).replace('</body>',()=>`<script id="figma-${id}-payload" type="application/json">${data}</script></body>`);}

const startupHtmlBytes=Buffer.byteLength(full.replace(/<script id="figma-(?:ocr|home-banner)-payload" type="application\/json">[\s\S]*?<\/script>/g,''),'utf8');if(startupHtmlBytes>=1572864)throw new Error(`Startup budget exceeded: ${startupHtmlBytes}`);
await mkdir(resolve(root,'dist'),{recursive:true});
for(const [name,data]of [['main.js',main.outputFiles[0].contents],['ui.html',full],['preview.html',htmlFor(preview,'preview')],['workbench.html',htmlFor(workbench,'workbench')],['ocr-payload.json',payload]])await writeFile(resolve(root,'dist',name),data);
for(const[id,data]of Object.entries(extraResources))await writeFile(resolve(root,'dist',id+'.json'),data);
const inputs=[...new Set([...Object.keys(main.metafile.inputs),...Object.keys(ui.metafile.inputs)])];
const info={platform:'figma',version:pkg.version,startupHtmlBytes,fullOfflineHtmlBytes:Buffer.byteLength(full,'utf8'),mainBytes:main.outputFiles[0].contents.byteLength,resourceBytes:Buffer.byteLength(payload,'utf8'),resourceChecksum:checksum,inputs,previewInputs:Object.keys(preview.metafile.inputs)};
await writeFile(resolve(root,'dist/build-info.json'),JSON.stringify(info,null,2)+'\n');
if(await syncDevelopmentPlugin(root))console.log('Registered development plugin synchronized with latest dist');
console.log(`Figma v${pkg.version}: startup ${startupHtmlBytes} bytes; offline HTML ${info.fullOfflineHtmlBytes} bytes; main ${info.mainBytes} bytes`);
