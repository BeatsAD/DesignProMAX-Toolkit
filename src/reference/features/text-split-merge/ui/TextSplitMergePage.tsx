import { useMemo, useState } from 'react';
import type { KnownMessageType } from '../../../shared/messages';
import { formatPluginErrorMessage, isOperationCancelled } from '../../../shared/messages';
import type { SelectionSnapshot, TaskState, ToolExecutionResult } from '../../../shared/types';
import {
  DEFAULT_TEXT_SPLIT_DELIMITERS,
  OPTIONAL_TEXT_SPLIT_DELIMITERS,
  resolveTextSplitDelimiters,
  splitTextByDelimiters,
  type PreviewTextSplitMergePayload,
  type RunTextSplitMergePayload,
  type TextMergeSeparator,
  type TextSplitDelimiterRetention,
  type TextSplitDirection,
  type TextSplitMergeMode,
  type TextSplitMergePreviewResult
} from '../../../shared/text-split-merge';
import { Button, Checkbox, EmptyState, NoticeBar, Field, Panel, RadioGroup, SelectField, Tabs, type ConfirmDialogInput } from '../../../ui/components/ui';
import { renderNoFeedback, type FeedbackNotifier, type FeedbackRenderer, type FeedbackScope } from '../../../ui/feedback';
import { createParameterSignature, createPreviewSnapshot, createSelectionSignature, isPreviewSnapshotStale, type PreviewSnapshot } from '../../../ui/preview-snapshot';

type Requester = <TData, TPayload = unknown>(type: KnownMessageType, payload?: TPayload) => Promise<TData>;

type TextSplitMergePageProps = {
  request: Requester;
  selection: SelectionSnapshot;
  task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  toast: FeedbackNotifier;
  renderFeedback?: FeedbackRenderer;
  confirm: (input: ConfirmDialogInput) => void;
};

const DELIMITER_OPTIONS = [
  ...DEFAULT_TEXT_SPLIT_DELIMITERS.map((value) => ({ value, label: value })),
  ...OPTIONAL_TEXT_SPLIT_DELIMITERS.map((value) => ({ value, label: value === '\n' ? '换行' : value }))
];

