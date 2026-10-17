import { useEffect, useRef, useState } from 'react';
import { isOperationCancelled } from "../../../shared/messages";
import type { ApplyRemoveBgPayload, PreviewRemoveBgPayload } from "../../../shared/messages";
import { formatBytes } from "../../../shared/image-compress";
import type { CutoutProvider, PluginSettings } from "../../../shared/types";
import { Button, Checkbox, EmptyState, ObjectPreviewItem, Panel, SelectField, StatusTag } from "../../../ui/components/ui";
import { removeImageBackgroundInUi } from "../../../ui/remove-bg";
import { renderNoFeedback } from "../../../ui/feedback";
import { MAX_ACTIVE_IMAGE_RESULT_BYTES, ToolPageProps, SESSION_KEYS, useSessionState, messageOf } from '../../../ui/pages/tool-page-shared';


type CutoutResultItem = {
  sourceToken?: string;
  sourceNodeId: string;
  sourceName: string;
  sourceTypeLabel?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  resultSizeBytes?: number;
  status: 'success' | 'failed';
  resultImageBytes?: Uint8Array | number[];
  resultUrl?: string;
  message?: string;
};

export default function CutoutPage({ request, selection, settings, task, setTask, confirm, toast, renderFeedback = renderNoFeedback, goSettings, sessionCache, getTaskSignal }: ToolPageProps) {
  const selectedImages = selection.nodes.filter((node) => node.hasImageFill);
  const selectionSignature = selectedImages.map((node) => node.id).join('|');
  const hasUnsupportedSelection = selection.count > 0 && selectedImages.length === 0;
  const [service, setService] = useState<CutoutProvider | ''>('');
  const [quality, setQuality] = useState<'original' | 'high' | ''>('');
  const [results, setResults] = useSessionState<CutoutResultItem[]>(sessionCache, SESSION_KEYS.cutoutResults, []);
  const [selectedResultNodeIds, setSelectedResultNodeIds] = useState<string[]>(() => results.filter(isSuccessfulCutoutResult).map((item) => item.sourceNodeId));
  const previousSelectionSignatureRef = useRef<string | null>(null);
  const previousProviderRef = useRef(settings?.cutoutProvider);
  const readyResults = results.filter(isSuccessfulCutoutResult);
  const selectedReadyResults = readyResults.filter((item) => selectedResultNodeIds.includes(item.sourceNodeId));
  const configuredService = service || settings?.cutoutProvider;
  const serviceReady = Boolean(configuredService && settings?.allowImageUpload && cutoutServiceReady(configuredService, settings));
  const canPreview = Boolean(selectedImages.length && service && serviceReady && quality && task.state !== 'loading');
  const allReadyResultsSelected = Boolean(readyResults.length) && selectedReadyResults.length === readyResults.length;
  const someReadyResultsSelected = selectedReadyResults.length > 0 && !allReadyResultsSelected;

  useEffect(() => {
    if (previousProviderRef.current === settings?.cutoutProvider) {
      return;
    }
    previousProviderRef.current = settings?.cutoutProvider;
    setResults([]);
    setSelectedResultNodeIds([]);
    setService('');
    setQuality('');
  }, [setResults, settings?.cutoutProvider]);

  useEffect(() => {
    return () => revokeCutoutResultUrls(results);
  }, [results]);

  useEffect(() => {
    if (task.state === 'loading') {
      previousSelectionSignatureRef.current = selectionSignature;
      return;
    }
    if (previousSelectionSignatureRef.current === null) {
      previousSelectionSignatureRef.current = selectionSignature;
      return;
    }

    if (previousSelectionSignatureRef.current === selectionSignature) {
      return;
    }

    previousSelectionSignatureRef.current = selectionSignature;

    if (results.length > 0) {
      setResults([]);
      setSelectedResultNodeIds([]);
      setTask('idle', '等待操作');
    }
  }, [results.length, selectionSignature, setTask]);

  async function preview() {
    if (selectedImages.length === 0) {
      toast(hasUnsupportedSelection ? '当前选中对象不支持抠图' : '请先选择一张图片', 'selection');
      return;
    }
    if (!service || !quality) {
      toast('请先选择抠图服务和质量', 'parameters');
      return;
    }
    if (!settings?.allowImageUpload) {
      toast('设置中心当前未允许上传图片', 'parameters');
      goSettings('cutout');
      return;
    }
    if (service === 'removebg' && !settings?.removeBgApiKey) {
      toast('请先在设置中心配置 remove.bg API Key', 'parameters');
      goSettings('cutout');
      return;
    }
    if (service === 'custom' && !settings?.customImageServiceUrl) {
      toast('请先在设置中心配置自定义抠图服务地址', 'parameters');
      goSettings('cutout');
      return;
    }

    setTask('loading', '正在准备批量抠图');
    setResults([]);
    const nextResults: CutoutResultItem[] = [];
    const signal = getTaskSignal?.();
    let retainedBytes = 0;
    let runtimeSettings = settings!;

    if (service === 'removebg') {
      try {
        const runtimeConfig = await request<{ removeBgApiKey: string }>('GET_REMOVE_BG_RUNTIME_CONFIG');
        runtimeSettings = {
          ...runtimeSettings,
          removeBgApiKey: runtimeConfig.removeBgApiKey
        };
      } catch (error) {
        if (!isOperationCancelled(error)) setTask('error', messageOf(error));
        return;
      }
    }

    for (const [index, image] of selectedImages.entries()) {
      if (signal?.aborted) return;
      setTask('loading', `正在抠图 ${index + 1}/${selectedImages.length}`);
      try {
        const payload: PreviewRemoveBgPayload = { nodeId: image.id, service, quality };
        const source = await request<{ imageBytes: number[]; sourceToken: string }, PreviewRemoveBgPayload>('GET_REMOVE_BG_SOURCE', payload);
        const resultImageBytes = await removeImageBackgroundInUi(runtimeSettings, new Uint8Array(source.imageBytes), payload, signal);
        if (retainedBytes + resultImageBytes.length > MAX_ACTIVE_IMAGE_RESULT_BYTES) {
          nextResults.push({ sourceNodeId: image.id, sourceName: image.name, status: 'failed', message: '结果达到 48 MiB 会话安全上限' });
          break;
        }
        retainedBytes += resultImageBytes.length;
        const resultUrl = URL.createObjectURL(new Blob([new Uint8Array(resultImageBytes)], { type: 'image/png' }));
        nextResults.push({
          sourceNodeId: image.id,
          sourceToken: source.sourceToken,
          sourceName: image.name,
          sourceTypeLabel: image.typeLabel ?? image.type,
          sourceWidth: image.width,
          sourceHeight: image.height,
          resultSizeBytes: resultImageBytes.length,
          status: 'success',
          resultImageBytes,
          resultUrl
        });
      } catch (error) {
        if (signal?.aborted) return;
        nextResults.push({
          sourceNodeId: image.id,
          sourceName: image.name,
          sourceTypeLabel: image.typeLabel ?? image.type,
          sourceWidth: image.width,
          sourceHeight: image.height,
          status: 'failed',
          message: messageOf(error)
        });
      }
    }

    setResults(nextResults);
    setSelectedResultNodeIds(nextResults.filter(isSuccessfulCutoutResult).map((item) => item.sourceNodeId));
    const successCount = nextResults.filter(isSuccessfulCutoutResult).length;
    const failedCount = nextResults.length - successCount;
    setTask(successCount > 0 ? 'success' : 'error', `抠图完成：成功 ${successCount} 张，失败 ${failedCount} 张`);
  }

  function resetParams() {
    setService('');
    setQuality('');
    setResults([]);
    setSelectedResultNodeIds([]);
    setTask('idle', '等待操作');
  }

  function apply(mode: ApplyRemoveBgPayload['mode']) {
    if (selectedReadyResults.length === 0) {
      toast('暂无可写入的抠图结果', 'result');
      return;
    }
    const run = async () => {
      setTask('loading', '正在写入裁剪结果');
      const signal = getTaskSignal?.();
      let successCount = 0;
      let failedCount = 0;

      for (const [index, item] of selectedReadyResults.entries()) {
        if (signal?.aborted) break;
        setTask('loading', `正在写入 ${index + 1}/${selectedReadyResults.length}`);
        try {
          const applied = await request<{successCount:number;failedCount:number}>('APPLY_REMOVE_BG', {
            sourceNodeId: item.sourceNodeId,
            sourceToken: item.sourceToken ?? '',
            resultImageBytes: item.resultImageBytes,
            mode,
            confirmed: mode === 'replaceOriginal'
          });
          successCount += applied.successCount;
          failedCount += applied.failedCount;
        } catch {
          if (signal?.aborted) break;
          failedCount += 1;
        }
      }

      setTask(signal?.aborted ? 'cancelled' : successCount > 0 ? 'success' : 'error', `写入完成：成功 ${successCount} 张，失败 ${failedCount} 张`);
    };

    if (mode === 'replaceOriginal') {
      confirm({
        title: '确认替换原图',
        summary: `将替换 ${selectedReadyResults.length} 张图片的图片填充。`,
          confirmText: '替换原图',
        tone: 'danger',
        onConfirm: run
      });
    } else {
      void run();
    }
  }

  function clearResults() {
    setResults([]);
    setSelectedResultNodeIds([]);
    setTask('idle', '等待操作');
  }

  return (
    <div className="page">
      <Panel
        title="当前选区"
        meta={selectedImages.length > 1 ? <span className="panel-count">{selectedImages.length} 张图片</span> : undefined}
      >
        {renderFeedback('selection')}
        {selectedImages.length > 0 ? (
          <div className="cutout-selection-list">
            <ObjectPreviewItem item={selectedImages[0]} key={selectedImages[0].id} />
          </div>
        ) : hasUnsupportedSelection ? (
          <EmptyState title="当前选中对象不支持抠图" detail="请选择包含图片填充的对象后再开始抠图。" />
        ) : (
          <EmptyState title="未选择图片" detail="请选择包含图片填充的对象后再开始抠图。" />
        )}
      </Panel>
      <div className="two-col">
        <Panel
          title="参数"
          meta={
            <span className="inline-status-actions">
              {service && !cutoutServiceReady(service, settings) ? <StatusTag tone="warning">{cutoutServiceLabel(service, settings)}</StatusTag> : null}
              {!serviceReady ? <Button size="compact" onClick={() => goSettings('cutout')}>去配置</Button> : null}
            </span>
          }
        >
          {renderFeedback('parameters')}
          <div className="cutout-param-grid">
            <SelectField label="服务" value={service} placeholder="请选择服务" onChange={(event) => setService(event.target.value as CutoutProvider | '')}>
              <option value="removebg">remove.bg API</option>
              <option value="custom">自定义抠图 API</option>
            </SelectField>
            <SelectField label="质量" value={quality} placeholder="请选择质量" onChange={(event) => setQuality(event.target.value as 'original' | 'high' | '')}>
              <option value="high">高清</option>
              <option value="original">原始</option>
            </SelectField>
          </div>
          {!serviceReady ? <p className="panel-note">请先配置服务并允许图片上传，再选择服务和质量。</p> : null}
          <div className="cutout-actions">
            <Button onClick={resetParams}>重置</Button>
            <Button variant="primary" disabled={!canPreview} onClick={preview}>{task.state === 'error' ? '重试抠图' : '立即抠图'}</Button>
          </div>
        </Panel>
        <Panel title="结果">
          {results.length > 0 ? (
            <div className="cutout-result-list">
              <div className="batch-result-selection-bar">
                <Checkbox ariaLabel="选择全部可写入抠图项" checked={allReadyResultsSelected} indeterminate={someReadyResultsSelected} onChange={(checked) => setSelectedResultNodeIds(checked ? readyResults.map((item) => item.sourceNodeId) : [])} />
                <span>已选择 {selectedReadyResults.length} 项</span>
              </div>
              {results.map((item) => (
                <div className={`batch-result-card cutout-result-item ${item.status}`} key={item.sourceNodeId}>
                  <div className="batch-result-check-cell"><Checkbox hitArea ariaLabel={`选择 ${item.sourceName}`} checked={selectedResultNodeIds.includes(item.sourceNodeId)} disabled={!isSuccessfulCutoutResult(item)} onChange={(checked) => setSelectedResultNodeIds((current) => checked ? current.includes(item.sourceNodeId) ? current : [...current, item.sourceNodeId] : current.filter((nodeId) => nodeId !== item.sourceNodeId))} /></div>
                  {item.status === 'success' ? (
                    <div className="transparent-preview">
                      {item.resultUrl ? (
                        <>
                          <img alt={`${item.sourceName} 抠图结果预览`} src={item.resultUrl} />
                          <span className="cutout-preview-popover" aria-hidden="true">
                            <img alt="" src={item.resultUrl} />
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="cutout-result-meta">
                    <strong className="cutout-result-name" title={item.sourceName}>{item.sourceName}</strong>
                    {item.status !== 'success' ? <StatusTag tone="warning">失败</StatusTag> : null}
                    <div className="cutout-result-details">
                      <span><b>大小</b>{formatCutoutSize(item.resultSizeBytes)}</span>
                      <span><b>尺寸</b>{formatCutoutDimensions(item.sourceWidth, item.sourceHeight)}</span>
                    </div>
                    {item.message ? <p>{item.message}</p> : null}
                  </div>
                </div>
              ))}
              {renderFeedback('result')}
              <div className="cutout-result-actions">
                <Button onClick={clearResults}>清空</Button>
                {readyResults.length > 0 ? (
                  <>
                    <Button disabled={!selectedReadyResults.length} onClick={() => apply('keepOriginalAndInsert')}>保留原图并插入</Button>
                    <Button disabled={!selectedReadyResults.length} variant="danger" onClick={() => apply('replaceOriginal')}>替换原图</Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState title="暂无结果" detail="抠图完成后，可选择写入方式。" />
          )}
        </Panel>
      </div>
    </div>
  );
}

function isSuccessfulCutoutResult(item: CutoutResultItem): item is CutoutResultItem & { status: 'success'; resultImageBytes: Uint8Array | number[] } {
  return item.status === 'success' && Boolean(item.resultImageBytes?.length);
}

function revokeCutoutResultUrls(results: CutoutResultItem[]): void {
  for (const item of results) {
    if (item.resultUrl) {
      URL.revokeObjectURL(item.resultUrl);
    }
  }
}

function formatCutoutSize(bytes: number | undefined): string {
  return typeof bytes === 'number' ? formatBytes(bytes) : '-';
}

function formatCutoutDimensions(width: number | undefined, height: number | undefined): string {
  if (typeof width !== 'number' || typeof height !== 'number') {
    return '-';
  }

  return `${Math.round(width)} x ${Math.round(height)} px`;
}

function cutoutServiceReady(service: CutoutProvider | '', settings: PluginSettings | undefined): boolean {
  if (!settings) {
    return false;
  }

  if (!service) {
    return false;
  }

  if (service === 'removebg') {
    return Boolean(settings.removeBgApiKey);
  }

  if (service === 'custom') {
    return Boolean(settings.customImageServiceUrl && settings.apiKey);
  }

  return false;
}

function cutoutServiceLabel(service: CutoutProvider | '', settings: PluginSettings | undefined): string {
  if (!settings) {
    return '抠图配置读取中';
  }

  if (!service) {
    return '请选择服务';
  }

  if (service === 'removebg') {
    return 'remove.bg 未配置';
  }

  if (service === 'custom') {
    return '自定义抠图未配置';
  }

  return '请选择服务';
}
