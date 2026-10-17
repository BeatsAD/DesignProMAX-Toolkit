import { ArrowDown, ArrowUp, ChevronsUp, EyeOff, Plus, RotateCcw, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { HomeToolPageId } from '../../shared/constants';
import { HOME_TOOL_PAGE_IDS } from '../../shared/constants';
import { normalizeHomeLayout } from '../../services/storage';
import type { HomeLayoutSettings } from '../../shared/types';
import { isToolVisible, toolEntries, type ToolEntry } from '../toolRegistry';
import { Button, IconButton, IconText } from './ui';

type ToolLayoutMode = 'default' | 'compact';

type ToolLayoutManagerProps = {
  layout?: HomeLayoutSettings;
  mode: ToolLayoutMode;
  onLayoutChange: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>;
  showResetAction?: boolean;
};

const layoutCopy: Record<ToolLayoutMode, {
  ariaLabel: string;
  description: string;
  hiddenEmptyText: string;
  visibleEmptyText: string;
  visibleTitle: string;
}> = {
  default: {
    ariaLabel: '默认模式首页布局管理',
    description: '调整默认模式首页功能卡片的顺序和显示范围。',
    hiddenEmptyText: '没有已隐藏的首页功能。',
    visibleEmptyText: '首页当前没有显示功能，可以从下方已隐藏列表添加。',
    visibleTitle: '首页显示'
  },
  compact: {
    ariaLabel: '紧凑模式布局管理',
    description: '调整紧凑工具栏快捷功能的顺序和显示范围。',
    hiddenEmptyText: '没有已隐藏的紧凑工具栏功能。',
    visibleEmptyText: '紧凑工具栏当前没有显示功能，可以从下方已隐藏列表添加。',
    visibleTitle: '紧凑工具栏显示'
  }
};

export function ToolLayoutManager({
  layout,
  mode,
  onLayoutChange,
  showResetAction = true
}: ToolLayoutManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const normalizedLayout = useMemo(() => normalizeHomeLayout(layout), [layout]);
  const hiddenSet = useMemo(() => new Set(normalizedLayout.hiddenPageIds), [normalizedLayout.hiddenPageIds]);
  const visibleTools = normalizedLayout.orderedPageIds
    .filter((pageId) => isToolVisible(pageId) && !hiddenSet.has(pageId))
    .map((pageId) => toolEntries[pageId]);
  const hiddenTools = HOME_TOOL_PAGE_IDS
    .filter((pageId) => isToolVisible(pageId) && hiddenSet.has(pageId))
    .map((pageId) => toolEntries[pageId]);
  const copy = layoutCopy[mode];

  async function saveLayout(nextLayout: HomeLayoutSettings) {
    setIsSaving(true);
    try {
      await onLayoutChange(normalizeHomeLayout(nextLayout));
    } catch {
      // 页面持有者负责提示、回滚和持久化错误说明。
    } finally {
      setIsSaving(false);
    }
  }

  function moveTool(pageId: HomeToolPageId, direction: 'first' | 'up' | 'down') {
    const orderedPageIds = [...normalizedLayout.orderedPageIds];
    const index = orderedPageIds.indexOf(pageId);
    if (index < 0) return;

    orderedPageIds.splice(index, 1);
    if (direction === 'first') {
      orderedPageIds.unshift(pageId);
    } else if (direction === 'up') {
      orderedPageIds.splice(Math.max(index - 1, 0), 0, pageId);
    } else {
      orderedPageIds.splice(Math.min(index + 1, orderedPageIds.length), 0, pageId);
    }
    void saveLayout({ ...normalizedLayout, orderedPageIds });
  }

  function hideTool(pageId: HomeToolPageId) {
    void saveLayout({
      ...normalizedLayout,
      hiddenPageIds: [...normalizedLayout.hiddenPageIds, pageId]
    });
  }

  function showTool(pageId: HomeToolPageId) {
    void saveLayout({
      ...normalizedLayout,
      hiddenPageIds: normalizedLayout.hiddenPageIds.filter((hiddenPageId) => hiddenPageId !== pageId)
    });
  }

  function resetLayout() {
    void saveLayout(normalizeHomeLayout(undefined));
  }

  return (
    <div className={`home-layout-manager tool-layout-manager tool-layout-manager-${mode}`} aria-label={copy.ariaLabel}>
      {showResetAction ? (
        <div className="tool-layout-manager-head">
          <p>{copy.description}</p>
          <Button disabled={isSaving} onClick={resetLayout} size="compact" title="重置默认布局">
            <IconText icon={RotateCcw}>重置默认</IconText>
          </Button>
        </div>
      ) : null}
      <HomeLayoutSection emptyText={copy.visibleEmptyText} title={copy.visibleTitle} tools={visibleTools}>
        {(tool, index) => (
          <LayoutToolRow key={tool.page} tool={tool}>
            <LayoutIconButton disabled={isSaving || index === 0} icon={ChevronsUp} label="置顶" onClick={() => moveTool(tool.page, 'first')} />
            <LayoutIconButton disabled={isSaving || index === 0} icon={ArrowUp} label="上移" onClick={() => moveTool(tool.page, 'up')} />
            <LayoutIconButton disabled={isSaving || index === visibleTools.length - 1} icon={ArrowDown} label="下移" onClick={() => moveTool(tool.page, 'down')} />
            <LayoutIconButton disabled={isSaving} icon={EyeOff} label="移除" onClick={() => hideTool(tool.page)} />
          </LayoutToolRow>
        )}
      </HomeLayoutSection>
      <HomeLayoutSection emptyText={copy.hiddenEmptyText} title="已隐藏" tools={hiddenTools}>
        {(tool) => (
          <LayoutToolRow key={tool.page} tool={tool}>
            <LayoutIconButton disabled={isSaving} icon={Plus} label="添加" onClick={() => showTool(tool.page)} />
          </LayoutToolRow>
        )}
      </HomeLayoutSection>
    </div>
  );
}

function HomeLayoutSection({
  children,
  emptyText,
  title,
  tools
}: {
  children: (tool: ToolEntry, index: number) => ReactNode;
  emptyText: string;
  title: string;
  tools: ToolEntry[];
}) {
  return (
    <section className="home-layout-section">
      <div className="home-layout-section-head">
        <strong>{title}</strong>
        <span>{tools.length}</span>
      </div>
      {tools.length > 0 ? <div className="home-layout-list">{tools.map(children)}</div> : <p className="home-layout-empty">{emptyText}</p>}
    </section>
  );
}

function LayoutToolRow({ children, tool }: { children: ReactNode; tool: ToolEntry }) {
  const Icon = tool.icon;
  return (
    <div className="home-layout-row">
      <span className="home-layout-row-icon"><Icon size={20} /></span>
      <span className="home-layout-row-copy"><strong>{tool.label}</strong><small>{tool.desc}</small></span>
      <span className="home-layout-row-actions">{children}</span>
    </div>
  );
}

function LayoutIconButton({
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return <IconButton ariaLabel={label} className="home-layout-icon-btn" disabled={disabled} icon={Icon} onClick={onClick} size="small" title={label} />;
}
