import assert from 'node:assert/strict';import test from 'node:test';import{loadModule}from'./load-module.mjs';import {read} from './helpers.mjs';
globalThis.window={addEventListener:()=>{},parent:{}};globalThis.document={documentElement:{lang:'en'}};
const{translateUi,setLocale}=await loadModule('src/reference/i18n.tsx');
test('reference translations preserve template variables and text data across all eight languages',()=>{for(const locale of ['en','zh-CN','ja','ko','fr','de','es','pt']){setLocale(locale);const translated=translateUi('将填充 12 个文本图层。');assert.match(translated,/12/);if(locale!=='zh-CN')assert.notEqual(translated,'将填充 12 个文本图层。');assert.equal(translateUi('张三 / Client-supplied name'), '张三 / Client-supplied name');}setLocale('en');assert.equal(translateUi('文本填充完成：成功 3 个，失败 0 个'),'Text fill complete: 3 succeeded, 0 failed');assert.equal(translateUi('将按“客户原始分类”清理本批 2 个对象。'),'Clean 2 objects using “客户原始分类”.');});
test('reference template dictionaries have complete rows and identical placeholder sets',async()=>{const{TEMPLATE_ROWS}=await loadModule('src/reference/locale-templates.ts');for(const line of TEMPLATE_ROWS.trim().split('\n')){const row=line.split('|');assert.equal(row.length,8);const expected=[...row[0].matchAll(/%\d+/g)].map(m=>m[0]).sort();for(const value of row){assert.ok(value);assert.deepEqual([...value.matchAll(/%\d+/g)].map(m=>m[0]).sort(),expected);}}assert.match(read('scripts/reference-jsx.mjs'),/data-i18n-skip/);});
test('every reference dictionary row covers all languages and retains all template placeholders',async()=>{const{UI_TRANSLATION_ROWS}=await loadModule('src/reference/i18n.tsx');assert.ok(UI_TRANSLATION_ROWS.length>900);for(const[key,row]of UI_TRANSLATION_ROWS){assert.equal(row.length,8,key);const expected=[...key.matchAll(/%\d+/g)].map(m=>m[0]).sort();for(const value of row){assert.ok(value,key);assert.deepEqual([...value.matchAll(/%\d+/g)].map(m=>m[0]).sort(),expected,key);}}});
test('latest production UI contains no uncovered Chinese presentation strings',async()=>{const{auditProductionLocales}=await import('../scripts/audit-live-locales.mjs');const report=await auditProductionLocales();assert.deepEqual(report.missing,[]);assert.ok(report.productionStrings>0,'audit must inspect the current production UI');});
test('composed labels, date summaries and uncertain-region warnings localize without changing names',()=>{setLocale('en');assert.equal(translateUi('未就绪'),'Not ready');assert.equal(translateUi('当前未连接 Figma'),'Figma disconnected');assert.equal(translateUi('一键抠图，需配置'),'Remove Background, Setup required');assert.equal(translateUi('展开姓名配置'),'Expand Name settings');assert.equal(translateUi('打开文本填充'),'Open Fill Text');assert.doesNotMatch(translateUi('顺序 / 年月日时分'),/[\u3400-\u9fff]/);const risk=translateUi('图层“客户名称”缺少尺寸调整能力，已冻结该区域并继续处理其余安全内容。');assert.ok(risk.includes('客户名称'));assert.doesNotMatch(risk.replace('客户名称',''),/[\u3400-\u9fff]/);});

test('stopped batches and full OCR warnings keep counts and line lists in every language',()=>{
 for(const locale of ['en','zh-CN','ja','ko','fr','de','es','pt']){
  setLocale(locale);
  for(const count of [0,1,12]){
   const stopped=`操作已停止：成功 ${count} 项，失败 2 项；已完成的修改保留。`;
   const result=translateUi(stopped);
   assert.ok(result.includes(String(count)),locale);assert.ok(result.includes('2'),locale);
   assert.doesNotMatch(result,/%\d+/);
   if(locale!=='zh-CN')assert.notEqual(result,stopped,locale);
  }
  const warning=translateUi('第 1, 3 行识别置信度较低，请核对。');
  assert.ok(warning.includes('1, 3'),locale);
  if(locale!=='zh-CN')assert.notEqual(warning,'第 1, 3 行识别置信度较低，请核对。',locale);
  if(['en','fr','de','es','pt'].includes(locale))assert.doesNotMatch(warning,/[\u3400-\u9fff]/,locale);
 }
});
