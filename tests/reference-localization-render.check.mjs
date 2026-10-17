import{mkdirSync,readFileSync}from'node:fs';import{pathToFileURL}from'node:url';
import test from 'node:test';import assert from 'node:assert/strict';import{build}from'esbuild';import{resolve}from'node:path';import{prepareReferenceJsx}from'../scripts/reference-jsx.mjs';import{root,read}from'./helpers.mjs';
globalThis.window={addEventListener(){},parent:{}};globalThis.document={documentElement:{}};
const fixture=`import{renderToStaticMarkup}from'react-dom/server';import{setLocale,translateUi}from'./src/reference/i18n';import{localizeStatisticsReport}from'./src/reference/statistics-localization';import{HomeBanner}from'./src/reference/ui/components/HomeBanner';import{NoticeBar}from'./src/reference/ui/components/ui';import{TextFillPreview}from'./src/reference/features/text-fill/ui/TextFillPreview';export{localizeStatisticsReport,setLocale};export function renderFillCards(locale){setLocale(locale);return renderToStaticMarkup(<TextFillPreview items={[{nodeId:'node',before:'免费设计工具箱',after:'清空',fieldLabel:'清空'}]} selectedIds={['node']} allSelected={true} someSelected={false} onToggleAll={()=>{}} onToggle={()=>{}} actionLabel={()=>'顺序'}/>);}export function renderMergeNote(locale){setLocale(locale);const source={name:'清空'};return renderToStaticMarkup(<NoticeBar state="info" text={'合并结果将沿用阅读顺序首条文本“'+source.name+'”的样式，并删除其余 2 个来源文本。'}/>);}export function renderBanner(locale){setLocale(locale);return renderToStaticMarkup(<HomeBanner/>);}export function render(locale){setLocale(locale);const user={name:'清空',before:'免费设计工具箱'};return renderToStaticMarkup(<section><h2>问题反馈</h2><span>{user.name}</span><img alt={user.name}/><input value={user.name} readOnly placeholder="请输入字段名称"/><p>已选择 {3} 个对象</p><p>{\`将填充 \${3} 个文本图层。\`}</p><div title={user.before}>{user.before}</div></section>);}`;
const moduleFile=resolve(root,'output/tests/reference-render.mjs');mkdirSync(resolve(root,'output/tests'),{recursive:true});
await build({outfile:moduleFile,packages:'external',absWorkingDir:root,stdin:{contents:prepareReferenceJsx(fixture,'fixture.tsx'),resolveDir:root,loader:'tsx'},plugins:[{name:'reference-jsx',setup(build){build.onLoad({filter:/src\/reference\/(?:ui|features)\/.*\.tsx$/},args=>({contents:prepareReferenceJsx(readFileSync(args.path,'utf8'),args.path),loader:'tsx'}));}}],bundle:true,write:true,format:'esm',platform:'node',jsx:'automatic',alias:{'@toolkit/i18n-jsx/jsx-runtime':resolve(root,'src/reference/translated-jsx-runtime.ts')},define:{__APP_VERSION__:JSON.stringify(JSON.parse(read('package.json')).version),__BROWSER_PREVIEW__:'true'}});
const fixtureModule=await import(pathToFileURL(moduleFile).href);
test('rendered controls translate while matching user strings, values and image names stay verbatim',()=>{const html=fixtureModule.render('en');assert.ok(html.includes('<h2>Feedback</h2>'));assert.ok(html.includes('value="清空"'));assert.ok(html.includes('alt="清空"'));assert.ok(html.includes('>清空</span>'));assert.ok(html.includes('title="免费设计工具箱"'));assert.ok(html.includes('>Selected 3 objects</p>'));assert.ok(html.includes('Fill 3 text layers'));assert.ok(html.includes('placeholder="Enter a field name"'));});
test('generated inventory reports use the selected language and preserve document and layer names',()=>{const report={text:'客户文件总计：1个页面，具体如下：\n1、客户页面，总计1个页面，分别是：清空。\n2、Archive，总计0个页面，分别是：暂无匹配页面。',pages:[{count:1},{count:0}]};for(const locale of ['en','ja','ko','fr','de','es','pt']){fixtureModule.setLocale(locale);const localized=fixtureModule.localizeStatisticsReport(report);for(const name of ['客户文件','客户页面','清空'])assert.ok(localized.includes(name));if(['en','fr','de','es','pt'].includes(locale))assert.doesNotMatch(localized.replace(/客户文件|客户页面|清空/g,''),/[\u3400-\u9fff]/);}assert.ok(report.text.includes('总计'));});

test('home banner renders localized HTML once while its decorative image is still loading',()=>{for(const [locale,title,action]of [['en','Free design toolkit','Feedback'],['zh-CN','免费设计工具箱','打开问题反馈']]){const html=fixtureModule.renderBanner(locale);assert.ok(html.includes(`<strong>${title}</strong>`));assert.ok(html.includes(`aria-label="${action}"`));assert.equal((html.match(/localized-banner-copy/g)??[]).length,1);assert.ok(html.includes('alt=""'));assert.doesNotMatch(html,/工具箱已正式发布|data:image/);}});


test('narrow fill cards render both sides and preserve client text and custom field names in every language',()=>{
 for(const locale of ['en','zh-CN','ja','ko','fr','de','es','pt']){
  const html=fixtureModule.renderFillCards(locale);
  assert.ok(html.includes('text-fill-preview-card'));
  assert.ok(html.includes('<dd data-i18n-skip="true">免费设计工具箱</dd>'));
  assert.ok(html.includes('<dd data-i18n-skip="true">清空</dd>'));
  assert.ok(html.includes('title="清空">清空</span>'));
  assert.equal((html.match(/<dt>/g)??[]).length,2);
 }
});


test('merge notices translate the full system sentence while preserving the source layer name',()=>{
 for(const locale of ['en','ja','ko','fr','de','es','pt']){
  const html=fixtureModule.renderMergeNote(locale);
  assert.ok(html.includes('清空'));
  assert.ok(!html.includes('合并结果将沿用阅读顺序首条文本'));
  if(['en','fr','de','es','pt'].includes(locale)) assert.doesNotMatch(html.replaceAll('清空',''),/[\u3400-\u9fff]/);
 }
});