export default function TextSplitMergePage({ request, selection, setTask, toast, renderFeedback = renderNoFeedback, confirm }: TextSplitMergePageProps) {
  const [mode, setMode] = useState<TextSplitMergeMode>('merge');
  const [separator, setSeparator] = useState<TextMergeSeparator>('none');
  const [customSeparator, setCustomSeparator] = useState('');
  const [delimiters, setDelimiters] = useState<string[]>([...DEFAULT_TEXT_SPLIT_DELIMITERS]);
  const [customDelimiters, setCustomDelimiters] = useState('');
  const [retainDelimiter, setRetainDelimiter] = useState<TextSplitDelimiterRetention>('previous');
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [direction, setDirection] = useState<TextSplitDirection>('vertical');
  const [gap, setGap] = useState(8);
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot<TextSplitMergePreviewResult, PreviewTextSplitMergePayload> | null>(null);

  const payload = useMemo<PreviewTextSplitMergePayload>(() => mode === 'merge'
    ? { mode, separator, ...(separator === 'custom' ? { customSeparator } : {}) }
    : { mode, delimiters, customDelimiters, retainDelimiter, trimWhitespace, direction, gap }, [
    mode, separator, customSeparator, delimiters, customDelimiters, retainDelimiter, trimWhitespace, direction, gap
  ]);
  const selectionSignature = createSelectionSignature(selection);
  const parameterSignature = createParameterSignature(payload);
  const preview = previewSnapshot?.result ?? null;
  const previewStale = isPreviewSnapshotStale(previewSnapshot, selectionSignature, parameterSignature);
  const selectedTextCount = selection.nodes.filter((node) => node.type === 'TEXT').length;
  const splitExample = useMemo(() => {
    const parts = splitTextByDelimiters(
      '苹果、香蕉，葡萄',
      resolveTextSplitDelimiters(delimiters, customDelimiters),
      retainDelimiter,
      trimWhitespace
    );
    return parts.length > 1 ? parts.join(' / ') : '当前分隔符不会拆分这个示例';
  }, [delimiters, customDelimiters, retainDelimiter, trimWhitespace]);

  function toggleDelimiter(value: string, checked: boolean) {
    setDelimiters((current) => checked
      ? [...new Set([...current, value])]
      : current.filter((item) => item !== value));
  }

  async function previewPlan() {
    if (selection.count === 0) {
      toast(mode === 'merge' ? '请先选择至少 2 个文本图层' : '请先选择 1 个文本图层', 'selection');
      return;
    }
    if (mode === 'merge' && separator === 'custom' && !customSeparator) {
      toast('请输入自定义连接符', 'parameters');
      return;
    }
    if (mode === 'split' && delimiters.length === 0 && !customDelimiters) {
      toast('请至少选择或输入一个分隔符', 'parameters');
      return;
    }

    setTask('loading', mode === 'merge' ? '正在生成文本合并预览' : '正在生成文本拆分预览');
    try {
      const data = await request<TextSplitMergePreviewResult, PreviewTextSplitMergePayload>('PREVIEW_TEXT_SPLIT_MERGE', payload);
      setPreviewSnapshot(createPreviewSnapshot(data, payload, selectionSignature, parameterSignature));
      setTask(('cancelled' in data && data.cancelled) ? 'cancelled' : 'success', data.message);
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', messageOf(error));
    }
  }

  function run() {
    if (!previewSnapshot || !preview?.canRun || previewStale) return;
    const snapshot = previewSnapshot;
    const isMerge = snapshot.params.mode === 'merge';
    const count = snapshot.result.sources.length;
    confirm({
      title: isMerge ? '确认合并文本' : '确认拆分文本',
      summary: isMerge ? `将 ${count} 个文本合并为 1 个。` : `将 1 个文本拆分为 ${snapshot.result.outputCount} 个独立文本。`,
      warnings: isMerge ? ['结果沿用阅读顺序首条文本的样式。'] : [],
      confirmText: isMerge ? '确认合并' : '确认拆分',
      tone: 'warning',
      onConfirm: async () => {
        setTask('loading', isMerge ? '正在合并文本' : '正在拆分文本');
        try {
          const data = await request<ToolExecutionResult, RunTextSplitMergePayload>('RUN_TEXT_SPLIT_MERGE', {
            ...snapshot.params,
            expectedSources: snapshot.result.sources,
            confirmed: true
          });
          setTask(('cancelled' in data && data.cancelled) ? 'cancelled' : 'success', data.message);
        } catch (error) {
          if (!isOperationCancelled(error)) setTask('error', messageOf(error));
        }
      }
    });
  }

  return (
    <div className="page text-split-merge-page">
      <Tabs
        ariaLabel="文本拆合模式"
        options={[{ value: 'merge', label: '合并文本' }, { value: 'split', label: '拆分文本' }]}
        value={mode}
        onChange={setMode}
      >
        <Panel title="当前选区">
          {renderFeedback('selection')}
          <div className="text-split-merge-selection">
            <strong>{selection.count} 个对象，其中 {selectedTextCount} 个文本</strong>
          </div>
        </Panel>

        <Panel title={mode === 'merge' ? '合并配置' : '拆分配置'}>
        {renderFeedback('parameters')}
        {mode === 'merge' ? (
          <div className="text-split-merge-config-grid">
            <SelectField label="连接符" value={separator} onChange={(event) => setSeparator(event.target.value as TextMergeSeparator)}>
              <option value="none">无连接符</option>
              <option value="space">空格</option>
              <option value="newline">换行</option>
              <option value="custom">自定义</option>
            </SelectField>
            {separator === 'custom' ? <Field label="自定义连接符"><input maxLength={20} onChange={(event) => setCustomSeparator(event.target.value)} placeholder="最多 20 个字符" value={customSeparator} /></Field> : null}
          </div>
        ) : (
          <div className="text-split-merge-split-config">
            <div className="text-split-merge-default-tip">
              <strong>按常用中文标点拆分</strong>
              <span>默认按顿号、逗号、句号和分号拆分，结果从上到下排列。</span>
              <p aria-live="polite"><b>示例：</b>苹果、香蕉，葡萄 <i>→</i> {splitExample}</p>
            </div>
            <details className="text-split-merge-advanced-settings">
              <summary>
                <span>高级设置</span>
              </summary>
              <div className="text-split-merge-advanced-body">
                <Field label="按哪些符号拆分">
                  <div className="text-split-merge-delimiters">
                    {DELIMITER_OPTIONS.map((option) => <label className="text-split-merge-delimiter" key={option.value}>
                      <Checkbox ariaLabel={`按${option.label}拆分`} checked={delimiters.includes(option.value)} onChange={(checked) => toggleDelimiter(option.value, checked)} />
                      <span>{option.label}</span>
                    </label>)}
                  </div>
                </Field>
                <Field label="其他分隔字符"><input maxLength={20} onChange={(event) => setCustomDelimiters(event.target.value)} placeholder="例如：/ 或 |，最多 20 个字符" value={customDelimiters} /></Field>
                <div className="text-split-merge-config-grid text-split-merge-advanced-grid">
                  <Field label="标点放在哪里"><RadioGroup ariaLabel="标点放置位置" options={[{ value: 'previous', label: '保留在句尾（推荐）' }, { value: 'discard', label: '删除标点' }, { value: 'next', label: '放到下一段开头' }]} value={retainDelimiter} onChange={setRetainDelimiter} /></Field>
                  <Field label="拆分后怎么排列"><RadioGroup ariaLabel="拆分后排列方式" options={[{ value: 'vertical', label: '从上到下（推荐）' }, { value: 'horizontal', label: '从左到右' }]} value={direction} onChange={setDirection} /></Field>
                  <Field label="文字间空白"><div className="text-split-merge-gap-input"><input aria-label="文字间空白" max="200" min="0" onChange={(event) => setGap(clampGap(event.target.value))} type="number" value={gap} /><span>px</span></div></Field>
                </div>
                <label className="text-split-merge-trim"><Checkbox ariaLabel="自动清除每段首尾空格" checked={trimWhitespace} onChange={setTrimWhitespace} /><span>自动清除每段开头和结尾的空格</span></label>
              </div>
            </details>
          </div>
        )}
        <div className="actions right"><Button variant="primary" onClick={() => { void previewPlan(); }}>生成预览</Button></div>
        </Panel>

        <Panel title="预览结果" meta={preview?.canRun && !previewStale && preview.outputCount > 1 ? <span className="panel-count">{`${preview.outputCount} 个结果`}</span> : undefined}>
        {previewStale ? <NoticeBar state="warning" text="配置或选区已变更，请重新生成预览。"/> : null}
        {preview?.blockedReason ? <NoticeBar state="warning" text={preview.blockedReason}/> : null}
        {preview?.mode === 'merge' && preview.canRun ? <NoticeBar state="info" text={`合并结果将沿用阅读顺序首条文本“${preview.sources[0]?.name ?? '来源文本'}”的样式，并删除其余 ${Math.max(0, preview.sources.length - 1)} 个来源文本。`}/> : null}
        {preview?.items.length ? <div className="text-split-merge-preview-list">
          {preview.items.map((item) => <div className="text-split-merge-preview-item" key={`${item.outputIndex}-${item.after}`}>
            <span className="text-split-merge-preview-index">{item.outputIndex}</span>
            <div><small>{mode === 'merge' ? '合并结果' : '拆分结果'}</small><strong title={item.after}>{item.after}</strong></div>
          </div>)}
        </div> : <EmptyState title="暂无预览" detail="配置参数后生成预览；不支持的选区会显示具体原因。" />}
        {!previewStale ? renderFeedback('result') : null}
        <div className="actions text-split-merge-actions"><Button disabled={!preview} onClick={() => { setPreviewSnapshot(null); setTask('idle', '等待操作'); }}>清空</Button><Button disabled={!preview?.canRun || previewStale} variant="primary" onClick={run}>{mode === 'merge' ? '执行合并' : '执行拆分'}</Button></div>
        </Panel>
      </Tabs>
    </div>
  );
}

function clampGap(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(200, Math.max(0, Math.round(parsed))) : 0;
}

function messageOf(error: unknown): string {
  return formatPluginErrorMessage(error);
}
