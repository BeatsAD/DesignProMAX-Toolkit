import type {HandlerContext, HostNode, HostRuntime} from './host-runtime';
import {throwIfTaskCancelled} from './task';

export type SelectionState = {pageId: string; ids: string[]};
export function selectionState(host: HostRuntime): SelectionState {
  return {pageId: host.document.currentPage.id, ids: host.document.currentPage.selection.map(node => node.id)};
}
export function assertSelection(host: HostRuntime, expected: SelectionState, removed = new Set<string>()): void {
  const current = selectionState(host);
  if (current.pageId !== expected.pageId || JSON.stringify(current.ids) !== JSON.stringify(expected.ids.filter(id => !removed.has(id)))) throw new Error('STALE');
}

/** Snapshot values, never live node references. Called only for an explicit operation. */
export function nodeWriteState(node: HostNode): string {
  const ancestors = [];
  for (let parent = node.parent; parent; parent = parent.parent) ancestors.push([parent.id, parent.type, parent.locked, parent.isLocked, parent.layoutMode]);
  const values = (n: HostNode): unknown => [n.id, n.parent?.id, n.name, n.type, n.characters, n.fontName, n.fontSize, n.textStyles, n.fills, n.visible, n.isVisible, n.locked, n.isLocked, n.x, n.y, n.width, n.height, n.relativeTransform, n.constraints, n.layoutMode, n.children?.map(values)];
  return JSON.stringify([ancestors, values(node)]);
}

export function guardNodes(context: HandlerContext, nodes: HostNode[]): () => void {
  const expected = nodes.map(node => context.expectedNodes?.get(node.id) ?? nodeWriteState(node));
  const selection = context.expectedSelection ?? selectionState(context.host);
  return () => {
    throwIfTaskCancelled(context);
    try {
      assertSelection(context.host, selection);
      if (nodes.some((node, index) => node.removed || nodeWriteState(node) !== expected[index])) throw new Error('STALE');
    } catch { throw new Error('STALE'); }
  };
}

/** Layout can reposition untouched siblings synchronously after our own write.
 * Check every affected target first, then accept only that synchronous change.
 * No await is allowed between the check, mutation and new snapshots. */
export function withGuardedLayoutMutation<T>(context: HandlerContext, node: HostNode, run: () => T): T {
  let layoutRoot: HostNode | undefined;
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.layoutMode && parent.layoutMode !== 'NONE') layoutRoot = parent;
  if (!layoutRoot || !context.expectedTargets || !context.expectedNodes) return run();
  const inside = (target: HostNode) => { for (let current: HostNode | null | undefined = target; current; current = current.parent) if (current.id === layoutRoot!.id) return true; return false; };
  const affected = context.expectedTargets.filter(target => !target.removed && inside(target));
  guardNodes(context, affected)();
  try { return run(); }
  finally { for (const target of affected) if (!target.removed) context.expectedNodes.set(target.id, nodeWriteState(target)); }
}
