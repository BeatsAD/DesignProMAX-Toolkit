import { useState, type ReactElement } from 'react';
import { translateUi } from '../../../i18n';
import { isOperationCancelled } from "../../../shared/messages";
import type { RunCleanupPayload, RunCleanupResult, ScanCleanupPayload } from "../../../shared/messages";
import type { CleanupCandidate, PreviewResult } from "../../../shared/types";
import { Button, Checkbox, EmptyState, NoticeBar, MultiSelectField, ObjectPreviewItem, Panel, SelectField, StatusTag, type MultiSelectOption } from "../../../ui/components/ui";
import { renderNoFeedback } from "../../../ui/feedback";
import { createParameterSignature, createPreviewSnapshot, createSelectionSignature, isPreviewSnapshotStale, type PreviewSnapshot } from "../../../ui/preview-snapshot";
import { ToolPageProps, messageOf } from '../../../ui/pages/tool-page-shared';


const CLEANUP_RULE_OPTIONS: Array<MultiSelectOption & { value: ScanCleanupPayload['types'][number] }> = [
  { label: '隐藏图层', value: 'hidden' },
  { label: '空文本', value: 'emptyText' },
  { label: '空分组', value: 'emptyGroup' },
  { label: '透明图层', value: 'transparent', description: '高风险', tone: 'warning' },
  { label: '0 尺寸', value: 'zeroSize', description: '高风险', tone: 'warning' }
];

const CLEANUP_SCOPE_OPTIONS: Array<{ label: string; value: ScanCleanupPayload['scope'] }> = [
  { label: '当前选中', value: 'selection' },
  { label: '当前页面', value: 'currentPage' },
  { label: '所有页面', value: 'allPages' }
];

const CLEANUP_INSTANCE_OPTIONS: Array<{ label: string; value: 'exclude' | 'include' }> = [
  { label: '包含（仅预览）', value: 'include' },
  { label: '不包含', value: 'exclude' }
];

const CLEANUP_BATCH_SIZE = 50;

