// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { HandlerContext, HostNode, HostRuntime } from '../host-runtime';
import { hasChildren } from '../host-runtime';
import type { SelectionNodeSnapshot } from '../../shared/types';
import { inferImageMime } from '../../shared/image-compress';
import { throwIfTaskCancelled, withTaskTimeout } from '../task';

const FIGMA_NODE_PREVIEW_TIMEOUT_MS = 30_000;

export function snapshotNode(node: HostNode): SelectionNodeSnapshot {
  return snapshotNodeMetadata(node);
}

export async function snapshotNodeWithPreview(
  node: HostNode,
  host?: HostRuntime,
  context?: HandlerContext
): Promise<SelectionNodeSnapshot> {
  const snapshot = snapshotNodeMetadata(node);
  const previewImageBytes = await exportNodePreview(node, context);
  const imageMimeType = await detectImageMimeType(node, host);
  if (!previewImageBytes) {
    return {
      ...snapshot,
      imageMimeType
    };
  }

  return {
    ...snapshot,
    imageMimeType,
    previewImageBytes,
    previewMimeType: 'image/png'
  };
}

export function snapshotNodeMetadata(node: HostNode): SelectionNodeSnapshot {
  const imageFill = hasImageFill(node);
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    typeLabel: nodeTypeLabel(node.type, imageFill),
    visible: nodeVisibilityValue(node),
    locked: isEffectivelyLocked(node),
    width: node.width,
    height: node.height,
    hasImageFill: imageFill,
    text: typeof node.characters === 'string' ? node.characters : undefined,
    pageName: nearestPageName(node)
  };
}

export function nodeTypeLabel(type: string, hasImage = false): string {
  if (hasImage) {
    return '图片';
  }

  const labels: Record<string, string> = {
    RECTANGLE: '矩形',
    TEXT: '文本',
    FRAME: '画板',
    GROUP: '分组',
    COMPONENT: '组件',
    INSTANCE: '组件',
    PAGE: '页面',
    SECTION: '分区',
    ELLIPSE: '椭圆',
    LINE: '线条',
    VECTOR: '矢量',
    POLYGON: '多边形',
    STAR: '星形'
  };

  return labels[type] ?? '图层';
}

export async function exportNodePreview(node: HostNode, context?: HandlerContext): Promise<number[] | undefined> {
  if (typeof node.exportAsync !== 'function') {
    return undefined;
  }

  try {
    const width = typeof node.width === 'number' && node.width > 0 ? node.width : 96;
    const height = typeof node.height === 'number' && node.height > 0 ? node.height : 96;
    const maxSide = Math.max(width, height);
    const scale = maxSide > 0 ? Math.min(1, 96 / maxSide) : 1;
    const pending = Promise.resolve(node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } }));
    const bytes = context
      ? await withTaskTimeout(context, pending, FIGMA_NODE_PREVIEW_TIMEOUT_MS, 'NODE_PREVIEW_TIMEOUT')
      : await pending;
    if (context) throwIfTaskCancelled(context);
    return Array.from(bytes);
  } catch {
    if (context) throwIfTaskCancelled(context);
    return undefined;
  }
}

export function hasImageFill(node: HostNode): boolean {
  return Boolean(getImageFill(node));
}

async function detectImageMimeType(node: HostNode, host?: HostRuntime): Promise<string | undefined> {
  const href = imageFillHref(node);
  if (!href || !host?.getImageByHref) {
    return undefined;
  }

  try {
    const bytes = await host.getImageByHref(href).getBytesAsync();
    const mimeType = inferImageMime(bytes);
    return mimeType === 'application/octet-stream' ? undefined : mimeType;
  } catch {
    return undefined;
  }
}

function imageFillHref(node: HostNode): string | undefined {
  const imageFill = getImageFill(node);
  const href = imageFill?.imageRef ?? imageFill?.imageHash ?? imageFill?.href ?? imageFill?.image;
  return typeof href === 'string' ? href : undefined;
}

function getImageFill(node: HostNode): Record<string, unknown> | undefined {
  const fills = Array.isArray(node.fills) ? (node.fills as Array<Record<string, unknown>>) : [];
  return fills.find((fill) => fill.type === 'IMAGE' && (fill.imageRef || fill.imageHash || fill.href || fill.image));
}

export function traverse(root: HostNode): HostNode[] {
  const nodes: HostNode[] = [root];
  if (hasChildren(root)) {
    for (const child of root.children) {
      nodes.push(...traverse(child));
    }
  }
  return nodes;
}

export type TraversalMode = 'children' | 'deep-query';

export type CollectedNodes = {
  nodes: HostNode[];
  traversalMode: TraversalMode;
};

export function collectDescendants(root: HostNode): CollectedNodes {
  const nodes = [root, ...traverse(root)];
  let usedDeepQuery = false;

  if (typeof root.findAll === 'function') {
    try {
      nodes.push(...root.findAll());
      usedDeepQuery = true;
    } catch {
      usedDeepQuery = false;
    }
  }

  return {
    nodes: uniqueNodes(nodes),
    traversalMode: usedDeepQuery ? 'deep-query' : 'children'
  };
}

export function findNodeById(root: HostNode, nodeId: string): HostNode | undefined {
  return collectDescendants(root).nodes.find((node) => node.id === nodeId);
}

