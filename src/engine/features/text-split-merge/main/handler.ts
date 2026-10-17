// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type {
  PreviewTextSplitMergePayload,
  RunTextSplitMergePayload,
  TextSplitDirection,
  TextSplitMergePreviewResult,
  TextSplitMergeSource
} from '../../../shared/text-split-merge';
import { mergeSeparatorValue, resolveTextSplitDelimiters, splitTextByDelimiters } from '../../../shared/text-split-merge';
import type { ToolExecutionResult } from '../../../shared/types';
import type { HandlerContext, HostNode } from '../../../main/host-runtime';
import { hiddenReason, isEffectivelyLocked, isInsideInstance, loadNodeFont } from '../../../main/handlers/nodes';
import { throwIfTaskCancelled } from '../../../main/task';
import {guardNodes} from '../../../main/write-guard';
import {mutateWithRecovery} from '../../../main/mutation';

const MAX_TEXT_LENGTH = 5_000;
const MAX_MERGE_SOURCES = 100;
const MAX_SPLIT_OUTPUTS = 100;
const MAX_SOURCE_NODE_ID_LENGTH = 256;
const MAX_SOURCE_NAME_LENGTH = 256;
const ROW_TOLERANCE = 4;

type TextSplitMergePlan = {
  result: TextSplitMergePreviewResult;
  nodes: HostNode[];
  direction?: TextSplitDirection;
  gap?: number;
};

export function handlePreviewTextSplitMerge(
  context: HandlerContext,
  payload: PreviewTextSplitMergePayload
): TextSplitMergePreviewResult {
  throwIfTaskCancelled(context);
  return buildPlan(context.host.document.currentPage.selection ?? [], payload).result;
}

export async function handleRunTextSplitMerge(
  context: HandlerContext,
  payload: RunTextSplitMergePayload
): Promise<ToolExecutionResult> {
  if (!payload.confirmed) throw new Error('CONFIRM_REQUIRED');
  throwIfTaskCancelled(context);

  const selection = context.host.document.currentPage.selection ?? [];
  if (selection.length !== payload.expectedSources.length || !sameSources(selection.map(toSource), payload.expectedSources)) {
    throw new Error('TEXT_SPLIT_MERGE_STALE');
  }
  const plan = buildPlan(selection, payload);
  if (!plan.result.canRun) throw new Error('TEXT_SPLIT_MERGE_BLOCKED');
  if (!sameSources(plan.result.sources, payload.expectedSources)) throw new Error('TEXT_SPLIT_MERGE_STALE');

  if (payload.mode === 'merge') {
    return runMerge(context, plan);
  }
  return runSplit(context, plan);
}

function buildPlan(selection: HostNode[], payload: PreviewTextSplitMergePayload): TextSplitMergePlan {
  if (payload.mode === 'merge') return buildMergePlan(selection, payload);
  return buildSplitPlan(selection, payload);
}

function buildMergePlan(selection: HostNode[], payload: Extract<PreviewTextSplitMergePayload, { mode: 'merge' }>): TextSplitMergePlan {
  if (selection.length < 2) return blocked('merge', '请至少选择 2 个独立文本图层');
  if (selection.length > MAX_MERGE_SOURCES) return blocked('merge', `一次最多合并 ${MAX_MERGE_SOURCES} 个文本图层`);
  if (selection.some((node) => node.type !== 'TEXT')) return blocked('merge', '仅支持直接选择文本图层，不支持容器或其他图层');

  const nodes = [...selection].sort(compareReadingOrder);
  const commonReason = commonBlockReason(nodes);
  if (commonReason) return blocked('merge', commonReason);
  if (!sameParent(nodes)) return blocked('merge', '首版仅支持合并同一父级下的文本图层');
  if (nodes.slice(1).some((node) => !node.remove)) return blocked('merge', '当前 Figma 环境不支持安全删除来源文本');

  const sources = nodes.map(toSource);
  if (sources.some((source) => !hasValidSourceNodeId(source.nodeId))) {
    return blocked('merge', '当前文本缺少可用的节点标识，无法安全合并', sources);
  }
  if (sources.some((source) => !source.before)) return blocked('merge', '选区中包含空文本，无法安全合并', sources);
  const after = sources.map((source) => source.before).join(mergeSeparatorValue(payload.separator, payload.customSeparator));
  if (after.length > MAX_TEXT_LENGTH) return blocked('merge', `合并结果超过 ${MAX_TEXT_LENGTH} 个字符`, sources);

  return {
    nodes,
    result: {
      mode: 'merge',
      sources,
      items: [{ sourceNodeIds: sources.map((source) => source.nodeId), before: sources.map((source) => source.before).join(' / '), after, outputIndex: 1 }],
      outputCount: 1,
      canRun: true,
      message: `已生成预览：${sources.length} 个文本将合并为 1 个，并沿用“${sources[0].name}”的样式`
    }
  };
}

