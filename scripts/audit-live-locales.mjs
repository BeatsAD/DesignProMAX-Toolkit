import fs from 'node:fs';import ts from 'typescript';import{loadModule}from'../tests/load-module.mjs';
export function collectProductionStrings(html){
 const script=/<script>([\s\S]*?)<\/script>/.exec(html)?.[1];if(!script)throw new Error('Missing production UI script');
 const sf=ts.createSourceFile('bundle.js',script,99,true,ts.ScriptKind.JS),strings=new Set();
 function visit(node){if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&/[\u3400-\u9fff]/.test(node.text)){
   // Only dictionaries are multiline pipe-delimited literals. Do not exempt UI
   // paragraphs or input examples simply because they contain a newline or pipe.
   if(!(node.text.includes('\n')&&node.text.split('\n').filter(Boolean).every(row=>row.split('|').length===8)))strings.add(node.text.trim());
  }ts.forEachChild(node,visit);
 }visit(sf);return[...strings];
}
export async function auditProductionLocales(){
 globalThis.window??={addEventListener(){},parent:{}};globalThis.document??={documentElement:{}};
 const{hasUiTranslation,translateUi,setLocale,UI_TRANSLATION_ROWS}=await loadModule('src/reference/i18n.tsx');setLocale('en');
 const exemptions=JSON.parse(fs.readFileSync('docs/locale-data-exemptions.json','utf8')),data=new Set(Object.values(exemptions).flatMap(group=>group.values));
 const strings=collectProductionStrings(fs.readFileSync('dist/ui.html','utf8'));
 const dictionaryValues=new Set(UI_TRANSLATION_ROWS.flatMap(([,row])=>row));
 const missing=strings.filter(s=>!data.has(s)&&!(dictionaryValues.has(s)&&!hasUiTranslation(s))&&(!hasUiTranslation(s)||/[\u3400-\u9fff]/.test(translateUi(s))));
 const report={version:JSON.parse(fs.readFileSync('package.json','utf8')).version,dictionaryRows:UI_TRANSLATION_ROWS.length,productionStrings:strings.length,dataExemptions:strings.filter(s=>data.has(s)),missing};
 fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/locale-coverage.json',JSON.stringify(report,null,2));return report;
}
if(process.argv[1]?.endsWith('/audit-live-locales.mjs')){const report=await auditProductionLocales();console.log(`Locale coverage: ${report.dictionaryRows} rows, ${report.productionStrings} production strings, ${report.dataExemptions.length} data exemptions, ${report.missing.length} missing UI strings`);if(report.missing.length){console.error(report.missing);process.exitCode=1;}}
