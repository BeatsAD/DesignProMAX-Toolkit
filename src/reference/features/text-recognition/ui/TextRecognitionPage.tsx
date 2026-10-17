import { useEffect, useRef, useState } from 'react';
import { ScanText } from 'lucide-react';
import type { GetTextRecognitionSourcePayload, KnownMessageType, TextRecognitionSourceResult } from '../../../shared/messages';
import { isOperationCancelled } from '../../../shared/messages';
import type { SelectionSnapshot, TaskState } from '../../../shared/types';
import type { TextRecognitionResult } from '../../../shared/text-recognition';
import { Button, EmptyState, Panel, StatusTag } from '../../../ui/components/ui';
import { renderNoFeedback, type FeedbackNotifier, type FeedbackRenderer, type FeedbackScope } from '../../../ui/feedback';
import { recognizeTextFromImage, terminateTextRecognitionWorker } from '../../../ui/text-recognition';
import './TextRecognitionPage.css';

type Requester = <TData, TPayload = unknown>(
  type: KnownMessageType,
  payload?: TPayload,
  options?: { signal?: AbortSignal; onProgress?: (progress: { current: number; total: number; text: string }) => void }
) => Promise<TData>;

type TextRecognitionPageProps = {
  request: Requester;
  selection: SelectionSnapshot;
  task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  restartTask?: () => void;
  getTaskSignal?: () => AbortSignal | undefined;
  toast: FeedbackNotifier;
  renderFeedback?: FeedbackRenderer;
};

