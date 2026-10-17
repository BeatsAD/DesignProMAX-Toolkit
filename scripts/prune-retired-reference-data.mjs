import ts from 'typescript';import fs from 'node:fs';
if (!process.argv.includes('--historical-migration')) throw new Error('Historical migration only. Maintained navigation is edited directly; do not rerun this script.');
const retired=new Set(['ai','compress','locate','teamLibrary','iconLibrary','export','map']);
for(const[file,variable]of [['src/reference/ui/toolRegistry.ts','toolEntries'],['src/reference/ui/help/manualContent.ts','toolManuals'],['src/reference/ui/App.tsx','pageLabels']]){
 const text=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)===variable&&n.initializer&&ts.isObjectLiteralExpression(n.initializer)){for(const prop of n.initializer.properties){const name=prop.name?.getText(sf).replace(/['"]/g,'');if(retired.has(name)){let end=prop.end;if(text[end]===',')end++;edits.push([prop.getStart(sf),end,'']);}}if(n.type){edits.push([n.type.getStart(sf),n.type.end,'']);edits.push([n.name.end,n.type.getStart(sf),'']);edits.push([n.initializer.end,n.initializer.end,` as Record<${variable==='pageLabels'?'PageId, string':variable==='toolEntries'?'HomeToolPageId, ToolEntry':'HomeToolPageId, ToolManual'}>`]);}}ts.forEachChild(n,visit);}visit(sf);let out=text;for(const[a,b,value]of edits.sort((a,b)=>b[0]-a[0]))out=out.slice(0,a)+value+out.slice(b);fs.writeFileSync(file,out);
}

// This is a one-time migration aid; do not rerun over maintained reference UI files.
