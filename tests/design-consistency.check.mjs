import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './load-module.mjs';

const {createTextFillConfigurationSignature: signature} = await loadModule('src/reference/features/text-fill/ui/text-fill-state.ts');
const {createPreviewSnapshot, isPreviewSnapshotStale} = await loadModule('src/reference/ui/preview-snapshot.ts');
const fields = [{id:'client',name:'客户状态',values:['Open','Done'],fillMode:'sequence'}];
const draft = {id:'client',name:'客户状态',customInput:'Open\nDone',fillMode:'sequence'};

test('opening, collapsing and reopening an unchanged field retains preview authorization', () => {
  const preview = createPreviewSnapshot({items:[{nodeId:'text:1'}]}, {}, 'selected', signature(fields, draft));
  for (const editor of [null, draft, {...draft, customInput:' Open，Done\n'}]) {
    assert.equal(isPreviewSnapshotStale(preview, 'selected', signature(fields, editor)), false);
  }
});

test('real field edits, persisted values and selection changes still invalidate previews', () => {
  const preview = createPreviewSnapshot({}, {}, 'selected', signature(fields, draft));
  for (const editor of [
    {...draft,customInput:'Done\nOpen'}, {...draft,name:'Other'}, {...draft,fillMode:'cycle'},
    {...draft,id:undefined,name:'New field'}
  ]) assert.equal(isPreviewSnapshotStale(preview, 'selected', signature(fields, editor)), true);
  assert.equal(isPreviewSnapshotStale(preview, 'different', signature(fields,null)), true);
  assert.equal(isPreviewSnapshotStale(preview, 'selected', signature([{...fields[0],values:['Changed']}],null)), true);
});

test('preview feedback translates the system phrase and keeps the user field name verbatim in eight languages', async () => {
  globalThis.window={addEventListener(){},parent:{}};
  globalThis.document={documentElement:{}};
  const {setLocale,translateUi} = await loadModule('src/reference/i18n.tsx');
  for (const locale of ['en','zh-CN','ja','ko','fr','de','es','pt']) {
    setLocale(locale);
    for (const phrase of ['已识别并生成“清空”3 条预览', '已生成预览：3 个文本将合并为 1 个，并沿用“清空”的样式', '合并结果将沿用阅读顺序首条文本“清空”的样式，并删除其余 3 个来源文本。']) {
      const result = translateUi(phrase);
      assert.ok(result.includes('清空'), locale);
      assert.ok(result.includes('3'), locale);
      if (locale !== 'zh-CN') assert.notEqual(result, phrase);
      if (['en','fr','de','es','pt'].includes(locale)) assert.doesNotMatch(result.replace('清空',''), /[\u3400-\u9fff]/);
    }
  }
});