function buildSplitPlan(selection: HostNode[], payload: Extract<PreviewTextSplitMergePayload, { mode: 'split' }>): TextSplitMergePlan {
  if (selection.length !== 1 || selection[0]?.type !== 'TEXT') return blocked('split', '请只选择 1 个独立文本图层');
  const node = selection[0];
  const commonReason = commonBlockReason([node]);
  if (commonReason) return blocked('split', commonReason);
  if (typeof node.clone !== 'function') return blocked('split', '当前 Figma 环境不支持文本克隆，无法安全拆分');
  if (!hasStaticGeometry(node)) return blocked('split', '当前文本缺少可用的位置或尺寸信息，无法安全排列');

  const source = toSource(node);
  if (!hasValidSourceNodeId(source.nodeId)) return blocked('split', '当前文本缺少可用的节点标识，无法安全拆分', [source]);
  if (!source.before) return blocked('split', '不能拆分空文本', [source]);
  if (source.before.length > MAX_TEXT_LENGTH) return blocked('split', `文本超过 ${MAX_TEXT_LENGTH} 个字符`, [source]);
  const delimiterSet = resolveTextSplitDelimiters(payload.delimiters, payload.customDelimiters);
  const parts = splitTextByDelimiters(source.before, delimiterSet, payload.retainDelimiter, payload.trimWhitespace);
  if (parts.length < 2) return blocked('split', '未找到可拆分的有效文本片段', [source]);
  if (parts.length > MAX_SPLIT_OUTPUTS) return blocked('split', `拆分结果超过 ${MAX_SPLIT_OUTPUTS} 段`, [source]);

  return {
    nodes: [node],
    direction: payload.direction,
    gap: payload.gap,
    result: {
      mode: 'split',
      sources: [source],
      items: parts.map((after, index) => ({ sourceNodeIds: [source.nodeId], before: source.before, after, outputIndex: index + 1 })),
      outputCount: parts.length,
      canRun: true,
      message: `已生成预览：1 个文本将拆分为 ${parts.length} 个独立文本，并按${payload.direction === 'vertical' ? '纵向' : '横向'}排列`
    }
  };
}

async function runMerge(context: HandlerContext, plan: TextSplitMergePlan): Promise<ToolExecutionResult> {
  const [anchor, ...removals] = plan.nodes;
  const before = String(anchor.characters ?? '');
  const after = plan.result.items[0]?.after ?? '';
  const check = guardNodes(context, plan.nodes);
  check();
  await loadNodeFont(context.host, anchor);
  check();
  let deleted = 0;
  mutateWithRecovery(context.host, changed => {
    anchor.characters = after; changed();
    for (const node of removals) { node.remove!(); deleted++; changed(); }
  }, () => {
    // Without native rollback, never discard content from an already removed source.
    if (deleted) throw new Error('WRITE_STATE_UNKNOWN');
    anchor.characters = before;
  });
  try { context.host.document.currentPage.selection = [anchor]; context.host.viewport?.scrollAndZoomIntoView?.([anchor]); } catch { /* Committed receipt remains authoritative. */ }
  return executionResult(plan.nodes.length, `文本合并完成：${plan.nodes.length} 个文本已合并为 1 个，可通过 Figma 撤销恢复`);
}