export default function TextRecognitionPage({ request, selection, task, setTask, restartTask, getTaskSignal, toast, renderFeedback = renderNoFeedback }: TextRecognitionPageProps) {
  const [result, setResult] = useState<TextRecognitionResult | null>(null);
  const [editableText, setEditableText] = useState('');
  const selectionSignature = `${selection.count}:${selection.nodes.map((node) => node.id).join('|')}`;
  const previousSelectionRef = useRef(selectionSignature);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => terminateTextRecognitionWorker('TEXT_RECOGNITION_PAGE_LEFT'), []);

  useEffect(() => {
    if (previousSelectionRef.current === selectionSignature) return;
    previousSelectionRef.current = selectionSignature;
    terminateTextRecognitionWorker('TEXT_RECOGNITION_SELECTION_CHANGED');
    restartTask?.();
    setResult(null);
    setEditableText('');
    setTask('idle', '选区已变更，请重新识别');
  }, [restartTask, selectionSignature, setTask]);

  async function recognize() {
    if (selection.count !== 1) {
      toast('请在画布中只选中一张图片', 'selection');
      return;
    }
    const sourceNode = selection.nodes[0];
    setTask('loading', '正在读取选中图片');
    const signal = getTaskSignal?.();
    const cancelWorker = () => terminateTextRecognitionWorker('TEXT_RECOGNITION_CANCELLED');
    signal?.addEventListener('abort', cancelWorker, { once: true });
    try {
      const source = await request<TextRecognitionSourceResult, GetTextRecognitionSourcePayload>(
        'GET_TEXT_RECOGNITION_SOURCE',
        { nodeId: sourceNode.id },
        { signal, onProgress: (progress) => setTask('loading', progress.text) }
      );
      if (signal?.aborted) return;
      const nextResult = await recognizeTextFromImage(source, (text) => setTask('loading', text), signal);
      if (signal?.aborted) return;
      setResult(nextResult);
      setEditableText(nextResult.fullText);
      setTask('success', nextResult.fullText ? `识别完成，共 ${nextResult.lines.length} 行文字` : '识别完成，未发现可复制文字');
    } catch (error) {
      if (!isOperationCancelled(error) && !signal?.aborted) {
        setTask('error', recognitionErrorMessage(error));
      }
    } finally {
      signal?.removeEventListener('abort', cancelWorker);
    }
  }

  async function copyText() {
    const textarea = textareaRef.current;
    const content = editableText;
    if (!content.trim()) {
      toast('没有可复制的识别结果', 'result');
      return;
    }
    const copied = await copyToClipboard(content, textarea);
    toast(copied ? '已复制到剪贴板' : '复制失败，请手动选择文字复制', 'result', copied ? 'success' : 'error');
  }

  function clearEditableText() {
    setEditableText('');
    textareaRef.current?.focus();
  }

  const selectedNode = selection.count === 1 ? selection.nodes[0] : undefined;
  const canRecognize = selection.count === 1 && task.state !== 'loading';

  return (
    <div className="page text-recognition-page">
      <Panel title="识别对象">
        {renderFeedback('selection')}
        {selectedNode ? (
          <div className="text-recognition-selection">
            <ScanText aria-hidden="true" size={18} />
            <div><strong title={selectedNode.name}>{selectedNode.name || '未命名图片'}</strong><span>{selectedNode.typeLabel ?? selectedNode.type} · 仅支持单个图片图层</span></div>
          </div>
        ) : <EmptyState title={selection.count ? '请选择一张图片' : '未选择图片'} detail="请选择一个带图片填充的 PNG、JPG 或 WebP 图层。" />}
      </Panel>

      <Panel title="文字识别">
        {renderFeedback('parameters')}
        <div className="text-recognition-workflow">
          <div className="text-recognition-intro">
            <span>首次识别会按需加载本地 OCR 引擎；图片不会离开当前插件。</span>
          </div>
          <div className="text-recognition-actions">
            <Button disabled={!canRecognize} onClick={() => { void recognize(); }} variant="primary">{result ? '重新识别' : '开始识别'}</Button>
          </div>
        </div>
      </Panel>

      <Panel title="识别结果">
        {result ? (
          <div className="text-recognition-result">
            {result.lowConfidenceLineIndexes.length ? <div className="panel-status-row"><StatusTag tone="warning">第 {result.lowConfidenceLineIndexes.map((index) => index + 1).join('、')} 行识别置信度较低，请核对。</StatusTag></div> : null}
            <textarea
              aria-label="识别文本"
              className="text-recognition-textarea"
              onChange={(event) => setEditableText(event.target.value)}
              placeholder="识别出的文字会显示在这里"
              ref={textareaRef}
              value={editableText}
            />
            <div className="text-recognition-actions">
              <Button disabled={!editableText} onClick={clearEditableText}>清空</Button>
              <Button onClick={() => { void copyText(); }} variant="primary">复制全部</Button>
            </div>
          </div>
        ) : <EmptyState title="尚未识别文字" detail="选中一张图片后点击“开始识别”，结果仅保留在本次插件会话中。" />}
        {renderFeedback('result')}
      </Panel>
    </div>
  );
}

async function copyToClipboard(text: string, textarea: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Figma iframe 可能未授予 Clipboard API，继续使用受控降级路径。
  }
  if (!textarea || typeof document.execCommand !== 'function') return false;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.focus();
  if (end <= start) textarea.select();
  return document.execCommand('copy');
}

function recognitionErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail === 'OCR_ENGINE_TIMEOUT') return '文字识别超时，请先裁切图片后重试';
  if (detail === 'OCR_EMBEDDED_PAYLOAD_MISSING' || detail === 'OCR_EMBEDDED_PAYLOAD_INVALID') {
    return '本地 OCR 资源不完整，请重新安装或更新插件测试包后重试';
  }
  if (detail === 'OCR_EMBEDDED_ENGINE_MISSING') return '本地 OCR 引擎未加载，请重新打开插件后重试';
  if (detail === 'OCR_WORKER_BLOCKED') return '本地 OCR Worker 被宿主阻止，请更新 Figma 或重新打开插件后重试';
  if (detail === 'OCR_CORE_INIT_FAILED') return '本地 OCR 引擎初始化失败，请重新打开插件后重试';
  if (detail === 'OCR_LANGUAGE_LOAD_FAILED') return '中英文识别模型加载失败，请重新打开插件后重试';
  if (detail === 'OCR_ENGINE_UNAVAILABLE') return '本地 OCR 引擎不可用，请重新打开插件或更新测试包后重试';
  return detail || '文字识别失败，请重试';
}
