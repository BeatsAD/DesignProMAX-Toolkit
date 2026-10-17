// One-time read-only reference migration. This script never modifies its source project.
if (!process.argv.includes('--historical-migration')) throw new Error('Historical migration only. Do not rerun over the maintained reference UI. Normal builds use npm run build.');
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,extname} from 'node:path';
const sourceRoot=resolve('..','src'),targetRoot=resolve('src/reference');
const removed=['AiPage','BatchExportPage','ImageCompressPage','IconLibraryPage','LocatePage','TeamLibraryPage','VectorMapPage'];
const retired=['ai','compress','iconLibrary','locate','teamLibrary','export','map'];
const overrides=new Map();let app=readFileSync(resolve(sourceRoot,'ui/App.tsx'),'utf8');
app=app.split('\n').filter(line=>!removed.some(name=>line.startsWith('import '+name+' '))).join('\n');
for(const id of retired)app=app.replace(new RegExp("    case '"+id+"':\\n      return [^\\n]+;\\n",'g'),'');
overrides.set('ui/App.tsx',app);
let registry=readFileSync(resolve(sourceRoot,'ui/toolRegistry.ts'),'utf8').replace("scale: { page: 'scale', label: '比例缩放', desc: '按比例缩放选区与内部元素'","scale: { page: 'scale', label: '尺寸适配', desc: '调整容器尺寸并保留布局结构'");
registry=registry.replace(/\n\];\s*$/, '\n].map(group=>({...group,items:group.items.filter(item=>item.page===\'home\'||isToolVisible(item.page as HomeToolPageId))})).filter(group=>group.items.length);\n');overrides.set('ui/toolRegistry.ts',registry);
overrides.set('shared/release-features.ts',`export const HIDDEN_TOOL_PAGE_IDS=${JSON.stringify(retired)} as const;\n`);
let settings=readFileSync(resolve(sourceRoot,'features/settings/ui/SettingsPage.tsx'),'utf8');settings=settings.replace(/import \{ useBundledImage \}[^\n]+\n/,'').replace(/  const \{ src: feedbackWechatQr[^\n]+\n/,'').replace(/  const \[feedbackQrFailed[^\n]+\n/,'').replace(/  useEffect\(\(\) => \{ if \(feedbackQrLoadFailed\)[^\n]+\n/,'');
const qrStart=settings.indexOf('                <div className={`feedback-qr-slot');const qrEnd=settings.indexOf('\n              </section>',qrStart);if(qrStart>=0)settings=settings.slice(0,qrStart)+settings.slice(qrEnd);
settings=settings.replace('href="https://github.com/BeatsAD/DesignProMAX"','href={LINKS.repository}');settings=settings.replace('<div className="version-source-row">','{LINKS.repository ? <div className="version-source-row">').replace('                </a>\n              </div>','                </a>\n              </div> : null}');
settings="import { LINKS } from '../../../../shared/links';\n"+settings;
overrides.set('features/settings/ui/SettingsPage.tsx',settings);
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
function pruneJsx(path,text){
 if(!['features/scale/ui/ScalePage.tsx','features/settings/ui/SettingsPage.tsx'].includes(path))return text;
 const sf=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const transform=ctx=>root=>{const visit=node=>{
   if(path.includes('ScalePage')){
    if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(sf)==='SegmentedControl'&&node.getText(sf).includes('缩放功能'))return ctx.factory.createJsxExpression(undefined,ctx.factory.createNull());
    if(ts.isConditionalExpression(node)&&node.condition.getText(sf)==="activeTab === 'fitSize'")return ts.visitNode(node.whenTrue,visit);
    if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>['[activeTab, setActiveTab]','[mode, setMode]','[value, setValue]','[previewSnapshot, setPreviewSnapshot]','[selectedPreviewNodeIds, setSelectedPreviewNodeIds]','preview','previewStale','valueUnit','selectedPreviewItems','allPreviewItemsSelected','somePreviewItemsSelected'].includes(d.name.getText(sf))))return undefined;
    if(ts.isFunctionDeclaration(node)&&['makePreview','run','clearPreview','resetScaleParams'].includes(node.name?.text))return undefined;
   }
   if(path.includes('SettingsPage')&&ts.isConditionalExpression(node)&&["view === 'ai'","view === 'compress'"].includes(node.condition.getText(sf)))return ctx.factory.createNull();
   return ts.visitEachChild(node,visit,ctx);
 };return ts.visitNode(root,visit);};
 return printer.printFile(ts.transform(sf,[transform]).transformed[0]);
}
const skip=new Set(['ui/hooks/usePluginBridge.ts','ui/resources/useBundledImage.ts','ui/text-recognition.ts']);
const seen=new Set();const pending=['ui/App.tsx','ui/styles.css'];
while(pending.length){const rel=pending.pop();if(seen.has(rel))continue;seen.add(rel);if(skip.has(rel))continue;
 const src=resolve(sourceRoot,rel),dest=resolve(targetRoot,rel);mkdirSync(dirname(dest),{recursive:true});
 if(!/\.(ts|tsx|css)$/.test(rel)){if(rel.includes('feedback-wechat-qr'))throw Error('QR must not migrate');writeFileSync(dest,readFileSync(src));continue;}
 let text=pruneJsx(rel,overrides.get(rel)??readFileSync(src,'utf8'));
 text=text.replaceAll('MasterGo','Figma').replaceAll('DesignProMAX 工具箱','DesignProMAX Toolkit');
 if(rel==='shared/constants.ts'){text=text.replace(/export const APP_VERSION = '[^']+';/,"export {APP_VERSION} from '../../shared/constants';");text=text.replace(/'designpromax\./g,"'figma.toolkit.reference.");}
 if(rel==='shared/text-fill-regions.ts')text=text.replace("'./vector-map.generated'","'./administrative-regions.generated'");
 if(rel==='shared/administrative-regions.generated.ts')continue;
 writeFileSync(dest,text);
 if(extname(rel)==='.css')continue;
 const sf=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const deps=[];function visit(n){if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n)){if(n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))deps.push(n.moduleSpecifier.text);}if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))deps.push(n.arguments[0].text);ts.forEachChild(n,visit);}visit(sf);
 for(let dep of deps){if(!dep.startsWith('.'))continue;dep=dep.split('?')[0];if(dep.endsWith('administrative-regions.generated'))continue;const base=resolve(dirname(src),dep);if(!base.startsWith(sourceRoot))continue;const found=[base,base+'.ts',base+'.tsx',resolve(base,'index.ts')].find(p=>existsSync(p)&&extname(p));if(!found)throw Error('Unresolved '+rel+' '+dep);const next=relative(sourceRoot,found);if(next==='shared/vector-map.generated.ts')throw Error('Map catalog must not migrate');pending.push(next);}
}
// Only administrative names needed by the existing text-fill dropdowns, no map geometry/catalog.
const mapSource=readFileSync(resolve(sourceRoot,'shared/vector-map.generated.ts'),'utf8');const sf=ts.createSourceFile('map.ts',mapSource,ts.ScriptTarget.Latest,true);let items=[];
for(const statement of sf.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.name.getText(sf)==='VECTOR_MAP_ITEMS')items=JSON.parse(d.initializer.getText(sf));
const names=items.map(({adcode,name,level,parentAdcode})=>({adcode,name,level,parentAdcode}));writeFileSync(resolve(targetRoot,'shared/administrative-regions.generated.ts'),`// Administrative text labels only; no geometry, bounds, paths or map UI.\nexport const VECTOR_MAP_ITEMS=${JSON.stringify(names)};\n`);
console.log('Migrated reference UI files:',seen.size,'administrative labels:',names.length);