async function runSplit(context: HandlerContext, plan: TextSplitMergePlan): Promise<ToolExecutionResult> {
  const source = plan.nodes[0];
  const before = String(source.characters ?? '');
  const parts = plan.result.items.map((item) => item.after);
  const created: HostNode[] = [];

  const check = guardNodes(context, plan.nodes);
  check();
  await loadNodeFont(context.host, source);
  check();
  mutateWithRecovery(context.host, changed => {
    for (const part of parts.slice(1)) {
      const clone = source.clone?.();
      if (!clone) throw new Error('CLONE_FAILED');
      created.push(clone);
      changed();
      clone.characters = part;
    }
    source.characters = parts[0] ?? '';
    changed();
    positionSplitNodes([source, ...created], plan.direction ?? 'vertical', plan.gap ?? 8);
  }, () => {
    source.characters = before;
    for (const node of created) node.remove!();
  });
  const resultNodes = [source, ...created];
  try { context.host.document.currentPage.selection = resultNodes; context.host.viewport?.scrollAndZoomIntoView?.(resultNodes); } catch { /* Committed receipt remains authoritative. */ }
  return executionResult(parts.length, `文本拆分完成：已生成 ${parts.length} 个独立文本，可通过 Figma 撤销恢复`);
}

function positionSplitNodes(nodes: HostNode[], direction: TextSplitDirection, gap: number) {
  const startX = numeric(nodes[0]?.x) ?? 0;
  const startY = numeric(nodes[0]?.y) ?? 0;
  let cursorX = startX;
  let cursorY = startY;
  for (const node of nodes) {
    node.x = cursorX;
    node.y = cursorY;
    if (direction === 'vertical') {
      cursorY += (numeric(node.height) ?? numeric(nodes[0]?.height) ?? 0) + gap;
    } else {
      cursorX += (numeric(node.width) ?? numeric(nodes[0]?.width) ?? 0) + gap;
    }
  }
}

function commonBlockReason(nodes: HostNode[]): string | undefined {
  for (const node of nodes) {
    if (isEffectivelyLocked(node)) return `“${node.name}”或其父级已锁定`;
    if (hiddenReason(node)) return `“${node.name}”处于隐藏状态`;
    if (isInsideInstance(node)) return `“${node.name}”位于组件实例内部`;
    if (isMixedText(node)) return `“${node.name}”含有混合文字样式，首版不支持处理`;
    if (node.parent?.layoutMode && node.parent.layoutMode !== 'NONE') return `“${node.name}”位于自动布局父级，首版暂不支持处理`;
  }
  return undefined;
}

function isMixedText(node: HostNode): boolean {
  return node.fontName === 'mixed' || (Array.isArray(node.textStyles) && node.textStyles.length > 1);
}

function sameParent(nodes: HostNode[]): boolean {
  const parentId = nodes[0]?.parent?.id;
  return Boolean(parentId) && nodes.every((node) => node.parent?.id === parentId);
}

function hasStaticGeometry(node: HostNode): boolean {
  return [node.x, node.y, node.width, node.height].every((value) => numeric(value) !== undefined);
}

function compareReadingOrder(left: HostNode, right: HostNode): number {
  const leftPosition = absolutePosition(left);
  const rightPosition = absolutePosition(right);
  if (Math.abs(leftPosition.y - rightPosition.y) <= ROW_TOLERANCE) return leftPosition.x - rightPosition.x;
  return leftPosition.y - rightPosition.y;
}

function absolutePosition(node: HostNode): { x: number; y: number } {
  let current: HostNode | null | undefined = node;
  let x = 0;
  let y = 0;
  while (current && current.type !== 'PAGE') {
    x += numeric(current.x) ?? 0;
    y += numeric(current.y) ?? 0;
    current = current.parent;
  }
  return { x, y };
}

function toSource(node: HostNode): TextSplitMergeSource {
  return {
    nodeId: typeof node.id === 'string' ? node.id : '',
    name: typeof node.name === 'string' ? node.name.slice(0, MAX_SOURCE_NAME_LENGTH) : '',
    before: String(node.characters ?? '')
  };
}

function hasValidSourceNodeId(nodeId: string): boolean {
  return nodeId.length > 0 && nodeId.length <= MAX_SOURCE_NODE_ID_LENGTH;
}

function sameSources(actual: TextSplitMergeSource[], expected: TextSplitMergeSource[]): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((source) => expected.some((candidate) => candidate.nodeId === source.nodeId && candidate.before === source.before));
}

function blocked(mode: 'merge' | 'split', reason: string, sources: TextSplitMergeSource[] = []): TextSplitMergePlan {
  return {
    nodes: [],
    result: { mode, sources, items: [], outputCount: 0, canRun: false, message: reason, blockedReason: reason }
  };
}

function executionResult(successCount: number, message: string): ToolExecutionResult {
  return { successCount, failedCount: 0, message, recoverable: true };
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
