import { useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';
import type { HomeToolPageId, PageId } from '../../shared/constants';
import type { HomeLayoutSettings, PluginSettings } from '../../shared/types';
import { normalizeHomeLayout } from '../../services/storage';
import { Button, IconText } from '../components/ui';
import { ToolLayoutManager } from '../components/ToolLayoutManager';
import { isToolVisible, resolveToolStatus, toolEntries, type ToolStatus } from '../toolRegistry';
import { HomeBanner } from '../components/HomeBanner';

type ToolDefinition = {
  page: HomeToolPageId;
  title: string;
  desc: string;
  icon: LucideIcon;
  status?: ToolStatus;
};

const tools: Record<HomeToolPageId, ToolDefinition> = Object.fromEntries(
  Object.entries(toolEntries).map(([pageId, entry]) => [
    pageId,
    {
      page: entry.page,
      title: entry.label,
      desc: entry.desc,
      icon: entry.icon
    }
  ])
) as Record<HomeToolPageId, ToolDefinition>;

export function HomePage({
  layout,
  onLayoutChange,
  onNavigate,
  onOpenFeedback,
  messageNotice,
  settings
}: {
  layout?: HomeLayoutSettings;
  onLayoutChange: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>;
  onNavigate: (page: PageId) => void;
  onOpenFeedback?: () => void;
  messageNotice?: ReactNode;
  settings?: PluginSettings;
}) {
  const [isManaging, setIsManaging] = useState(false);
  const normalizedLayout = useMemo(() => normalizeHomeLayout(layout), [layout]);
  const hiddenSet = useMemo(() => new Set(normalizedLayout.hiddenPageIds), [normalizedLayout.hiddenPageIds]);
  const orderedTools = normalizedLayout.orderedPageIds
    .filter(isToolVisible)
    .map((pageId) => ({
      ...tools[pageId],
      status: resolveToolStatus(toolEntries[pageId], settings)
    }));
  const visibleTools = orderedTools.filter((tool) => !hiddenSet.has(tool.page));
  function resetLayout() {
    void onLayoutChange(normalizeHomeLayout(undefined)).catch(() => undefined);
  }

  return (
    <div className="page">
      <HomeBanner onOpenFeedback={onOpenFeedback}/>
      <div className="page-head home-page-head">
        <div className="home-message-notice">{messageNotice}</div>
        <div className="home-layout-toolbar">
          <Button
            onClick={() => setIsManaging((current) => !current)}
            pressed={isManaging}
            size="compact"
            title={isManaging ? '完成布局管理' : '管理首页布局'}
          >
            <IconText icon={isManaging ? Check : SlidersHorizontal}>{isManaging ? '完成' : '管理布局'}</IconText>
          </Button>
        </div>
      </div>

      {isManaging ? (
        <ToolLayoutManager layout={normalizedLayout} mode="default" onLayoutChange={onLayoutChange} />
      ) : visibleTools.length > 0 ? (
        <div className="tool-grid">
          {visibleTools.map((tool) => (
            <ToolCard key={tool.page} tool={tool} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <div className="home-empty-state">
          <strong>首页暂无功能</strong>
          <span>可以添加已隐藏功能，或恢复默认布局。</span>
          <div className="home-empty-actions">
            <Button onClick={() => setIsManaging(true)} size="compact">
              <IconText icon={Plus}>添加功能</IconText>
            </Button>
            <Button onClick={resetLayout} size="compact">
              <IconText icon={RotateCcw}>重置默认</IconText>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCard({ tool, onNavigate }: { tool: ToolDefinition; onNavigate: (page: PageId) => void }) {
  const Icon = tool.icon;

  return (
    <button className="tool-card" onClick={() => onNavigate(tool.page)} type="button">
      <span className="tool-card-icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <span className="tool-card-copy">
        <span className="tool-card-title-row">
          <strong>{tool.title}</strong>
          {tool.status ? <em className={`tool-status ${tool.status.tone}`}>{tool.status.label}</em> : null}
        </span>
        <span>{tool.desc}</span>
      </span>
    </button>
  );
}