export function findNodeByIdInDocument(host: HostRuntime, nodeId: string): HostNode | undefined {
  const current = findNodeById(host.document.currentPage, nodeId);
  if (current) return current;
  const pages = host.document.pages?.length
    ? host.document.pages
    : host.document.children?.length
      ? host.document.children
      : [host.document.currentPage];
  for (const page of pages) {
    if (page === host.document.currentPage) continue;
    const found = findNodeById(page, nodeId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Native ID resolution supports dynamic pages without scanning unrelated pages. */
export async function resolveNodeById(host: HostRuntime, nodeId: string): Promise<HostNode | undefined> {
  if (host.getNodeByIdAsync) return host.getNodeByIdAsync(nodeId);
  return findNodeByIdInDocument(host, nodeId);
}

export async function resolveNodesById(host: HostRuntime, nodeIds: readonly string[]): Promise<Map<string, HostNode>> {
  if (!host.getNodeByIdAsync) {
    // In-memory hosts have loaded pages. Current-page operations never inspect others.
    const current = new Map(collectDescendants(host.document.currentPage).nodes.map(node => [node.id, node]));
    if (nodeIds.every(id => current.has(id))) return current;
    return indexNodesByIdInDocument(host, nodeIds);
  }
  const result = new Map<string, HostNode>();
  for (const id of new Set(nodeIds)) { const node = await host.getNodeByIdAsync(id); if (node) result.set(id, node); }
  return result;
}

/** Resolve a cleanup batch with one traversal per page instead of per node. */
export function indexNodesByIdInDocument(host: HostRuntime, nodeIds: readonly string[]): Map<string, HostNode> {
  const remaining = new Set(nodeIds);
  const indexed = new Map<string, HostNode>();
  const pages = host.document.pages?.length
    ? host.document.pages
    : host.document.children?.length
      ? host.document.children
      : [host.document.currentPage];

  for (const page of pages) {
    if (remaining.size === 0) break;
    for (const node of collectDescendants(page).nodes) {
      if (!remaining.has(node.id)) continue;
      indexed.set(node.id, node);
      remaining.delete(node.id);
      if (remaining.size === 0) break;
    }
  }

  return indexed;
}

export function nodesForScope(host: HostRuntime, scope: string): HostNode[] {
  return collectNodesForScope(host, scope).nodes;
}

export function collectNodesForScope(host: HostRuntime, scope: string): CollectedNodes {
  const selection = host.document.currentPage.selection ?? [];
  if (scope === 'selection') {
    return mergeCollected(selection.map((node) => collectDescendants(node)));
  }

  if (scope === 'currentFrame' || scope === 'currentContainer') {
    const first = selection[0];
    const frame = first ? nearestContainer(first) : undefined;
    return frame ? collectDescendants(frame) : { nodes: [], traversalMode: 'children' };
  }

  if (scope === 'currentFile' || scope === 'allPages') {
    const pages = host.document.children?.length
      ? host.document.children
      : host.document.pages?.length
        ? host.document.pages
        : [host.document.currentPage];
    return mergeCollected(pages.map((page) => collectDescendants(page)));
  }

  return collectDescendants(host.document.currentPage);
}

export function nearestContainer(node: HostNode | undefined): HostNode | undefined {
  let current = node;
  while (current) {
    if (['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION'].includes(current.type)) {
      return current;
    }
    current = current.parent ?? undefined;
  }
  return undefined;
}

export function nearestPageName(node: HostNode): string | undefined {
  let current: HostNode | undefined = node;
  while (current) {
    if (current.type === 'PAGE') {
      return current.name;
    }
    current = current.parent ?? undefined;
  }
  return undefined;
}

export async function loadNodeFont(host: HostRuntime, node: HostNode): Promise<void> {
  if (!host.loadFontAsync || node.type !== 'TEXT') {
    return;
  }

  const fontName = node.fontName;
  if (!fontName || fontName === 'mixed') {
    const fonts=new Map<string,{family:string;style:string}>();
    for(let index=0;index<String(node.characters??'').length;index++){
      const font=node.getRangeFontName?.(index,index+1);
      if(font&&typeof font==='object'&&'family' in font&&'style' in font){const ref=font as {family:string;style:string};fonts.set(ref.family+'\0'+ref.style,ref);}
    }
    await Promise.all([...fonts.values()].map(font=>host.loadFontAsync!(font)));
    return;
  }

  await host.loadFontAsync(fontName);
}

export function isTransparentNode(node: HostNode): boolean {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  return fills.length > 0 && fills.every((fill) => typeof fill === 'object' && fill && 'opacity' in fill && fill.opacity === 0);
}

export function isInsideInstance(node: HostNode): boolean {
  let current = node.parent ?? undefined;
  while (current) {
    if (current.type === 'INSTANCE') {
      return true;
    }
    current = current.parent ?? undefined;
  }
  return false;
}

export function nodeVisibilityValue(node: HostNode): boolean | undefined {
  return node.isVisible ?? node.visible;
}

export function nodeLockedValue(node: HostNode): boolean | undefined {
  return node.isLocked ?? node.locked;
}

export function hiddenReason(node: HostNode): string | undefined {
  if (nodeVisibilityValue(node) === false) {
    return '自身隐藏';
  }

  let current = node.parent ?? undefined;
  while (current) {
    if (nodeVisibilityValue(current) === false) {
      return `父级隐藏：${current.name}`;
    }
    current = current.parent ?? undefined;
  }

  return undefined;
}

export function isEffectivelyLocked(node: HostNode): boolean {
  let current: HostNode | undefined = node;
  while (current) {
    if (nodeLockedValue(current) === true) {
      return true;
    }
    current = current.parent ?? undefined;
  }
  return false;
}

function mergeCollected(collections: CollectedNodes[]): CollectedNodes {
  const nodes = uniqueNodes(collections.flatMap((collection) => collection.nodes));
  return {
    nodes,
    traversalMode: collections.some((collection) => collection.traversalMode === 'deep-query') ? 'deep-query' : 'children'
  };
}

function uniqueNodes(nodes: HostNode[]): HostNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);
    return true;
  });
}
