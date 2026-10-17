import ts from 'typescript';
// Keep presentation localization separate from IDs, input values and document data.
export function prepareReferenceJsx(source,file){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),inserts=new Map();
 const protectedData=/\.(?:name|before|after|beforeText|afterText|characters|fullText|pageName|sourceName|nodeName|displayLabel|fontFamily|fontStyle)\b/;
 function add(pos,value){inserts.set(pos,(inserts.get(pos)??'')+value);}
 function visit(node){
  if(ts.isJsxElement(node)&&/^[a-z]/.test(node.openingElement.tagName.getText(ast))&&!node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='data-i18n-skip')&&node.children.some(child=>ts.isJsxExpression(child)&&protectedData.test(child.expression?.getText(ast)??'')))add(node.openingElement.tagName.end,' data-i18n-skip="true"');
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const preserve=node.attributes.properties.flatMap(attr=>{if(!ts.isJsxAttribute(attr)||!['title','alt','label'].includes(attr.name.getText(ast))||!attr.initializer||!ts.isJsxExpression(attr.initializer)||!attr.initializer.expression)return[];const exp=attr.initializer.expression;return ts.isPropertyAccessExpression(exp)&&protectedData.test(exp.getText(ast))?[attr.name.getText(ast)]:[];});
   if(preserve.length)add(node.tagName.end,` data-i18n-preserve="${preserve.join(',')}"`);
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);let output=source;for(const[pos,value]of [...inserts].sort((a,b)=>b[0]-a[0]))output=output.slice(0,pos)+value+output.slice(pos);
 return '/** @jsxImportSource @toolkit/i18n-jsx */\n'+output;
}
