import {imageWriteErrorMessage} from '../../../../shared/image-write-errors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isOperationCancelled } from "../../../shared/messages";
import type { ApplyTransparentCropResult, ApplyTransparentCropPayload, ImageSourceResult, TransparentCropCandidate, TransparentCropResultItem, TransparentCropWriteItem } from "../../../shared/messages";
import { formatBytes } from "../../../shared/image-compress";
import { Button, Checkbox, EmptyState, ObjectPreviewItem, Panel, StatusTag, type ObjectPreviewData } from "../../../ui/components/ui";
import { cropTransparentPngCandidate } from "../../../ui/transparent-crop";
import { TRANSPARENT_CROP_MAX_ACTIVE_RESULT_BYTES } from "../../../shared/transparent-crop";
import { renderNoFeedback } from "../../../ui/feedback";
import { ToolPageProps, SESSION_KEYS, useSessionState, messageOf } from '../../../ui/pages/tool-page-shared';


type CropResult = TransparentCropResultItem & {writeError?:string};

export default function TransparentCropPage({ request, selection, task, setTask, restartTask, confirm, toast, renderFeedback = renderNoFeedback, sessionCache, getTaskSignal }: ToolPageProps) {
  const [items, setItems] = useState<TransparentCropCandidate[]>([]);
  const [results, setResults] = useSessionState<CropResult[]>(sessionCache, SESSION_KEYS.transparentCropResults, []);
  const [selectedResultNodeIds, setSelectedResultNodeIds] = useState<string[]>(() => results.filter((item) => item.status === 'ready').map((item) => item.nodeId));
  const [scanSkipped, setScanSkipped] = useState(0);
  const summary = useMemo(() => buildTransparentCropSummary(results), [results]);
  const readyResults = results.filter((item) => item.status === 'ready');
  const selectedReadyResults = readyResults.filter((item) => selectedResultNodeIds.includes(item.nodeId));
  const allReadyResultsSelected = Boolean(readyResults.length) && selectedReadyResults.length === readyResults.length;
  const someReadyResultsSelected = selectedReadyResults.length > 0 && !allReadyResultsSelected;
  const selectionSignature = useMemo(
    () => `${selection.count}:${selection.nodes.map((node) => node.id).join('|')}`,
    [selection]
  );
  const previousSelectionSignatureRef = useRef(selectionSignature);
  const hadCachedResultsOnMountRef = useRef(results.length > 0);
  const scanGenerationRef = useRef(0);
  const scanActiveRef = useRef(false);
  const pendingSelectionScanRef = useRef(false);
  const previousTaskStateRef = useRef(task.state);
  const requestRef = useRef(request);
  const setTaskRef = useRef(setTask);
  const restartTaskRef = useRef(restartTask);
  const taskRef = useRef(task);
  const [scanRevision, setScanRevision] = useState(0);
  requestRef.current = request;
  setTaskRef.current = setTask;
  restartTaskRef.current = restartTask;
  taskRef.current = task;

  useEffect(() => {
    const previousState = previousTaskStateRef.current;
    previousTaskStateRef.current = task.state;
    if (previousState === 'loading' && task.state !== 'loading' && pendingSelectionScanRef.current) {
      pendingSelectionScanRef.current = false;
      setScanRevision((current) => current + 1);
    }
  }, [task.state]);

  useEffect(() => {
    let active = true;
    const generation = ++scanGenerationRef.current;
    if (selection.count === 0) {
      if (scanActiveRef.current) {
        restartTaskRef.current?.();
      }
      scanActiveRef.current = false;
      pendingSelectionScanRef.current = false;
      previousSelectionSignatureRef.current = selectionSignature;
      hadCachedResultsOnMountRef.current = false;
      setItems([]);
      setScanSkipped(0);
      setResults([]);
      setSelectedResultNodeIds([]);
      setTaskRef.current('idle', '等待操作');
      return () => { active = false; };
    }
    if (taskRef.current.state === 'loading' && !scanActiveRef.current) {
      pendingSelectionScanRef.current = true;
      previousSelectionSignatureRef.current = selectionSignature;
      return () => { active = false; };
    }
    if (scanActiveRef.current) {
      restartTaskRef.current?.();
    }
    scanActiveRef.current = true;
    const selectionChanged = previousSelectionSignatureRef.current !== selectionSignature;
    previousSelectionSignatureRef.current = selectionSignature;

    if (selectionChanged || !hadCachedResultsOnMountRef.current) {
      setResults([]);
      setSelectedResultNodeIds([]);
    }
    hadCachedResultsOnMountRef.current = false;
    setItems([]);
    setScanSkipped(0);
    setTaskRef.current('loading', '正在扫描选中图片');

    requestRef.current<{ items: TransparentCropCandidate[]; skipped: number }>('SCAN_TRANSPARENT_CROP')
      .then((data) => {
        if (!active) {
          return;
        }
        setItems(data.items);
        setScanSkipped(data.skipped ?? 0);
        setTaskRef.current(
          data.items.length ? 'success' : 'idle',
          data.items.length ? `已扫描 ${data.items.length} 张图片` : '当前选区没有可读取图片'
        );
      })
      .catch((error) => {
        if (active && !isOperationCancelled(error)) {
          setTaskRef.current('error', messageOf(error));
        }
      })
      .finally(() => {
        if (scanGenerationRef.current === generation) {
          scanActiveRef.current = false;
        }
      });

    return () => {
      active = false;
    };
  }, [scanRevision, selection.count, selectionSignature, setResults]);

  async function confirmCrop() {
    if (items.length === 0) {
      toast('当前选区没有可裁剪图片', 'selection');
      return;
    }

    setTask('loading', '正在识别透明边');
    const signal = getTaskSignal?.();
    const nextResults: TransparentCropResultItem[] = [];
    let retainedBytes = 0;
    let resultLimitReached = false;
    for (const [index, item] of items.entries()) {
      if (signal?.aborted) return;
      setTask('loading', `正在识别透明边 ${index + 1}/${items.length}`);
      if (resultLimitReached) {
        nextResults.push(failedTransparentCropResult(item, '未处理：结果已达到 48 MiB 会话安全上限'));
        continue;
      }
      let source: ImageSourceResult | undefined;
      try {
        source = await request<ImageSourceResult>('GET_IMAGE_SOURCE', { nodeId: item.nodeId }, { signal });
        const lightweightResult = await cropTransparentPngCandidate({ ...item, ...source });
        const storedResult = { ...lightweightResult, resultImageBytes: new Uint8Array(lightweightResult.resultImageBytes) };
        if (retainedBytes + storedResult.resultImageBytes.byteLength > TRANSPARENT_CROP_MAX_ACTIVE_RESULT_BYTES) {
          nextResults.push({
            ...lightweightResult,
            resultImageBytes: [],
            resultBytes: lightweightResult.originalBytes,
            status: 'failed',
            message: '结果达到 48 MiB 会话安全上限'
          });
          resultLimitReached = true;
          continue;
        }
        retainedBytes += storedResult.resultImageBytes.byteLength;
        nextResults.push(storedResult);
      } catch (error) {
        if (signal?.aborted) return;
        nextResults.push(failedTransparentCropResult(item, transparentCropFailureMessage(error), source));
      }
    }

    setResults(nextResults);
    setSelectedResultNodeIds(nextResults.filter((item) => item.status === 'ready').map((item) => item.nodeId));
    const readyCount = nextResults.filter((item) => item.status === 'ready').length;
    setTask(readyCount ? 'success' : 'idle', readyCount ? `已生成 ${readyCount} 张裁剪预览` : '没有可写入的裁剪结果');
  }

  function resetParams() {
    setResults([]);
    setSelectedResultNodeIds([]);
    setTask('idle', '等待操作');
  }

  function clearResults() {
    setResults([]);
    setSelectedResultNodeIds([]);
    setTask('idle', '等待操作');
  }

  function apply(writeMode: ApplyTransparentCropPayload['mode']) {
    if (!selectedReadyResults.length) {
      toast('没有可写入的裁剪结果', 'result');
      return;
    }

    const run = async () => {
      setTask('loading', '正在写入裁剪结果');
      const signal = getTaskSignal?.();
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = results.length - selectedReadyResults.length;
      const writeFailures = new Map<string, string>();
      for (const [index, item] of selectedReadyResults.entries()) {
        if (signal?.aborted) break;
        setTask('loading', `正在写入 ${index + 1}/${selectedReadyResults.length}`);
        if (!item.bounds) {
          failedCount += 1;
          writeFailures.set(item.nodeId, '裁剪边界无效，请重新生成预览');
          continue;
        }
        const writeItem: TransparentCropWriteItem = {
          sourceToken: item.sourceToken ?? '',
          nodeId: item.nodeId,
          sourcePixelWidth: item.sourcePixelWidth,
          sourcePixelHeight: item.sourcePixelHeight,
          bounds: item.bounds,
          resultImageBytes: Array.from(item.resultImageBytes),
          status: 'ready'
        };
        try {
          const data = await request<ApplyTransparentCropResult, ApplyTransparentCropPayload>('APPLY_TRANSPARENT_CROP', {
            items: [writeItem],
            mode: writeMode,
            confirmed: true
          }, { signal });
          successCount += data.successCount;
          failedCount += data.failedCount;
          skippedCount += data.skippedCount;
          for (const failure of data.failures ?? []) {
            writeFailures.set(failure.nodeId, failure.message);
          }
          if (data.failedCount > 0 && !(data.failures?.length)) {
            writeFailures.set(item.nodeId, 'Figma 写入图片失败');
          }
        } catch (error) {
          if (signal?.aborted) break;
          failedCount += 1;
          writeFailures.set(item.nodeId, transparentCropWriteFailureMessage(error));
        }
      }
      {
        setResults((current) => current.map((item) => {
          const failure = writeFailures.get(item.nodeId);
          return selectedReadyResults.some(result=>result.nodeId===item.nodeId) ? { ...item, writeError: failure } : item;
        }));

      }
      setTask(signal?.aborted ? 'cancelled' : successCount ? 'success' : 'error', `已写入 ${successCount} 项，跳过 ${skippedCount} 项，失败 ${failedCount} 项`);
    };

    if (writeMode === 'replaceOriginal') {
      confirm({
        title: '确认替换原图',
        summary: `将替换 ${selectedReadyResults.length} 张图片的图片填充。`,
          confirmText: '替换原图',
        tone: 'danger',
        onConfirm: run
      });
      return;
    }

    void run();
  }

  return (
    <div className="page">
      <div className="two-col">
        <Panel
          title="选中预览"
          meta={items.length > 1 ? <span className="panel-count">{items.length} 张图片</span> : undefined}
        >
          {renderFeedback('selection')}
          {items.length ? (
            <div className="cutout-selection-list">
              {items.map((item) => (
                <ObjectPreviewItem
                  item={toTransparentCropPreviewItem(item)}
                  key={item.nodeId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={scanSkipped ? '当前选区不支持裁剪透明' : '未选择图片'}
              detail="请选择带图片填充的对象；确认后仅处理 PNG。"
            />
          )}
          <div className="cutout-actions">
            <Button onClick={resetParams} disabled={!results.length}>重置</Button>
            <Button variant="primary" onClick={confirmCrop} disabled={items.length === 0}>确认裁剪</Button>
          </div>
        </Panel>

        <Panel title="裁剪结果">
          {results.length ? (
            <div className="cutout-result-list">
              <div className="batch-result-selection-bar">
                <Checkbox ariaLabel="选择全部可写入裁剪项" checked={allReadyResultsSelected} indeterminate={someReadyResultsSelected} onChange={(checked) => setSelectedResultNodeIds(checked ? readyResults.map((item) => item.nodeId) : [])} />
                <span>已选择 {selectedReadyResults.length} 项</span>
              </div>
              {results.map((item) => {
                const previewUrl = getTransparentCropResultPreviewUrl(item);
                return (
                  <div className={`batch-result-card cutout-result-item ${item.status === 'failed' ? 'failed' : ''}`} key={item.nodeId}>
                    <div className="batch-result-check-cell"><Checkbox hitArea ariaLabel={`选择 ${item.name}`} checked={selectedResultNodeIds.includes(item.nodeId)} disabled={item.status !== 'ready'} onChange={(checked) => setSelectedResultNodeIds((current) => checked ? current.includes(item.nodeId) ? current : [...current, item.nodeId] : current.filter((nodeId) => nodeId !== item.nodeId))} /></div>
                    {previewUrl ? (
                      <div className="transparent-preview">
                        <img alt={`${item.name} 裁剪结果预览`} src={previewUrl} />
                        <span className="cutout-preview-popover" aria-hidden="true">
                          <img alt="" src={previewUrl} />
                        </span>
                      </div>
                    ) : null}
                    <div className="cutout-result-meta">
                      <strong className="cutout-result-name" title={item.name}>{item.name}</strong>
                      {item.status !== 'ready' ? <StatusTag tone="warning">{item.status === 'failed' ? '失败' : '跳过'}</StatusTag> : null}
                      <div className="cutout-result-details">
                        <span><b>原尺寸</b>{formatPixelSize(item.sourcePixelWidth, item.sourcePixelHeight)}</span>
                        <span><b>裁剪后</b>{item.bounds ? formatPixelSize(item.bounds.width, item.bounds.height) : '-'}</span>
                        <span><b>体积</b>{formatBytes(item.originalBytes)}{' -> '}{formatBytes(item.resultBytes)}</span>
                      </div>
                      {item.writeError ? <p role="alert">{item.writeError}</p> : null}
                      {item.status === 'ready' ? null : <p>{item.message}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="暂无结果" detail="点击确认裁剪后展示处理结果。" />
          )}
          {renderFeedback('result')}
          <div className="cutout-result-actions transparent-crop-result-actions">
            <Button onClick={clearResults} disabled={!results.length}>清空</Button>
            <Button onClick={() => apply('newLayer')} disabled={!selectedReadyResults.length}>新建裁剪图层</Button>
            <Button variant="danger" onClick={() => apply('replaceOriginal')} disabled={!selectedReadyResults.length}>替换原图</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function formatPixelSize(width: number | undefined, height: number | undefined): string {
  if (typeof width !== 'number' || typeof height !== 'number') {
    return '-';
  }

  return `${Math.round(width)} x ${Math.round(height)}`;
}

function buildTransparentCropSummary(items: Array<Pick<TransparentCropResultItem, 'status' | 'originalBytes' | 'resultBytes'>>) {
  const total = items.length;
  const ready = items.filter((item) => item.status === 'ready').length;
  const skipped = items.filter((item) => item.status === 'skipped').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const originalBytes = items.reduce((sum, item) => sum + item.originalBytes, 0);
  const resultBytes = items.reduce((sum, item) => sum + (item.status === 'ready' ? item.resultBytes : item.originalBytes), 0);

  return {
    total,
    ready,
    skipped,
    failed,
    originalBytes,
    resultBytes,
    savedBytes: Math.max(0, originalBytes - resultBytes)
  };
}

function failedTransparentCropResult(
  item: TransparentCropCandidate,
  message: string,
  source?: Pick<ImageSourceResult, 'originalBytes' | 'mimeType'>
): TransparentCropResultItem {
  const originalBytes = source?.originalBytes ?? item.originalBytes ?? 0;
  return {
    ...item,
    originalBytes,
    mimeType: source?.mimeType ?? item.mimeType ?? 'application/octet-stream',
    sourcePixelWidth: Math.round(item.width ?? 0),
    sourcePixelHeight: Math.round(item.height ?? 0),
    resultImageBytes: [],
    resultBytes: originalBytes,
    status: 'failed',
    message
  };
}

function transparentCropFailureMessage(error: unknown): string {
  const candidate = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : undefined;
  if (candidate?.code === 'IMAGE_READ_FAILED') return '原图读取失败';
  if (candidate?.code === 'IMAGE_TOO_LARGE') return '原图超过 32 MiB 单图上限';
  if (candidate?.code === 'NODE_NOT_FOUND') return '原图已不存在或选区已变化';
  if (candidate?.code === 'REQUEST_TIMEOUT') return '原图读取或裁剪处理超时';
  const message = typeof candidate?.message === 'string'
    ? candidate.message
    : error instanceof Error
      ? error.message
      : '';
  const safeMessages = new Set([
    'PNG 文件无效',
    '原图超过 32 MiB 单图上限',
    '图片像素超过 1200 万上限',
    '图片解码超时',
    '图片解码失败',
    '无法读取图片像素',
    '裁剪结果生成超时',
    '裁剪结果生成失败',
    '裁剪结果超过 32 MiB 单图上限'
  ]);
  return safeMessages.has(message) ? message : '裁剪预览生成失败';
}

function transparentCropWriteFailureMessage(error: unknown): string {
  return imageWriteErrorMessage(error);
}

function toTransparentCropPreviewItem(item: TransparentCropCandidate): ObjectPreviewData {
  return {
    name: item.name,
    typeLabel: item.typeLabel,
    width: item.width,
    height: item.height,
    imageMimeType: item.mimeType,
    previewImageBytes: item.previewImageBytes,
    previewMimeType: item.previewMimeType
  };
}

function getTransparentCropResultPreviewUrl(item: TransparentCropResultItem): string | undefined {
  if (item.status === 'ready') {
    return bytesToDataUrl(item.resultImageBytes, 'image/png');
  }

  return bytesToDataUrl(item.previewImageBytes, item.previewMimeType);
}

function bytesToDataUrl(bytes: Uint8Array | number[] | undefined, mimeType = 'image/png'): string | undefined {
  if (!bytes?.length) {
    return undefined;
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}
