import { useState } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, ListChecks, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { HomeToolPageId, PageId } from '../../shared/constants';
import type { PluginSettings } from '../../shared/types';
import { Button, StatusTag } from '../components/ui';
import { systemManual, toolManuals, type SystemManual, type ToolManual } from '../help/manualContent';
import type { SettingsView } from '../settings';
import { isToolVisible, resolveToolStatus, toolEntries, type ToolEntry } from '../toolRegistry';
import './HelpPage.css';

type HelpPageProps = {
  onBack: () => void;
  onNavigate?: (page: PageId) => void;
  onGoSettings?: (view?: SettingsView) => void;
  settings?: PluginSettings;
};

type ManualEntry = {
  id: HomeToolPageId | 'system';
  icon: LucideIcon;
  label: string;
  manual: ToolManual | SystemManual;
  tool?: ToolEntry;
};

const manualEntries: readonly ManualEntry[] = [
  ...Object.values(toolEntries)
    .filter((tool) => isToolVisible(tool.page))
    .map((tool) => ({
      id: tool.page,
      icon: tool.icon,
      label: tool.label,
      manual: toolManuals[tool.page],
      tool
    })),
  {
    id: 'system',
    icon: SlidersHorizontal,
    label: '设置中心',
    manual: systemManual
  }
];

export function HelpPage({ onBack, onNavigate, onGoSettings, settings }: HelpPageProps) {
  const [selectedManualId, setSelectedManualId] = useState<ManualEntry['id']>();
  const selectedEntry = manualEntries.find((entry) => entry.id === selectedManualId);

  return (
    <div className="page help-page settings-subpage">
      <button className="settings-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={16} />
        <span>返回设置</span>
      </button>

      <section aria-label="功能使用帮助" className={`help-manual-section ${selectedEntry ? 'has-selection' : ''}`}>
        <aside className="help-guide-disclosure" role="note">
          <strong>先选择对象、配置参数并生成预览，再确认执行。</strong>
          <span>“需配置”表示需要补充服务设置；“环境相关”表示可用性取决于当前 Figma 文件、权限或团队环境。</span>
        </aside>

        <div className="help-manual-browser">
          <section className="help-manual-index" aria-label="功能索引">
            <div className="help-manual-index-heading">
              <strong>功能索引</strong>
              <span>{manualEntries.length} 项</span>
            </div>
            <div className="help-manual-index-list">
              {manualEntries.map((entry) => (
                <ManualIndexButton
                  entry={entry}
                  key={entry.id}
                  onSelect={() => setSelectedManualId(entry.id)}
                  selected={selectedEntry?.id === entry.id}
                  settings={settings}
                />
              ))}
            </div>
          </section>

          {selectedEntry ? (
            <ManualDetail
              entry={selectedEntry}
              onBackToIndex={() => setSelectedManualId(undefined)}
              onGoSettings={onGoSettings}
              onNavigate={onNavigate}
              settings={settings}
            />
          ) : (
            <div className="help-manual-detail-empty" aria-live="polite">
              <strong>从功能索引选择一项</strong>
              <span>查看使用前准备、操作步骤、注意事项及直达操作。</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ManualIndexButton({
  entry,
  selected,
  onSelect,
  settings
}: {
  entry: ManualEntry;
  selected: boolean;
  onSelect: () => void;
  settings?: PluginSettings;
}) {
  const Icon = entry.icon;

  return (
    <button
      aria-pressed={selected}
      className={`help-manual-index-item ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
      <span>{entry.label}</span>
    </button>
  );
}

function ManualDetail({
  entry,
  onBackToIndex,
  onNavigate,
  onGoSettings,
  settings
}: {
  entry: ManualEntry;
  onBackToIndex: () => void;
  onNavigate?: (page: PageId) => void;
  onGoSettings?: (view?: SettingsView) => void;
  settings?: PluginSettings;
}) {
  const Icon = entry.icon;
  const status = entry.tool ? resolveToolStatus(entry.tool, settings) : undefined;
  const setupView = 'setupView' in entry.manual ? entry.manual.setupView : undefined;
  const canOpenTool = Boolean(entry.tool && onNavigate);

  return (
    <article className="help-manual-detail-panel" aria-labelledby={`help-manual-${entry.id}`}>
      <button className="help-index-return" onClick={onBackToIndex} type="button">
        <ArrowLeft aria-hidden="true" size={16} />
        功能索引
      </button>
      <div className="help-manual-detail-heading">
        <span className="help-manual-detail-icon"><Icon aria-hidden="true" size={18} /></span>
        <div>
          <div className="help-manual-title-row">
            <h3 id={`help-manual-${entry.id}`}>{entry.label}</h3>
            {status ? <StatusTag tone={status.tone}>{status.label}</StatusTag> : null}
          </div>
          <p>{entry.manual.summary}</p>
        </div>
      </div>
      <div className="help-manual-detail-content">
        <ManualDetailList kind="prerequisite" title="使用前准备" items={entry.manual.prerequisites} />
        <ManualDetailList kind="steps" ordered title="按以下步骤操作" items={entry.manual.steps} />
        <ManualDetailList kind="notes" title="使用提示" items={entry.manual.notes} />
      </div>
      {setupView || canOpenTool || entry.id === 'system' ? (
        <div className="help-manual-actions">
          {setupView && onGoSettings ? <Button onClick={() => onGoSettings(setupView)}>去配置</Button> : null}
          {canOpenTool && entry.tool && onNavigate ? <Button onClick={() => onNavigate(entry.tool!.page)} variant="primary">打开{entry.label}</Button> : null}
          {entry.id === 'system' && onGoSettings ? <Button onClick={() => onGoSettings('main')} variant="primary">打开设置</Button> : null}
        </div>
      ) : null}
    </article>
  );
}

type ManualDetailListKind = 'prerequisite' | 'steps' | 'notes';

function ManualDetailList({
  kind,
  title,
  items,
  ordered = false
}: {
  kind: ManualDetailListKind;
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  const List = ordered ? 'ol' : 'ul';
  const SectionIcon = kind === 'prerequisite' ? CircleCheck : kind === 'steps' ? ListChecks : CircleAlert;

  return (
    <section className={`help-manual-detail-list is-${kind}`}>
      <div className="help-manual-detail-list-heading">
        <span className="help-manual-detail-list-icon"><SectionIcon aria-hidden="true" size={14} /></span>
        <h4>{title}</h4>
        {kind === 'prerequisite' ? <span className="help-manual-detail-count">{items.length} 项</span> : null}
      </div>
      <List className="help-manual-detail-items">
        {items.map((item, index) => (
          <li key={item}>
            <span aria-hidden="true" className="help-manual-detail-item-marker">{ordered ? index + 1 : null}</span>
            <span>{item}</span>
          </li>
        ))}
      </List>
    </section>
  );
}
