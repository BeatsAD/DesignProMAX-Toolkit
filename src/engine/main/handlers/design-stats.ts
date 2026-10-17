// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { DesignStatsMaterialType, ScanDesignStatsPayload } from '../../shared/messages';
import type { HandlerContext, HostNode } from '../host-runtime';
import { hasImageFill } from './nodes';
import { reportTaskProgress, throwIfTaskCancelled } from '../task';

type StatsTreeNode = {
  node: HostNode;
};

type StatsPageResult = {
  pageId: string;
  pageName: string;
  count: number;
  roots: StatsTreeNode[];
};

export function handleScanDesignStats(context: HandlerContext, payload: ScanDesignStatsPayload) {
  const includedMaterials = new Set<DesignStatsMaterialType>(payload.includeMaterialTypes ?? []);
  const allPages = designStatsPages(context.host);
  const selectedPageIds = new Set(payload.pageIds?.length ? payload.pageIds : [context.host.document.currentPage.id]);
  const pages = allPages.filter((page) => selectedPageIds.has(page.id));
  const pageResults = pages.map((page, index) => {
    throwIfTaskCancelled(context);
    reportTaskProgress(context, index + 1, pages.length, `正在统计 ${index + 1}/${pages.length}`);
    return buildPageStats(page, includedMaterials);
  });
  const total = pageResults.reduce((sum, page) => sum + page.count, 0);

  return {
    text: formatStatsText(pageResults, total, designFileName(context.host)),
    total,
    pages: pageResults.map((page) => ({
      pageId: page.pageId,
      pageName: page.pageName,
      count: page.count
    }))
  };
}

function designStatsPages(host: HandlerContext['host']): Array<HostNode & { selection?: HostNode[] }> {
  if (host.document.children?.length) {
    return host.document.children;
  }
  return host.document.pages?.length ? host.document.pages : [host.document.currentPage];
}

function designFileName(host: HandlerContext['host']): string {
  const candidate = host as HandlerContext['host'] & {
    name?: unknown;
    root?: { name?: unknown };
    document: HandlerContext['host']['document'] & { name?: unknown };
  };
  const names = [
    candidate.document.name,
    candidate.root?.name,
    candidate.name
  ];
  const name = names.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return name?.trim() ?? '当前设计文件';
}

function buildPageStats(page: HostNode, includedMaterials: Set<DesignStatsMaterialType>): StatsPageResult {
  const matchedNodes = (page.children ?? []).filter((node) => matchesStatsNode(node, includedMaterials));

  return {
    pageId: page.id,
    pageName: page.name,
    count: matchedNodes.length,
    roots: matchedNodes.map((node) => ({ node }))
  };
}

function matchesStatsNode(node: HostNode, includedMaterials: Set<DesignStatsMaterialType>): boolean {
  if (node.type === 'FRAME') {
    return true;
  }
  if (hasImageFill(node)) {
    return includedMaterials.has('image');
  }
  if (node.type === 'GROUP' || node.type === 'SECTION') {
    return includedMaterials.has('group');
  }
  if (node.type === 'TEXT') {
    return includedMaterials.has('text');
  }
  if (node.type === 'RECTANGLE') {
    return includedMaterials.has('rectangle');
  }
  return false;
}

function formatStatsText(pages: StatsPageResult[], total: number, fileName: string): string {
  const lines = [`${fileName}总计：${total}个页面，具体如下：`];

  pages.forEach((page, index) => {
    const names = page.roots.length > 0
      ? page.roots.map((item) => item.node.name).join('、')
      : '暂无匹配页面';
    lines.push(`${index + 1}、${page.pageName}，总计${page.count}个页面，分别是：${names}。`);
  });

  return lines.join('\n');
}
