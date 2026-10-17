// Figma text fill supports user-defined candidates only.
import type { PreviewTextFillPayload, TextFillRule } from './messages';
import type { PreviewResult, SelectionNodeSnapshot } from './types';

export function buildTextFillPreview(nodes: SelectionNodeSnapshot[], options: PreviewTextFillPayload): PreviewResult {
  if (!Array.isArray(options.rules) || options.rules.some(rule =>
    typeof rule?.fieldType !== 'string' || !/^custom:.+/.test(rule.fieldType)
    || rule.source !== 'custom' || !['sequence', 'random', 'cycle', 'fixed'].includes(rule.fillMode)
  )) throw new Error('INVALID');
  const textNodes = nodes.filter(node => node.type === 'TEXT' && node.visible !== false && node.locked !== true);
  const activeRules = options.rules.filter(rule => rule.enabled && normalizeCustomValues(rule.customValues).length > 0);
  const usage = new Map<TextFillRule, number>();
  const candidates = new Map<TextFillRule, string[]>();
  const items: PreviewResult['items'] = [];
  for (const node of textNodes) {
    const rule = activeRules.find(candidate => matches(node, candidate))
      ?? activeRules.find(candidate => candidate.fallback) ?? activeRules[0];
    if (!rule) continue;
    let values = candidates.get(rule);
    if (!values) {
      values = normalizeCustomValues(rule.customValues);
      if (rule.fillMode === 'random') shuffle(values);
      candidates.set(rule, values);
    }
    const index = usage.get(rule) ?? 0;
    usage.set(rule, index + 1);
    items.push({nodeId:node.id,name:node.name,before:node.text ?? '',
      after:values[rule.fillMode === 'fixed' ? 0 : index % values.length],
      fieldType:rule.fieldType,fieldLabel:rule.fieldLabel ?? rule.fieldType,
      source:'custom',fillMode:rule.fillMode,masked:false});
  }
  return {items,total:items.length,skipped:nodes.length-textNodes.length};
}

function matches(node: SelectionNodeSnapshot, rule: TextFillRule): boolean {
  const haystack = `${node.name} ${node.text ?? ''}`.toLowerCase();
  return [rule.fieldLabel,rule.fieldType,...(rule.keywords ?? [])]
    .some(keyword => typeof keyword === 'string' && !!keyword.trim() && haystack.includes(keyword.toLowerCase()));
}

function normalizeCustomValues(values: readonly string[] | undefined): string[] {
  return Array.isArray(values) ? values.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean) : [];
}

function shuffle(values: string[]): void {
  for (let index=values.length-1;index>0;index--) {
    const target=Math.floor(Math.random()*(index+1));
    [values[index],values[target]]=[values[target],values[index]];
  }
}
