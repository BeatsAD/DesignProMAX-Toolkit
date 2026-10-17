import { useEffect, useState } from 'react';
import { isOperationCancelled } from "../../../shared/messages";
import type { PreviewSizeFitPayload, PreviewScalePayload, RunSizeFitPayload, RunScalePayload, SizeFitAxis, SizeFitStrategy } from "../../../shared/messages";
import type { PreviewResult, ScalePreviewItem, SelectionSnapshot, SizeFitPreviewItem } from "../../../shared/types";
import { Button, Checkbox, EmptyState, NoticeBar, Field, ObjectPreviewItem, Panel, SegmentedControl, SelectField, StatusTag } from "../../../ui/components/ui";
import { renderNoFeedback } from "../../../ui/feedback";
import { createParameterSignature, createPreviewSnapshot, createSelectionSignature, isPreviewSnapshotStale, type PreviewSnapshot } from "../../../ui/preview-snapshot";
import { ToolPageProps, messageOf } from '../../../ui/pages/tool-page-shared';
type ScaleToolTab = 'proportional' | 'fitSize';
export default function ScalePage({ request, selection, task, setTask, toast, renderFeedback = renderNoFeedback, confirm }: ToolPageProps) {
    const [fitTargetWidth, setFitTargetWidth] = useState(1200);
    const [fitTargetHeight, setFitTargetHeight] = useState(900);
    const [fitAxis, setFitAxis] = useState<SizeFitAxis>('width');
    const [fitStrategy, setFitStrategy] = useState<SizeFitStrategy>('smart');
    const [fitPreviewSnapshot, setFitPreviewSnapshot] = useState<PreviewSnapshot<PreviewResult<SizeFitPreviewItem>, PreviewSizeFitPayload> | null>(null);
    const [selectedFitNodeIds, setSelectedFitNodeIds] = useState<string[]>([]);
    const selectionSignature = createSelectionSignature(selection);
    const fitPreview = fitPreviewSnapshot?.result ?? null;
    const fitPreviewStale = isPreviewSnapshotStale(fitPreviewSnapshot, selectionSignature, createParameterSignature(fitTargetWidth, fitTargetHeight, fitAxis, fitStrategy));
    const runnableFitItems = fitPreview?.items.filter((item) => item.canRun) ?? [];
    const selectedFitItems = runnableFitItems.filter((item) => selectedFitNodeIds.includes(item.nodeId));
    const allFitItemsSelected = Boolean(runnableFitItems.length) && selectedFitItems.length === runnableFitItems.length;
    const someFitItemsSelected = selectedFitItems.length > 0 && !allFitItemsSelected;
    const fitCanRun = Boolean(selectedFitItems.length) && !fitPreviewStale;
    useEffect(() => {
        if (selection.count !== 1)
            return;
        const selected = selection.nodes[0];
        setFitTargetWidth(isPositiveDimension(selected.width ?? 0) ? selected.width as number : 1200);
        setFitTargetHeight(isPositiveDimension(selected.height ?? 0) ? selected.height as number : 900);
        setFitPreviewSnapshot(null);
        setSelectedFitNodeIds([]);
    }, [selectionSignature, selection.nodes[0]?.width, selection.nodes[0]?.height]);
    async function makeFitPreview() {
        if (selection.count !== 1) {
            toast(selection.count ? '尺寸适配一次仅支持一个根容器' : '请先选择要适配的对象', 'selection');
            return;
        }
        const widthValid = fitAxis === 'height' || isPositiveDimension(fitTargetWidth);
        const heightValid = fitAxis === 'width' || isPositiveDimension(fitTargetHeight);
        if (!widthValid || !heightValid) {
            toast('请输入当前适配方向所需的有效尺寸', 'parameters');
            return;
        }
        setTask('loading', '正在计算适配结果');
        try {
            const payload: PreviewSizeFitPayload = {
                nodeIds: selection.nodes.map((node) => node.id),
                targetWidth: fitTargetWidth,
                targetHeight: fitTargetHeight,
                axis: fitAxis,
                strategy: fitStrategy
            };
            const data = await request<PreviewResult<SizeFitPreviewItem>, PreviewSizeFitPayload>('PREVIEW_SIZE_FIT', payload);
            setFitPreviewSnapshot(createPreviewSnapshot(data, payload, selectionSignature, createParameterSignature(fitTargetWidth, fitTargetHeight, fitAxis, fitStrategy)));
            setSelectedFitNodeIds(data.items.filter((item) => item.canRun).map((item) => item.nodeId));
            setTask('success', `已生成 ${data.total} 个适配预览`);
        }
        catch (error) {
            if (!isOperationCancelled(error))
                setTask('error', messageOf(error));
        }
    }
    function runFit() {
        if (!fitPreviewSnapshot?.result.items.some((item) => item.canRun) || !selectedFitItems.length || fitPreviewStale)
            return;
        const snapshot = fitPreviewSnapshot;
        const runnableCount = selectedFitItems.length;
        const movedCount = selectedFitItems.reduce((sum, item) => sum + item.movedCount, 0);
        const resizedCount = selectedFitItems.reduce((sum, item) => sum + item.resizedCount, 0);
        const frozenCount = selectedFitItems.reduce((sum, item) => sum + (item.frozenCount ?? 0), 0);
        const warnings = Array.from(new Set(selectedFitItems.flatMap((item) => item.warnings)));
        confirm({
            title: '确认执行尺寸适配',
            summary: `将使用“${sizeFitStrategyLabel(snapshot.params.strategy)}”适配 ${runnableCount} 个根容器。`,
            details: [
                { label: '适配方向', value: sizeFitAxisLabel(snapshot.params.axis) },
                { label: '计划移动', value: `${movedCount} 个图层` },
                { label: '调整尺寸', value: `${resizedCount} 个图层` },
                { label: '冻结区域', value: `${frozenCount} 个` }
            ],
            warnings,
            confirmText: '执行适配',
            tone: 'warning',
            onConfirm: async () => {
                setTask('loading', '正在适配对象尺寸');
                try {
                    const payload: RunSizeFitPayload = { ...snapshot.params, nodeIds: selectedFitItems.map((item) => item.nodeId), confirmed: true };
                    const data = await request<{
                        message: string;
                    }, RunSizeFitPayload>('RUN_SIZE_FIT', payload);
                    setTask(('cancelled' in data && data.cancelled) ? 'cancelled' : 'success', data.message);
                }
                catch (error) {
                    if (!isOperationCancelled(error))
                        setTask('error', messageOf(error));
                }
            }
        });
    }
    function clearFitPreview() {
        setFitPreviewSnapshot(null);
        setSelectedFitNodeIds([]);
        setTask('idle', '等待操作');
    }
    function resetFitParams() {
        const selected = selection.count === 1 ? selection.nodes[0] : undefined;
        setFitTargetWidth(selected?.width ?? 1200);
        setFitTargetHeight(selected?.height ?? 900);
        setFitAxis('width');
        setFitStrategy('smart');
        setFitPreviewSnapshot(null);
        setSelectedFitNodeIds([]);
        setTask('idle', '等待操作');
    }
    return (<div className="page scale-page">
      {null}
      {(<>
      <Panel title="选中区域" meta={selection.count > 1 ? <span className="panel-count">{`当前选中 ${selection.count} 个对象`}</span> : undefined}>
        {renderFeedback('selection')}
        <ScaleSelectionPreview selection={selection}/>
      </Panel>
      <Panel title="参数设置">
        {renderFeedback('parameters')}
        <div className="form-grid">
          <SelectField label="适配方向" value={fitAxis} onChange={(event) => setFitAxis(event.target.value as SizeFitAxis)}>
            <option value="width">仅宽度</option>
            <option value="height">仅高度</option>
            <option value="both">宽度和高度</option>
          </SelectField>
          <SelectField label="布局策略" value={fitStrategy} onChange={(event) => setFitStrategy(event.target.value as SizeFitStrategy)}>
            <option value="smart">智能结构适配（推荐）</option>
            <option value="conservative">保守约束适配</option>
          </SelectField>
          <Field label="目标宽度">
            <span className={`scale-value-control ${fitAxis === 'height' ? 'is-locked' : ''}`}>
              <input aria-label="目标宽度" type="number" disabled={fitAxis === 'height'} value={fitTargetWidth} onChange={(event) => setFitTargetWidth(Number(event.target.value))}/>
              <span className="scale-value-unit">px</span>
            </span>
          </Field>
          <Field label="目标高度">
            <span className={`scale-value-control ${fitAxis === 'width' ? 'is-locked' : ''}`}>
              <input aria-label="目标高度" type="number" disabled={fitAxis === 'width'} value={fitTargetHeight} onChange={(event) => setFitTargetHeight(Number(event.target.value))}/>
              <span className="scale-value-unit">px</span>
            </span>
          </Field>
        </div>
        <div className="actions scale-actions"><Button onClick={resetFitParams}>重置</Button><Button variant="primary" onClick={makeFitPreview}>生成预览</Button></div>
      </Panel>
      <section className="panel scale-result-panel size-fit-result-panel">
        <div className="panel-head">
          <h2>结果预览</h2>
        </div>
        {fitPreviewStale ? <NoticeBar state="warning" text="配置或选区已变更，请重新生成预览。"/> : null}
        {fitPreview?.items.length ? (<>
          {fitPreview.items.map((item) => (<div className={`size-fit-plan-summary confidence-${item.confidence}`} key={`${item.nodeId}-summary`}>
              <div><strong>{item.fitModeLabel}</strong>{item.confidence !== 'high' ? <StatusTag tone="warning">{`可信度 ${item.confidenceLabel}`}</StatusTag> : null}</div>
              <span>{`移动 ${item.movedCount} 个 · 调整尺寸 ${item.resizedCount} 个${(item.frozenCount ?? 0) ? ` · 冻结区域 ${item.frozenCount} 个` : ''} · 保持 ${item.preservedCount} 个`}</span>
              {item.blockedReason ? <NoticeBar state="warning" text={item.blockedReason}/> : null}
              {item.warnings.filter((warning) => warning !== item.blockedReason).map((warning) => <div className="size-fit-warning" key={warning}>{warning}</div>)}
              {(item.changes ?? []).length ? (<details className="size-fit-change-details">
                  <summary>查看变更图层明细</summary>
                  <div>
                    {item.changes.slice(0, 8).map((change) => (<span key={change.nodeId}>{formatSizeFitPreviewChange(change)}</span>))}
                    {item.changes.length > 8 ? <span>其余 {item.changes.length - 8} 个变更图层已省略</span> : null}
                  </div>
                </details>) : null}
            </div>))}
          <div className="narrow-result-scroll" role="region" aria-label="结果预览" tabIndex={0}><table className="batch-result-table size-fit-preview-table"><thead><tr><th className="batch-result-check-cell"><Checkbox hitArea ariaLabel="选择全部可执行适配项" checked={allFitItemsSelected} indeterminate={someFitItemsSelected} onChange={(checked) => setSelectedFitNodeIds(checked ? runnableFitItems.map((item) => item.nodeId) : [])}/></th><th>对象</th><th>原尺寸</th><th>目标尺寸</th></tr></thead><tbody>{fitPreview.items.map((item) => {
                    const beforeSize = `${item.beforeWidth} x ${item.beforeHeight}`;
                    const afterSize = `${item.afterWidth} x ${item.afterHeight}`;
                    return (<tr key={item.nodeId}>
                <td className="batch-result-check-cell"><Checkbox hitArea ariaLabel={`选择 ${item.name}`} checked={selectedFitNodeIds.includes(item.nodeId)} disabled={!item.canRun} onChange={(checked) => setSelectedFitNodeIds((current) => checked ? current.includes(item.nodeId) ? current : [...current, item.nodeId] : current.filter((nodeId) => nodeId !== item.nodeId))}/></td>
                <td title={item.name}>{item.name}</td>
                <td title={beforeSize}>{beforeSize}</td>
                <td title={afterSize}>{afterSize}</td>
              </tr>);
                })}</tbody></table></div>
          </>) : <EmptyState title="暂无预览" detail="选择对象并生成预览后再执行适配。"/>}
        {!fitPreviewStale ? renderFeedback('result') : null}
        <div className="scale-result-actions size-fit-result-actions">
          <Button disabled={!fitPreview?.items.length} onClick={clearFitPreview}>清空</Button>
          <Button variant="primary" disabled={!fitCanRun} onClick={runFit}>执行适配</Button>
        </div>
      </section>
        </>)}
    </div>);
}
function isPositiveDimension(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}
function scaleValueUnit(mode: PreviewScalePayload['mode'] | ''): string {
    if (mode === 'percent') {
        return '%';
    }
    if (mode === 'targetWidth' || mode === 'targetHeight') {
        return 'px';
    }
    return '';
}
function scaleModeLabel(mode: PreviewScalePayload['mode']): string {
    return ({ percent: '百分比', targetWidth: '目标宽度', targetHeight: '目标高度' } as const)[mode];
}
function sizeFitAxisLabel(axis: SizeFitAxis): string {
    return ({ width: '仅宽度', height: '仅高度', both: '宽度和高度' } as const)[axis];
}
function sizeFitStrategyLabel(strategy: SizeFitStrategy): string {
    return ({ conservative: '保守适配', smart: '智能结构适配' } as const)[strategy];
}
function formatSizeFitPreviewChange(change: SizeFitPreviewItem['changes'][number]): string {
    const parts: string[] = [];
    if (change.changeType === 'move' || change.changeType === 'moveAndResize') {
        parts.push(`位置 (${change.beforeX ?? 0}, ${change.beforeY ?? 0}) → (${change.afterX ?? 0}, ${change.afterY ?? 0})`);
    }
    if (change.changeType === 'resize' || change.changeType === 'moveAndResize') {
        parts.push(`尺寸 ${change.beforeWidth ?? 0} × ${change.beforeHeight ?? 0} → ${change.afterWidth ?? 0} × ${change.afterHeight ?? 0}`);
    }
    return `${change.name}：${parts.join('；')}`;
}
function ScaleSelectionPreview({ selection }: {
    selection: SelectionSnapshot;
}) {
    return (<section className="scale-selection-preview">
      {selection.count ? (<div className="scale-selection-list">
          {selection.nodes.map((node) => (<ObjectPreviewItem key={node.id} item={node} compact/>))}
        </div>) : (<EmptyState title="暂无选中对象" detail="先在 Figma 中选择要缩放的对象。"/>)}
    </section>);
}
