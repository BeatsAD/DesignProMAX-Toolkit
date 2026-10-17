import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  KnownMessageType,
  PreviewTextFillPayload,
  SaveTextFillCustomFieldsPayload,
  TextFillCustomField,
  TextFillRule
} from '../../../shared/messages';
import { formatPersistenceError, formatPluginErrorMessage, isOperationCancelled } from '../../../shared/messages';
import { MAX_TEXT_FILL_CUSTOM_FIELDS } from '../../../shared/text-fill-custom-fields';
import type { PreviewItem, PreviewResult, SelectionSnapshot, TaskState } from '../../../shared/types';
import { Button, EmptyState, Field, IconButton, NoticeBar, Panel, RadioGroup, type ConfirmDialogInput } from '../../../ui/components/ui';
import { renderNoFeedback, type FeedbackNotifier, type FeedbackRenderer, type FeedbackScope } from '../../../ui/feedback';
import {
  createPreviewSnapshot,
  createSelectionSignature,
  isPreviewSnapshotStale,
  type PreviewSnapshot
} from '../../../ui/preview-snapshot';

import {createTextFillConfigurationSignature, parseCustomValues} from './text-fill-state';
import {TextFillPreview} from './TextFillPreview';

type Requester = <TData, TPayload = unknown>(type: KnownMessageType, payload?: TPayload) => Promise<TData>;

type TextFillPageProps = {
  request: Requester;
  selection: SelectionSnapshot;
  task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  toast: FeedbackNotifier;
  renderFeedback?: FeedbackRenderer;
  confirm: (input: ConfirmDialogInput) => void;
};

type CustomDraft = { id?: string; name: string; customInput: string; fillMode: TextFillRule['fillMode'] };

const FILL_MODE_OPTIONS: Array<{ label: string; value: TextFillRule['fillMode'] }> = [
  { label: '顺序', value: 'sequence' },
  { label: '随机', value: 'random' },
  { label: '循环', value: 'cycle' },
  { label: '固定值', value: 'fixed' }
];



