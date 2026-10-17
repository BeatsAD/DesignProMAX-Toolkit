import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { KnownMessageType } from '../../../shared/messages';
import type { SelectionSnapshot, TaskState } from '../../../shared/types';
import { clampBounds, detectSplitRegions, SPLIT_MAX_REGIONS, type SplitBounds, type SplitRegion, type SplitSource, type SplitWritePayload, type SplitWriteResult } from '../../../shared/image-split';
import { Button, Checkbox, EmptyState, Field, IconButton, NoticeBar, Panel, SelectField, StatusTag, type ConfirmDialogInput } from '../../../ui/components/ui';
import { renderNoFeedback, type FeedbackNotifier, type FeedbackRenderer, type FeedbackScope } from '../../../ui/feedback';
import { checkCancelled, decodeSplitSource, downloadSplitBlob, generateSplitOutputs, type DecodedSplitSource, type SplitOutput } from '../image-processing';
import { SplitPreview } from './SplitPreview';
import './ImageSplitPage.css';

type Props = {
  request: <T, P = unknown>(type: KnownMessageType, payload?: P, options?: { signal?: AbortSignal; deferCancellation?: boolean }) => Promise<T>;
  selection: SelectionSnapshot; task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  toast: FeedbackNotifier; confirm: (input: ConfirmDialogInput) => void; renderFeedback?: FeedbackRenderer;
  getTaskSignal?: () => AbortSignal | undefined;
};
type Draft = { regions: SplitRegion[]; selected: string[]; active: string };
type WriteState = { nodeId?: string; unknown?: boolean; error?: string };
const boundsEqual = (a: SplitRegion[], b: SplitRegion[]) => JSON.stringify(a.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))) === JSON.stringify(b.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })));
const outputKey = (source: SplitSource, bounds: SplitBounds) => `${source.nodeId}:${source.fingerprint}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;

export default function ImageSplitPage({ request, selection, task, setTask, toast, confirm, renderFeedback = renderNoFeedback, getTaskSignal }: Props) {
  const [padding, setPadding] = useState(0);
  const [source, setSource] = useState<SplitSource>(), [sourceUrl, setSourceUrl] = useState('');
  const [regions, setRegions] = useState<SplitRegion[]>([]), [candidates, setCandidates] = useState<string[]>([]), [active, setActive] = useState('');
  const [draft, setDraft] = useState<Draft>(), [drawing, setDrawing] = useState(false), [mergeTarget, setMergeTarget] = useState('');
  const [scale, setScale] = useState(1), [showBounds, setShowBounds] = useState(true);
  const [outputs, setOutputs] = useState<SplitOutput[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [warning, setWarning] = useState(''), [busy, setBusy] = useState(false), [sourceStale, setSourceStale] = useState(false), [outputStale, setOutputStale] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; name: string; output?: SplitOutput }>();
  const decoded = useRef<DecodedSplitSource | undefined>(undefined), outputRef = useRef<SplitOutput[]>([]);
  const recognized = useRef<SplitRegion[]>([]), writes = useRef(new Map<string, WriteState>());
  const operation = useRef<AbortController | undefined>(undefined), serial = useRef(0), manualId = useRef(0), inserting = useRef(false);
  const selectionKey = `${selection.count}:${selection.nodes.map(n => n.id).join('|')}`;
  const previousSelection = useRef(selectionKey), latestSelection = useRef(selection.nodes.map(n => n.id)), allowedInsertedSelection = useRef<string[]>([]);
  latestSelection.current = selection.nodes.map(n => n.id);
  const gesture = useRef<(() => void) | undefined>(undefined), dialogRef = useRef<HTMLDialogElement>(null);
  const visibleRegions = draft?.regions ?? regions, candidateIds = draft?.selected ?? candidates, activeId = draft?.active ?? active;
  const activeRegion = visibleRegions.find(r => r.id === activeId);
  const chosen = outputs.filter(o => selected.includes(o.id)), writable = chosen.filter(o => !o.inserted && !o.unknown);
  const ready = !busy && !sourceStale, resultReady = ready && !draft && !outputStale;

  function releaseOutputs() {
    outputRef.current.forEach(o => URL.revokeObjectURL(o.url)); outputRef.current = [];
    setOutputs([]); setSelected([]); setZoom(undefined); setOutputStale(false);
  }
  function cancelOperation() { serial.current++; operation.current?.abort(); setBusy(false); }
  function cancelEditing() { gesture.current?.(); setDraft(undefined); setDrawing(false); setMergeTarget(''); }
  function markOutputStale() { serial.current++; if (outputRef.current.length) setOutputStale(true); }
  useEffect(() => () => { gesture.current?.(); operation.current?.abort(); serial.current++; decoded.current?.dispose(); outputRef.current.forEach(o => URL.revokeObjectURL(o.url)); }, []);
  useEffect(() => {
    if (previousSelection.current === selectionKey) return;
    previousSelection.current = selectionKey;
    const ids = selection.nodes.map(n => n.id);
    if (inserting.current || (ids.length > 0 && ids.every(id => allowedInsertedSelection.current.includes(id)))) return;
    allowedInsertedSelection.current = []; gesture.current?.(); setDraft(undefined); setDrawing(false);
    serial.current++; operation.current?.abort(); setBusy(false); setSourceStale(true); setWarning(''); setZoom(undefined);
    setTask('idle', '选区已变化，请重新识别');
  }, [selectionKey, selection.nodes, setTask]);
  useEffect(() => {
    if (!draft) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dialogRef.current?.open) return;
      event.preventDefault();
      if (gesture.current) gesture.current(); else cancelEditing();
    };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [Boolean(draft)]);
  useEffect(() => { if (zoom) dialogRef.current?.showModal(); }, [zoom]);

  function begin(text: string) {
    operation.current?.abort(); const controller = new AbortController(); operation.current = controller;
    setTask('loading', text);
    const hostSignal = getTaskSignal?.(), abort = () => controller.abort(); hostSignal?.addEventListener('abort', abort, { once: true });
    if (hostSignal?.aborted) controller.abort();
    const generation = ++serial.current; setBusy(true);
    return { signal: controller.signal, current: () => generation === serial.current, valid: () => generation === serial.current && !controller.signal.aborted,
      finish: () => { hostSignal?.removeEventListener('abort', abort); if (generation === serial.current) setBusy(false); } };
  }
  function failure(error: unknown, signal?: AbortSignal) {
    const text = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
    if (signal?.aborted) setTask('idle', '已取消');
    else { setWarning(text); setTask('error', text, 'result'); if (text.includes('原图已变化')) setSourceStale(true); }
  }
  async function recognize() {
    if (busy || draft) return;
    if (selection.count !== 1) { toast('请在画布中只选中一张图片', 'selection'); return; }
    const run = begin('正在自动识别'); releaseOutputs(); setWarning(''); setSourceStale(true);
    let next: DecodedSplitSource | undefined;
    try {
      const snapshot = await request<SplitSource>('SCAN_IMAGE_SPLIT_SOURCE', { nodeId: selection.nodes[0].id }, { signal: run.signal });
      next = await decodeSplitSource(snapshot, run.signal); checkCancelled(run.signal);
      const result = detectSplitRegions(next.pixels.data, next.pixels.width, next.pixels.height, snapshot.width, snapshot.height);
      if (!run.valid()) { next.dispose(); return; }
      decoded.current?.dispose(); decoded.current = next; next = undefined;
      recognized.current = result.regions.map(r => ({ ...r }));
      setSource(snapshot); setSourceUrl(decoded.current.url); setRegions(result.regions); setCandidates(result.regions.map(r => r.id)); setActive(result.regions[0]?.id ?? '');
      setScale(1); setShowBounds(true); setSourceStale(false); allowedInsertedSelection.current = [];
      setWarning(result.regions.length ? '' : result.warning ?? '未识别到区域，可在调整范围中补框');
      setTask('success', `已识别 ${result.regions.length} 个`, 'result');
    } catch (error) { next?.dispose(); if (run.current()) failure(error, run.signal); } finally { run.finish(); }
  }
  function changeCandidates(next: string[]) {
    if (draft) setDraft({ ...draft, selected: next }); else { setCandidates(next); markOutputStale(); }
  }
  function changeActive(id: string) { if (draft) setDraft({ ...draft, active: id }); else setActive(id); setMergeTarget(''); }
  function changeDraftRegions(next: SplitRegion[]) {
    setDraft(prev => prev ? { ...prev, regions: next, selected: prev.selected.filter(id => next.some(r => r.id === id)), active: next.some(r => r.id === prev.active) ? prev.active : next[0]?.id ?? '' } : prev);
  }
  function startEditing() { serial.current++; setDraft({ regions: regions.map(r => ({ ...r })), selected: [...candidates], active }); setShowBounds(true); setMergeTarget(''); }
  function finishEditing() {
    if (!draft || gesture.current) return;
    if (!boundsEqual(regions, draft.regions) || candidates.join('|') !== draft.selected.join('|')) markOutputStale();
    setRegions(draft.regions); setCandidates(draft.selected); setActive(draft.active); setDraft(undefined); setDrawing(false); setMergeTarget('');
  }
  function editBounds(key: 'x' | 'y' | 'width' | 'height', value: number) {
    if (!source || !activeRegion || !Number.isFinite(value)) return;
    changeDraftRegions(visibleRegions.map(r => r.id === activeId ? { ...r, ...clampBounds({ ...r, [key]: value }, source.width, source.height), confirmed: true } : r));
  }
  function addDrawnRegion(bounds: SplitBounds) {
    if (!draft || draft.regions.length >= SPLIT_MAX_REGIONS) return;
    const id = `manual-${++manualId.current}`;
    setDraft({ regions: [...draft.regions, { ...bounds, id, confirmed: true }], selected: [...draft.selected, id], active: id }); setDrawing(false);
  }
  function restoreRegions() {
    gesture.current?.(); const next = recognized.current.map(r => ({ ...r }));
    setDraft({ regions: next, selected: next.map(r => r.id), active: next[0]?.id ?? '' }); setDrawing(false); setMergeTarget('');
  }
  function splitActive(axis: 'x' | 'y') {
    if (!draft || !activeRegion || visibleRegions.length >= SPLIT_MAX_REGIONS) return;
    const sizeKey = axis === 'x' ? 'width' : 'height', size = activeRegion[sizeKey]; if (size < 2) return;
    const half = Math.floor(size / 2), id = `manual-${++manualId.current}`;
    const first = { ...activeRegion, confirmed: true, [sizeKey]: half }, second = { ...activeRegion, id, confirmed: true, [axis]: activeRegion[axis] + half, [sizeKey]: size - half };
    setDraft({ ...draft, regions: visibleRegions.flatMap(r => r.id === activeId ? [first, second] : [r]), selected: candidateIds.includes(activeId) ? [...candidateIds, id] : candidateIds });
  }
  function mergeRegions() {
    if (!draft || !activeRegion) return;
    const b = visibleRegions.find(r => r.id === mergeTarget); if (!b || b.id === activeId) return;
    const a = activeRegion, x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const merged = { ...a, x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y, confirmed: true };
    const ids = candidateIds.filter(id => id !== b.id);
    if (candidateIds.includes(b.id) && !ids.includes(a.id)) ids.push(a.id);
    setDraft({ ...draft, regions: visibleRegions.flatMap(r => r.id === a.id ? [merged] : r.id === b.id ? [] : [r]), selected: ids }); setMergeTarget('');
  }
  async function generate() {
    if (!source || !decoded.current || !ready || draft || !candidates.length) return;
    const confirmed = regions.filter(r => candidates.includes(r.id)).map(r => ({ ...r, confirmed: true }));
    setRegions(prev => prev.map(r => candidates.includes(r.id) ? { ...r, confirmed: true } : r));
    const run = begin('正在生成分割图片'); releaseOutputs(); setWarning('');
    try {
      const result = await generateSplitOutputs(decoded.current, confirmed, source.nodeName, padding, run.signal);
      if (!run.valid()) { result.forEach(o => URL.revokeObjectURL(o.url)); return; }
      const next = result.map(o => { const written = writes.current.get(outputKey(source, o.bounds)); return written ? { ...o, inserted: Boolean(written.nodeId), unknown: written.unknown, error: written.error } : o; });
      outputRef.current = next; setOutputs(next); setSelected(next.map(o => o.id));
      setTask('success', `已生成 ${next.length} 张 PNG`, 'result');
    } catch (error) { if (run.current()) failure(error, run.signal); } finally { run.finish(); }
  }
  function insert() {
    if (!source || !resultReady || !writable.length) return;
    const snapshot = source, items = writable, generation = serial.current;
    confirm({ title: '插入分割图片', summary: `将新建 ${items.length} 个图片图层。`, confirmText: '确认插入', onConfirm: () => {
      if (generation !== serial.current || snapshot !== source || !resultReady) { toast('结果已变化，请重新核对', 'result'); return; }
      void apply(snapshot, items);
    } });
  }
  async function apply(snapshot: SplitSource, items: SplitOutput[]) {
    const run = begin('正在插入分割图片'); inserting.current = true; let currentItem: SplitOutput | undefined;
    const result: SplitWriteResult = { items: [], cancelled: false };
    try {
      for (const o of items) {
        if (run.signal.aborted) { result.cancelled = true; break; }
        currentItem = o;
        // Retain the host acknowledgement before stopping the remaining writes.
        const one = await request<SplitWriteResult, SplitWritePayload>('APPLY_IMAGE_SPLIT', {
          confirmed: true, source: { sourceToken: snapshot.sourceToken ?? '', nodeId: snapshot.nodeId, fingerprint: snapshot.fingerprint, width: snapshot.width, height: snapshot.height },
          items: [{ id: o.id, name: o.name, bounds: o.bounds, imageBytes: Array.from(o.bytes) }]
        }, { deferCancellation: true });
        result.items.push(...one.items); currentItem = undefined;
        const acknowledged = one.items.find(i => i.id === o.id);
        if (acknowledged?.nodeId) {
          writes.current.set(outputKey(snapshot, o.bounds), { nodeId: acknowledged.nodeId });
          allowedInsertedSelection.current.push(acknowledged.nodeId);
        }
        outputRef.current = outputRef.current.map(item => item.id === o.id ? { ...item, inserted: Boolean(acknowledged?.nodeId), error: acknowledged?.error ?? (!acknowledged ? '未收到写入结果，请核对画布' : undefined), unknown: !acknowledged } : item);
        if (!acknowledged) writes.current.set(outputKey(snapshot, o.bounds), { unknown: true, error: '未收到写入结果，请核对画布' });
        setOutputs(outputRef.current);
        const ids = latestSelection.current;
        if (!ids.length || !ids.every(id => id === snapshot.nodeId || allowedInsertedSelection.current.includes(id))) { setSourceStale(true); result.cancelled = true; break; }
        if (!acknowledged || one.cancelled || one.items.some(i => i.error?.includes('原图已变化')) || run.signal.aborted) { result.cancelled = true; break; }
      }
      if (result.items.some(i => i.error?.includes('原图已变化'))) setSourceStale(true);
      const count = result.items.filter(i => i.nodeId).length, failures = result.items.filter(i => i.error).length;
      setTask(failures ? 'error' : result.cancelled ? 'idle' : 'success', `已插入 ${count} 张${failures ? `，失败 ${failures} 张` : ''}${result.cancelled ? '，后续已停止' : ''}`, 'result');
    } catch (error) {
      if (currentItem && error && typeof error === 'object' && 'code' in error && (error.code === 'REQUEST_TIMEOUT' || error.code === 'OPERATION_CANCELLED' || error.code === 'WRITE_STATE_UNKNOWN')) {
        const state = { unknown: true, error: '写入结果待核对，请检查画布' };
        writes.current.set(outputKey(snapshot, currentItem.bounds), state);
        outputRef.current = outputRef.current.map(o => o.id === currentItem!.id ? { ...o, ...state } : o); setOutputs(outputRef.current);
      }
      failure(error, run.signal);
    } finally { inserting.current = false; run.finish(); }
  }
  return <div className={`image-split-page ${source ? 'has-source' : ''}`}>
    <div className="two-col">
      <Panel title="分割对象">
        {selection.count === 1 ? <p className="image-split-name" title={selection.nodes[0].name}>{selection.nodes[0].name}</p> : <EmptyState title="请选择一张图片" detail="在画布中选择图片图层" />}
        {renderFeedback('selection')}
      </Panel>
      <Panel title="分割设置">
        <div className="image-split-settings">
          <Field label="留白"><div className="image-split-unit"><input aria-label="留白" type="number" min="0" max="100" step="1" value={padding} disabled={busy || Boolean(draft)} onChange={e => { setPadding(Math.min(100, Math.max(0, Math.round(Number(e.target.value))))); markOutputStale(); }} /><span>px</span></div></Field>
          <Button variant="primary" disabled={busy || Boolean(draft) || selection.count !== 1} onClick={() => void recognize()}>自动识别</Button>
        </div>
        {renderFeedback('parameters')}
      </Panel>
    </div>
    {source && <Panel title="分割预览">
      {sourceStale && <NoticeBar state="warning" text="选区已变化，请重新识别" />}
      {warning && <NoticeBar state="warning" text={warning} />}
      <div className="image-split-toolbar">
        <IconButton icon={Maximize} ariaLabel="适应窗口" onClick={() => setScale(1)} />
        <IconButton icon={ZoomOut} ariaLabel="缩小预览" disabled={scale <= 0.5} onClick={() => setScale(v => Math.max(0.5, v - 0.25))} />
        <IconButton icon={ZoomIn} ariaLabel="放大预览" disabled={scale >= 3} onClick={() => setScale(v => Math.min(3, v + 0.25))} />
        <IconButton icon={showBounds ? Eye : EyeOff} ariaLabel="显示边界" pressed={showBounds} disabled={Boolean(draft)} onClick={() => setShowBounds(v => !v)} />
        {!draft && <Button disabled={!ready} onClick={startEditing}>调整范围</Button>}
      </div>
      <SplitPreview source={source} url={sourceUrl} regions={visibleRegions} active={activeId} editable={Boolean(draft) && ready} drawing={drawing} visible={showBounds} scale={scale} gesture={gesture} onActive={changeActive} onChange={changeDraftRegions} onDraw={addDrawnRegion} />
      <div className="image-split-select-all"><Checkbox ariaLabel="全选分割区域" checked={visibleRegions.length > 0 && candidateIds.length === visibleRegions.length} indeterminate={candidateIds.length > 0 && candidateIds.length < visibleRegions.length} disabled={!ready} onChange={v => changeCandidates(v ? visibleRegions.map(r => r.id) : [])} /><span>已选择 {candidateIds.length} / {visibleRegions.length}</span></div>
      <div className="image-split-region-list">{visibleRegions.map((r, i) => <div className="image-split-region-row" key={r.id}>
        <Checkbox ariaLabel={`选择区域 ${i + 1}`} checked={candidateIds.includes(r.id)} disabled={!ready} onChange={v => changeCandidates(v ? [...candidateIds, r.id] : candidateIds.filter(id => id !== r.id))} />
        <button type="button" aria-pressed={activeId === r.id} disabled={!ready} onClick={() => changeActive(r.id)}>区域 {i + 1}<span className="image-split-meta">{r.width} × {r.height}</span></button>
        {!r.confirmed && <StatusTag tone="neutral">待核对</StatusTag>}
      </div>)}</div>
      {draft && <div className="image-split-editor">
        {activeRegion && <div className="image-split-fields">{(['x', 'y', 'width', 'height'] as const).map(key => <Field key={key} label={{ x: 'X', y: 'Y', width: '宽度', height: '高度' }[key]}><input aria-label={`区域${key}`} type="number" step="1" value={activeRegion[key]} disabled={!ready || drawing} onChange={e => editBounds(key, Number(e.target.value))} /></Field>)}</div>}
        <div className="image-split-actions"><Button pressed={drawing} disabled={!ready || visibleRegions.length >= SPLIT_MAX_REGIONS} onClick={() => setDrawing(v => !v)}>补框</Button><Button disabled={!ready || !activeRegion} onClick={() => changeDraftRegions(visibleRegions.filter(r => r.id !== activeId))}>删除区域</Button><Button disabled={!ready} onClick={restoreRegions}>恢复识别</Button></div>
        <details><summary>更多操作</summary><div className="image-split-actions"><Button disabled={!ready || !activeRegion || visibleRegions.length >= SPLIT_MAX_REGIONS || activeRegion.width < 2} onClick={() => splitActive('x')}>左右拆分</Button><Button disabled={!ready || !activeRegion || visibleRegions.length >= SPLIT_MAX_REGIONS || activeRegion.height < 2} onClick={() => splitActive('y')}>上下拆分</Button></div><div className="image-split-merge"><SelectField label="合并目标" value={mergeTarget} disabled={!ready || !activeRegion} onChange={e => setMergeTarget(e.target.value)}><option value="">选择区域</option>{visibleRegions.filter(r => r.id !== activeId).map(r => <option key={r.id} value={r.id}>区域 {visibleRegions.indexOf(r) + 1}</option>)}</SelectField><Button disabled={!ready || !mergeTarget} onClick={mergeRegions}>合并</Button></div></details>
        {drawing && <span className="image-split-meta">在预览中拖动补框</span>}
        <div className="image-split-actions image-split-end"><Button onClick={cancelEditing}>取消调整</Button><Button variant="primary" disabled={!ready} onClick={finishEditing}>完成调整</Button></div>
      </div>}
      {!outputs.length && renderFeedback('result')}
      <div className="image-split-actions image-split-end"><Button disabled={busy || Boolean(draft) || selection.count !== 1} onClick={() => void recognize()}>重新识别</Button><Button variant="primary" disabled={!ready || Boolean(draft) || !candidateIds.length} onClick={() => void generate()}>生成分割（{candidateIds.length}）</Button></div>
    </Panel>}
    {outputs.length > 0 && <Panel title="输出结果">
      {outputStale && !sourceStale && <NoticeBar state="warning" text="范围已变化，请重新生成" />}
      <div className="image-split-select-all"><Checkbox ariaLabel="全选分割结果" checked={chosen.length === outputs.length} indeterminate={chosen.length > 0 && chosen.length < outputs.length} disabled={!resultReady} onChange={v => { setSelected(v ? outputs.map(o => o.id) : []); serial.current++; }} /><span>已选择 {chosen.length} / {outputs.length}</span></div>
      <div className="image-split-results">{outputs.map(o => <article key={o.id}>
        <Checkbox ariaLabel={`选择 ${o.name}`} checked={selected.includes(o.id)} disabled={!resultReady} onChange={v => { setSelected(prev => v ? [...prev, o.id] : prev.filter(id => id !== o.id)); serial.current++; }} />
        <button type="button" className="image-split-thumb" aria-label={`放大 ${o.name}`} onClick={() => setZoom({ url: o.url, name: o.name, output: o })}><img src={o.url} alt={o.name} /></button>
        <div className="image-split-result-copy"><span className="image-split-name" title={o.name}>{o.name}</span><span className="image-split-meta">{o.bounds.width} × {o.bounds.height} · PNG</span>{o.inserted && <StatusTag tone="success">已插入</StatusTag>}{o.error && <span className="image-split-result-error" role="alert">{o.error}</span>}</div>
      </article>)}</div>
      {renderFeedback('result')}
      <div className="image-split-actions image-split-end"><Button disabled={busy || Boolean(draft)} onClick={() => { serial.current++; releaseOutputs(); setWarning(''); setTask('idle', ''); }}>清空</Button><Button variant="primary" disabled={!resultReady || !writable.length} onClick={insert}>插入画布</Button></div>
    </Panel>}
    {busy && <Button onClick={() => { operation.current?.abort(); if (!inserting.current) cancelOperation(); setTask('idle', inserting.current ? '正在取消后续插入' : '已取消'); }}>{inserting.current ? '取消后续插入' : '取消处理'}</Button>}
    {task.state === 'error' && !source && renderFeedback('result')}
    {zoom && <dialog ref={dialogRef} className="image-split-zoom" onCancel={() => setZoom(undefined)}><div className="image-split-actions"><span className="image-split-name">{zoom.name}</span>{zoom.output && <Button onClick={() => downloadSplitBlob(new Blob([new Uint8Array(zoom.output!.bytes)], { type: 'image/png' }), zoom.name)}>下载 PNG</Button>}<Button onClick={() => { dialogRef.current?.close(); setZoom(undefined); }}>关闭</Button></div><img src={zoom.url} alt={zoom.name} /></dialog>}
  </div>;
}