export default function CleanupPage({ request, selection, task, setTask, confirm, toast, renderFeedback = renderNoFeedback }: ToolPageProps) {
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot<PreviewResult<CleanupCandidate>, ScanCleanupPayload> | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [succeededNodeIds, setSucceededNodeIds] = useState<string[]>([]);
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>({});
  const [hasCompletedBatch, setHasCompletedBatch] = useState(false);
  const [executionStateUnknown, setExecutionStateUnknown] = useState(false);
  const [scanScope, setScanScope] = useState<ScanCleanupPayload['scope']>('selection');
  const [selectedTypes, setSelectedTypes] = useState<ScanCleanupPayload['types']>([]);
  const [includeComponentInstanceChildren, setIncludeComponentInstanceChildren] = useState(false);
  const preview = previewSnapshot?.result ?? null;
  const cleanupSelectionSignature = scanScope === 'selection' ? createSelectionSignature(selection) : '';
  const cleanupParameterSignature = createParameterSignature(scanScope, selectedTypes, includeComponentInstanceChildren);
  const previewStale = isPreviewSnapshotStale(previewSnapshot, cleanupSelectionSignature, cleanupParameterSignature);
  const succeededNodeIdSet = new Set(succeededNodeIds);
  const visibleItems = preview?.items.filter((item) => !succeededNodeIdSet.has(item.nodeId)) ?? [];
  const selectedItems = visibleItems.filter((item) => !item.locked && !item.insideInstance && selectedNodeIds.includes(item.nodeId));
  const batchItems = selectedItems.slice(0, CLEANUP_BATCH_SIZE);
  const selectableItems = visibleItems.filter(item => !item.locked && !item.insideInstance);
  const allSelected = selectableItems.length > 0 && selectedItems.length === selectableItems.length;
  const partiallySelected = selectedItems.length > 0 && !allSelected;

  function updateSelectedTypes(values: string[]) {
    const next = CLEANUP_RULE_OPTIONS
      .map((option) => option.value)
      .filter((value) => values.includes(value));
    setSelectedTypes(next);
  }

  async function scan() {
    if (scanScope === 'selection' && selection.count === 0) {
      toast('请先选择组件、容器、编组或区域', 'selection');
      return;
    }
    if (selectedTypes.length === 0) {
      toast('请选择扫描类型', 'parameters');
      return;
    }

    setTask('loading', '正在扫描问题图层');
    try {
      const payload: ScanCleanupPayload = {
        scope: scanScope,
        includeLocked: false,
        includeComponentInstanceChildren,
        types: selectedTypes
      };
      const data = await request<PreviewResult<CleanupCandidate>, ScanCleanupPayload>('SCAN_CLEANUP', payload);
      setPreviewSnapshot(createPreviewSnapshot(data, payload, cleanupSelectionSignature, cleanupParameterSignature));
      setSelectedNodeIds(data.items.filter(item => !item.locked && !item.insideInstance).map((item) => item.nodeId));
      setSucceededNodeIds([]);
      setFailureReasons({});
      setHasCompletedBatch(false);
      setExecutionStateUnknown(false);
      setTask('success', `发现 ${data.total} 个可清理对象`);
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', messageOf(error));
    }
  }

  function run() {
    if (!previewSnapshot?.result.items.length || !batchItems.length || previewStale || executionStateUnknown) return;
    const snapshot = previewSnapshot;
    const items = batchItems;
    const remainingAfterThisBatch = selectedItems.length - items.length;
    const selectedRuleLabels = cleanupRuleLabels(snapshot.params.types);
    confirm({
      title: selectedItems.length > CLEANUP_BATCH_SIZE ? '确认分批清理图层' : '确认清理图层',
      summary: `将按“${selectedRuleLabels}”清理本批 ${items.length} 个对象。`,
      details: remainingAfterThisBatch
        ? [{ label: '执行范围', value: `完成后仍有 ${remainingAfterThisBatch} 个待继续清理` }]
        : [],
      confirmText: selectedItems.length > CLEANUP_BATCH_SIZE ? `确认清理本批 ${items.length} 个` : '确认清理',
      tone: 'danger',
      onConfirm: async () => {
        setTask('loading', `正在清理本批 ${items.length} 个图层`);
        try {
          const data = await request<RunCleanupResult, RunCleanupPayload>('RUN_CLEANUP', {
            nodeIds: items.map((item) => item.nodeId),
            types: snapshot.params.types,
            includeComponentInstanceChildren: snapshot.params.includeComponentInstanceChildren,
            confirmed: true
          });
          const processedNodeIds = new Set([
            ...data.successNodeIds,
            ...data.failedItems.map((item) => item.nodeId)
          ]);
          const remainingNodeIds = selectedNodeIds.filter((nodeId) => !processedNodeIds.has(nodeId));
          setSucceededNodeIds((current) => [...new Set([...current, ...data.successNodeIds])]);
          setFailureReasons((current) => ({
            ...current,
            ...Object.fromEntries(data.failedItems.map((item) => [item.nodeId, item.reason]))
          }));
          setSelectedNodeIds(remainingNodeIds);
          setHasCompletedBatch(true);
          setTask(data.cancelled ? 'cancelled' : 'success', `${data.message}${remainingNodeIds.length ? `，待继续 ${remainingNodeIds.length} 个` : ''}`);
        } catch (error) {
          setExecutionStateUnknown(true);
          setSelectedNodeIds([]);
          if (isOperationCancelled(error)) {
            setTask('error', '清理已取消，部分节点可能已处理。请重新扫描后再继续。');
          } else {
            setTask('error', '清理状态未知，请重新扫描后再继续。');
          }
        }
      }
    });
  }

  function clearPreview() {
    setPreviewSnapshot(null);
    setSelectedNodeIds([]);
    setSucceededNodeIds([]);
    setFailureReasons({});
    setHasCompletedBatch(false);
    setExecutionStateUnknown(false);
    setTask('idle', '等待操作');
  }

  function resetRules() {
    setScanScope('selection');
    setSelectedTypes([]);
    setIncludeComponentInstanceChildren(false);
    setPreviewSnapshot(null);
    setSelectedNodeIds([]);
    setSucceededNodeIds([]);
    setFailureReasons({});
    setHasCompletedBatch(false);
    setExecutionStateUnknown(false);
    setTask('idle', '等待操作');
  }

  return (
    <div className="page">
      <Panel title="扫描规则">
        {renderFeedback('selection')}
        {renderFeedback('parameters')}
        <div className="form-grid">
          <SelectField
            label="扫描范围"
            value={scanScope}
            onChange={(event) => setScanScope(event.target.value as ScanCleanupPayload['scope'])}
          >
            {CLEANUP_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
          <MultiSelectField
            label="扫描类型"
            value={selectedTypes}
            options={CLEANUP_RULE_OPTIONS}
            placeholder="请选择扫描类型"
            onChange={updateSelectedTypes}
          />
        </div>
        <div className="cleanup-instance-row">
          <div className="cleanup-instance-field">
            <span className="cleanup-instance-label">组件实例内部：</span>
            <div className="cleanup-instance-options" role="radiogroup" aria-label="组件实例内部">
              {CLEANUP_INSTANCE_OPTIONS.map((option) => (
                <label className="cleanup-instance-option" key={option.value}>
                  <input
                    type="radio"
                    name="cleanup-instance-children"
                    value={option.value}
                    checked={includeComponentInstanceChildren === (option.value === 'include')}
                    onChange={() => setIncludeComponentInstanceChildren(option.value === 'include')}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div className="cleanup-instance-actions">
            <Button onClick={resetRules}>重置</Button>
            <Button variant="primary" onClick={scan}>扫描</Button>
          </div>
        </div>
      </Panel>
      {previewStale ? <NoticeBar state="warning" text="配置或选区已变更，请重新生成预览。"/> : null}
      {executionStateUnknown ? <NoticeBar state="warning" text="清理中断后无法确认已处理项，请重新扫描后再继续。"/> : null}
      <CleanupTable
        allSelected={allSelected}
        batchCount={batchItems.length}
        canRun={Boolean(batchItems.length) && !previewStale && !executionStateUnknown}
        failureReasons={failureReasons}
        hasCompletedBatch={hasCompletedBatch}
        onClear={clearPreview}
        onRun={run}
        onToggleAll={(checked) => {
          setSelectedNodeIds(checked ? selectableItems.map((item) => item.nodeId) : []);
          if (checked) setFailureReasons({});
        }}
        onToggleItem={(nodeId, checked) => {
          setSelectedNodeIds((current) => checked
            ? current.includes(nodeId) ? current : [...current, nodeId]
            : current.filter((id) => id !== nodeId));
          if (checked) {
            setFailureReasons((current) => {
              const { [nodeId]: _removed, ...next } = current;
              return next;
            });
          }
        }}
        partiallySelected={partiallySelected}
        preview={preview}
        items={visibleItems}
        feedback={!previewStale ? renderFeedback('result') : null}
        remainingCount={selectedItems.length}
        selectedNodeIds={selectedNodeIds}
      />
    </div>
  );
}

function CleanupTable({
  allSelected,
  batchCount,
  preview,
  items,
  canRun,
  failureReasons,
  hasCompletedBatch,
  onClear,
  onRun,
  onToggleAll,
  onToggleItem,
  partiallySelected,
  remainingCount,
  selectedNodeIds,
  feedback
}: {
  allSelected: boolean;
  batchCount: number;
  preview: PreviewResult<CleanupCandidate> | null;
  items: CleanupCandidate[];
  canRun: boolean;
  failureReasons: Record<string, string>;
  hasCompletedBatch: boolean;
  onClear: () => void;
  onRun: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleItem: (nodeId: string, checked: boolean) => void;
  partiallySelected: boolean;
  remainingCount: number;
  selectedNodeIds: string[];
  feedback: ReactElement | null;
}) {
  return (
    <Panel title="扫描结果" meta={items.length > 1 ? <span className="panel-count">{items.length} 个</span> : undefined}>
      {preview ? <p className="panel-note">{cleanupDiagnostics(preview)}</p> : null}
      {preview && remainingCount ? <p className="panel-note">本批将清理 {batchCount} 个，待继续清理 {remainingCount - batchCount} 个。</p> : null}
      <div className="cleanup-result-body" role="region" aria-label={translateUi('预览结果')} tabIndex={0}>
        {items.length ? (
          <table className="batch-result-table cleanup-result-table"><thead><tr><th className="batch-result-check-cell"><Checkbox hitArea ariaLabel="选择全部清理项" checked={allSelected} indeterminate={partiallySelected} onChange={onToggleAll} /></th><th>问题</th><th>对象</th></tr></thead><tbody>{items.map((item) => (
            <tr key={item.nodeId}>
              <td className="batch-result-check-cell"><Checkbox hitArea disabled={item.locked || item.insideInstance} ariaLabel={`选择 ${item.name}`} checked={selectedNodeIds.includes(item.nodeId)} onChange={(checked) => onToggleItem(item.nodeId, checked)} /></td>
              <td>
                {item.reason}
                {item.insideInstance ? <StatusTag tone="warning">组件实例内部</StatusTag> : null}
                {failureReasons[item.nodeId] ? <StatusTag tone="warning">未清理：{failureReasons[item.nodeId]}</StatusTag> : null}
              </td>
              <td><ObjectPreviewItem item={item} compact /></td>
            </tr>
          ))}</tbody></table>
        ) : <EmptyState title="暂无扫描结果" detail="请选择扫描范围和扫描类型后扫描，会展示可清理对象名称和原因。" />}
      </div>
      {feedback}
      <div className="cleanup-result-actions">
        <Button disabled={!preview} onClick={onClear}>清空</Button>
        <Button variant="danger" disabled={!canRun} onClick={onRun}>{hasCompletedBatch && remainingCount ? `继续清理本批 ${batchCount} 个` : remainingCount > CLEANUP_BATCH_SIZE ? `确认清理本批 ${batchCount} 个` : '确认清理'}</Button>
      </div>
    </Panel>
  );
}

function cleanupRuleLabels(types: ScanCleanupPayload['types']): string {
  return CLEANUP_RULE_OPTIONS
    .filter((option) => types.includes(option.value))
    .map((option) => option.label)
    .join('、');
}

function cleanupDiagnostics(preview: PreviewResult<CleanupCandidate>): string {
  const parts = [`已扫描 ${preview.scannedCount ?? preview.total + preview.skipped} 个对象`];
  if (preview.instanceInternalCount) {
    parts.push(`组件实例内部 ${preview.instanceInternalCount} 个默认仅预览`);
  }
  if (preview.skippedLockedCount) {
    parts.push(`跳过锁定 ${preview.skippedLockedCount} 个`);
  }
  if (preview.officialHiddenCount || preview.fallbackHiddenCount || preview.officialLockedCount) {
    const fieldStats: string[] = [];
    if (preview.officialHiddenCount) {
      fieldStats.push(`官方隐藏字段 ${preview.officialHiddenCount} 个`);
    }
    if (preview.fallbackHiddenCount) {
      fieldStats.push(`兼容隐藏字段 ${preview.fallbackHiddenCount} 个`);
    }
    if (preview.officialLockedCount) {
      fieldStats.push(`官方锁定字段 ${preview.officialLockedCount} 个`);
    }
    parts.push(fieldStats.join('，'));
  }
  if (preview.traversalMode === 'deep-query') {
    parts.push('已使用深度查询');
  }
  return parts.join('，');
}