export default function TextFillPage({ request, selection, setTask, confirm, toast, renderFeedback = renderNoFeedback }: TextFillPageProps) {
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<TextFillCustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [customFieldsError, setCustomFieldsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [customDraft, setCustomDraft] = useState<CustomDraft | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot<PreviewResult<PreviewItem>, PreviewTextFillPayload> | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const preview = previewSnapshot?.result ?? null;
  const selectionSignature = createSelectionSignature(selection);
  const configurationSignature = createTextFillConfigurationSignature(customFields, customDraft);
  const previewStale = isPreviewSnapshotStale(previewSnapshot, selectionSignature, configurationSignature);
  const selectedItems = preview?.items.filter((item) => item.canRun !== false && selectedNodeIds.includes(item.nodeId)) ?? [];
  const selectablePreviewItems = preview?.items ?? [];
  const allPreviewItemsSelected = selectablePreviewItems.length > 0 && selectedNodeIds.length === selectablePreviewItems.length;
  const somePreviewItemsSelected = selectedItems.length > 0 && !allPreviewItemsSelected;

  useEffect(() => {
    let active = true;
    setCustomFieldsLoading(true);
    setCustomFieldsError(false);
    void request<TextFillCustomField[]>('GET_TEXT_FILL_CUSTOM_FIELDS')
      .then((fields) => { if (active) setCustomFields(Array.isArray(fields) ? fields : []); })
      .catch((error) => { if (active) { setCustomFieldsError(true); toastRef.current(messageOf(error), 'parameters'); } })
      .finally(() => { if (active) setCustomFieldsLoading(false); });
    return () => { active = false; };
  }, [request, loadAttempt]);

  async function previewRule(rule: TextFillRule) {
    if (selection.count === 0) {
      toast('请先在画布中选择填充范围', 'selection');
      return;
    }
    const label = rule.fieldLabel ?? rule.fieldType;
    setTask('loading', `正在生成“${label}”预览`);
    try {
      const payload: PreviewTextFillPayload = {
        scope: 'selection',
        rules: [{ ...rule, enabled: true, fallback: true }]
      };
      const data = await request<PreviewResult<PreviewItem>, PreviewTextFillPayload>('PREVIEW_TEXT_FILL', payload);
      const assignedIds = data.items.filter((item) => item.canRun !== false).map((item) => item.nodeId);
      const snapshotPayload = { ...payload, targetNodeIds: assignedIds };
      setPreviewSnapshot(createPreviewSnapshot(data, snapshotPayload, selectionSignature, configurationSignature));
      setSelectedNodeIds(assignedIds);
      setTask('success', `已识别并生成“${label}”${data.total} 条预览`);
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', messageOf(error));
    }
  }

  function previewCustom(field: TextFillCustomField) {
    void previewRule({
      fieldType: `custom:${field.id}`,
      fieldLabel: field.name,
      keywords: [field.name],
      enabled: true,
      source: 'custom',
      fillMode: field.fillMode,
      customValues: field.values
    });
  }

  function run() {
    if (!previewSnapshot?.result.items.length || !selectedItems.length || previewStale) return;
    const snapshot = previewSnapshot;
    const items = selectedItems;
    confirm({
      title: '确认执行文本填充',
      summary: `将填充 ${items.length} 个文本图层。`,
      confirmText: '执行填充',
      onConfirm: async () => {
        setTask('loading', '正在填充文本');
        try {
          const data = await request<{ message: string }>('RUN_TEXT_FILL', { items, confirmed: true });
          setTask(('cancelled' in data && data.cancelled) ? 'cancelled' : 'success', data.message);
        } catch (error) {
          if (!isOperationCancelled(error)) setTask('error', messageOf(error));
        }
      }
    });
  }

  function toggleAllPreviewItems(checked: boolean) {
    setSelectedNodeIds(checked ? selectablePreviewItems.map((item) => item.nodeId) : []);
  }

  function togglePreviewItem(nodeId: string, checked: boolean) {
    setSelectedNodeIds((current) => checked
      ? current.includes(nodeId) ? current : [...current, nodeId]
      : current.filter((id) => id !== nodeId));
  }

  function toggleCustomField(field: TextFillCustomField) {
    const fieldId = `custom:${field.id}`;
    if (expandedFieldId === fieldId) {
      setExpandedFieldId(null);
      setCustomDraft(null);
      return;
    }
    setCustomDraft(field ? {
      id: field.id,
      name: field.name,
      customInput: field.values.join('\n'),
      fillMode: field.fillMode
    } : null);
    setExpandedFieldId(fieldId);
  }

  function startCustomField() {
    setCustomDraft({ name: '', customInput: '', fillMode: 'sequence' });
    setExpandedFieldId('custom:new');
  }

  async function saveCustomModal() {
    if (!customDraft) return;
    const name = customDraft.name.trim();
    const values = parseCustomValues(customDraft.customInput);
    if (!name) return toast('请输入字段名称', 'parameters');
    if (name.length > 20) return toast('字段名称最多 20 个字符', 'parameters');
    if (!values.length) return toast('请输入至少一项候选内容', 'parameters');
    if (values.length > 100 || values.some((value) => value.length > 100)) return toast('候选内容最多 100 项，单项最长 100 个字符', 'parameters');
    if (customFields.some((field) => field.id !== customDraft.id && field.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return toast('字段名称不能重复', 'parameters');
    if (!customDraft.id && customFields.length >= MAX_TEXT_FILL_CUSTOM_FIELDS) return toast(`最多创建 ${MAX_TEXT_FILL_CUSTOM_FIELDS} 个自定义字段`, 'parameters');
    const next = customDraft.id
      ? customFields.map((field) => field.id === customDraft.id ? { ...field, name, values, fillMode: customDraft.fillMode } : field)
      : [...customFields, { id: createCustomFieldId(), name, values, fillMode: customDraft.fillMode }];
    if (await persistCustomFields(next, '自定义字段已保存')) {
      setCustomDraft(null);
      setExpandedFieldId(null);
    }
  }

  function removeCustomField(field: TextFillCustomField) {
    confirm({
      title: '删除自定义字段',
      summary: `确定删除“${field.name}”吗？`,
      confirmText: '删除',
      tone: 'danger',
      onConfirm: () => {
        void persistCustomFields(customFields.filter((item) => item.id !== field.id), '自定义字段已删除').then((saved) => {
          if (saved) {
            setExpandedFieldId(null);
            setCustomDraft(null);
          }
        });
      }
    });
  }

  async function persistCustomFields(next: TextFillCustomField[], successText: string): Promise<boolean> {
    setTask('loading', '正在保存自定义字段', 'parameters');
    try {
      const saved = await request<TextFillCustomField[], SaveTextFillCustomFieldsPayload>('SAVE_TEXT_FILL_CUSTOM_FIELDS', { fields: next });
      setCustomFields(saved);
      setTask('success', successText, 'parameters');
      return true;
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', formatPersistenceError(error, '自定义字段保存失败，请稍后手动重试'), 'parameters');
      return false;
    }
  }

  return (
    <div className="page">
      <Panel title="填充范围">
        {renderFeedback('selection')}
        <ScopeSummary selection={selection} />
      </Panel>

      <Panel title="字段配置">
        {renderFeedback('parameters')}
        {customFieldsLoading ? (
          <div className="text-fill-custom-state">正在读取自定义字段…</div>
        ) : customFieldsError ? (
          <div className="text-fill-custom-state"><span>自定义字段读取失败，请重试</span><Button onClick={() => setLoadAttempt(value => value + 1)}>重试</Button></div>
        ) : (
          <div className="text-fill-custom-panel">
            <div className="text-fill-custom-toolbar"><span>字段名称将用于匹配图层名称</span><Button size="compact" disabled={customFields.length >= MAX_TEXT_FILL_CUSTOM_FIELDS || expandedFieldId === 'custom:new'} onClick={startCustomField}>新增字段</Button></div>
            {expandedFieldId === 'custom:new' && customDraft ? <div className="text-fill-rule is-expanded text-fill-custom-new" data-custom-field="new">
              <div className="text-fill-rule-main text-fill-rule-trigger">
                <div className="text-fill-rule-title"><span aria-hidden="true" className="text-fill-status-dot" /><span>新增字段</span></div>
                <div className="text-fill-rule-summary"><span>尚未保存</span><IconButton ariaControls="text-fill-content-custom-new" ariaExpanded ariaLabel="收起新增字段" className="text-fill-expand-button" icon={ChevronDown} onClick={() => { setExpandedFieldId(null); setCustomDraft(null); }} size="small" /></div>
              </div>
              <div className="text-fill-rule-content" id="text-fill-content-custom-new">
                <CustomFieldEditor draft={customDraft} isDirty onCancel={() => { setExpandedFieldId(null); setCustomDraft(null); }} onChange={setCustomDraft} onDelete={undefined} onPreview={undefined} onSave={() => { void saveCustomModal(); }} />
              </div>
            </div> : null}
            {customFields.length ? <div className="text-fill-rule-list">{customFields.map((field) => {
              const fieldId = `custom:${field.id}`;
              const contentId = `text-fill-content-custom-${field.id}`;
              const expanded = expandedFieldId === fieldId;
              const isDirty = expanded && customDraft ? customDraftIsDirty(customDraft, field) : false;
              return <div className={`text-fill-rule is-configured ${expanded ? 'is-expanded' : ''}`} data-custom-field={field.id} key={field.id}>
                <div className="text-fill-rule-main text-fill-rule-trigger">
                  <div className="text-fill-rule-title"><span aria-hidden="true" className="text-fill-status-dot is-configured" /><span title={field.name}>{field.name}</span></div>
                  <div className="text-fill-rule-summary"><span>{field.values.length} 项 / {fillModeLabel(field.fillMode)}</span><IconButton ariaControls={contentId} ariaExpanded={expanded} ariaLabel={`${expanded ? '收起' : '展开'}${field.name}配置`} className="text-fill-expand-button" icon={ChevronDown} onClick={() => toggleCustomField(field)} size="small" /></div>
                </div>
                {expanded && customDraft ? <div className="text-fill-rule-content" id={contentId}>
                  <CustomFieldEditor draft={customDraft} isDirty={isDirty} onCancel={() => toggleCustomField(field)} onChange={setCustomDraft} onDelete={() => removeCustomField(field)} onPreview={() => previewCustom(field)} onSave={() => { void saveCustomModal(); }} />
                </div> : null}
              </div>;
            })}</div> : expandedFieldId !== 'custom:new' ? <EmptyState title="暂无自定义字段" detail="新增字段名称和候选内容后，可按图层名称自动匹配。" /> : null}
          </div>
        )}
      </Panel>

      <Panel title="预览结果" meta={preview && !previewStale && preview.total > 1 ? <span className="panel-count">{preview.total} 条</span> : undefined}>
        {previewStale ? <NoticeBar state="warning" text="配置或选区已变更，请重新生成预览。"/> : null}
        <div className="text-fill-preview-body">
          {preview?.items.length ? <TextFillPreview items={preview.items} selectedIds={selectedNodeIds} allSelected={allPreviewItemsSelected} someSelected={somePreviewItemsSelected} onToggleAll={toggleAllPreviewItems} onToggle={togglePreviewItem} actionLabel={previewAction}/> : <EmptyState title="暂无预览" detail="生成预览后再执行操作。" />}
        </div>
        {!previewStale ? renderFeedback('result') : null}
        <div className="actions text-fill-preview-actions"><Button disabled={!preview} onClick={() => { setPreviewSnapshot(null); setSelectedNodeIds([]); setTask('idle', '等待操作'); }}>清空</Button><Button variant="primary" disabled={!selectedItems.length || previewStale} onClick={run}>执行填充</Button></div>
      </Panel>
    </div>
  );
}

function CustomFieldEditor({ draft, isDirty, onChange, onCancel, onDelete, onPreview, onSave }: {
  draft: CustomDraft;
  isDirty: boolean;
  onChange: (draft: CustomDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
  onSave: () => void;
}) {
  return <><div className="text-fill-custom-editor-grid"><Field label="字段名称"><input maxLength={20} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="例如：工单状态" /></Field><Field label="候选内容"><textarea value={draft.customInput} onChange={(event) => onChange({ ...draft, customInput: event.target.value })} placeholder="支持换行或逗号分隔，最多 100 项" /></Field></div><div className="text-fill-option-section"><span className="text-fill-modal-label">填充方式</span><RadioGroup ariaLabel="自定义字段填充方式" options={FILL_MODE_OPTIONS} value={draft.fillMode} onChange={(fillMode) => onChange({ ...draft, fillMode })} /></div><div className="text-fill-inline-actions text-fill-custom-actions">{onDelete ? <Button size="compact" variant="danger" onClick={onDelete}>删除</Button> : null}<span className="text-fill-action-spacer" /><Button size="compact" onClick={onCancel}>取消</Button><Button size="compact" disabled={!isDirty} onClick={onSave}>保存</Button>{onPreview ? <Button size="compact" variant="primary" disabled={isDirty} onClick={onPreview}>生成预览</Button> : null}</div></>;
}

function ScopeSummary({ selection }: { selection: SelectionSnapshot }) {
  if (!selection.count) return <div className="text-fill-scope-card is-empty"><div className="text-fill-scope-main"><strong>未选择对象</strong><span>请先在画布中选择文本、容器、组、自动布局或画板。</span></div></div>;
  if (selection.count === 1) { const node = selection.nodes[0]; return <div className="text-fill-scope-card"><div className="text-fill-scope-main"><strong title={node.name}>{node.name || '未命名对象'}</strong><span>{`当前选中对象 / ${node.typeLabel ?? node.type}`}</span></div></div>; }
  const names = selection.nodes.slice(0, 3).map((node) => node.name || '未命名对象');
  return <div className="text-fill-scope-card"><div className="text-fill-scope-main"><strong>已选择 {selection.count} 个对象</strong><span><span data-i18n-skip="true">{names.join('、')}</span>{selection.count > names.length ? ` 等 ${selection.count} 个对象` : ''}</span></div></div>;
}

function fillModeLabel(mode: TextFillRule['fillMode']) { return FILL_MODE_OPTIONS.find((item) => item.value === mode)?.label ?? mode; }
function customDraftIsDirty(draft: CustomDraft, field: TextFillCustomField) {
  return draft.name !== field.name || draft.fillMode !== field.fillMode || parseCustomValues(draft.customInput).join('\n') !== field.values.join('\n');
}
function previewAction(item: PreviewItem) { return `${fillModeLabel(item.fillMode ?? 'sequence')}${item.masked ? ' / 脱敏' : ''}`; }
function createCustomFieldId() { return `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function messageOf(error: unknown) { return formatPluginErrorMessage(error); }

