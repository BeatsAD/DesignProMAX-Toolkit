import type { PreviewRemoveBgPayload } from '../shared/messages';
import type { PluginSettings } from '../shared/types';
import { createTimeoutSignal } from '../shared/abort';

export async function removeImageBackgroundInUi(
  settings: PluginSettings,
  imageBytes: Uint8Array,
  payload: PreviewRemoveBgPayload,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const timeout = createTimeoutSignal(signal);
  try {
    const provider = payload.service || settings.cutoutProvider;
    if (provider !== 'removebg' && provider !== 'custom') {
      throw new Error('API_NOT_CONFIGURED');
    }
    if (!settings.allowImageUpload) {
      throw new Error('IMAGE_UPLOAD_DISABLED');
    }

    if (provider === 'removebg') {
      return await removeWithRemoveBg(settings, imageBytes, timeout.signal);
    }

    const endpointBase = settings.customImageServiceUrl;
    if (!endpointBase) {
      throw new Error('API_NOT_CONFIGURED');
    }

    if(!settings.apiKey)throw new Error('REMOVE_BG_API_KEY_REQUIRED');
    const form = createImageForm(imageBytes, 'image');
    form.append('quality', payload.quality);
    return await postImageForm(`${endpointBase}/remove-background`, { signal: timeout.signal, body: form,headers:{Authorization:`Bearer ${settings.apiKey}`},sensitiveValues:[settings.apiKey] });
  } catch (error) {
    throw timeout.didTimeout() ? new Error('请求超时，请检查外部服务连通性') : error;
  } finally {
    timeout.dispose();
  }
}

async function removeWithRemoveBg(
  settings: PluginSettings,
  imageBytes: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8Array> {
  if (!settings.removeBgApiKey) {
    throw new Error('REMOVE_BG_API_KEY_REQUIRED');
  }
  if (settings.removeBgApiKey === '********') {
    throw new Error('remove.bg API Key 当前为脱敏占位，请重新保存真实 Key');
  }

  const form = createImageForm(imageBytes, 'image_file');
  form.append('size', 'auto');
  form.append('format', 'png');

  const responseBytes = await postImageForm('https://api.remove.bg/v1.0/removebg', {
    signal,
    headers: {
      'X-Api-Key': settings.removeBgApiKey
    },
    body: form,
    sensitiveValues: [settings.removeBgApiKey],
    errorPrefix(status) {
      if (status === 401 || status === 403) {
        return 'remove.bg 鉴权失败';
      }
      if (status === 402 || status === 429) {
        return 'remove.bg 额度或限流';
      }
      return '外部服务请求失败';
    }
  });

  return responseBytes;
}

function createImageForm(imageBytes: Uint8Array, fieldName: string): FormData {
  const imageBuffer = new ArrayBuffer(imageBytes.byteLength);
  new Uint8Array(imageBuffer).set(imageBytes);
  const form = new FormData();
  form.append(fieldName, new Blob([imageBuffer], { type: 'image/png' }), 'source.png');
  return form;
}

async function postImageForm(
  url: string,
  init: {
    signal?: AbortSignal;
    headers?: HeadersInit;
    body: FormData;
    errorPrefix?: (status: number) => string;
    sensitiveValues?: string[];
  }
): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: init.signal,
      headers: init.headers,
      body: init.body
    });
  } catch (error) {
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new Error(`外部服务请求失败：${sanitizeErrorDetail(errorMessage(error), init.sensitiveValues ?? [])}`);
  }

  if (!response.ok) {
    throw new Error(await formatServiceError(response, init.errorPrefix, init.sensitiveValues ?? []));
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function formatServiceError(
  response: Response,
  errorPrefix: ((status: number) => string) | undefined,
  sensitiveValues: string[]
): Promise<string> {
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  const detail = sanitizeErrorDetail(extractResponseDetail(await safeReadResponseText(response)), sensitiveValues);
  const suffix = detail ? ` - ${detail}` : '';
  return `${errorPrefix?.(response.status) ?? '外部服务请求失败'}：HTTP ${response.status}${statusText}${suffix}`;
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return errorMessage(error);
  }
}

function extractResponseDetail(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);
    const collected = collectErrorMessages(parsed);
    if (collected.length > 0) {
      return limitDetail(collected.join(' - '));
    }
    return limitDetail(JSON.stringify(parsed));
  } catch {
    return limitDetail(trimmed);
  }
}

function collectErrorMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorMessages(item));
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const preferredKeys = ['title', 'message', 'detail', 'error', 'code'];
  const direct = preferredKeys.flatMap((key) => (
    typeof record[key] === 'string' ? [record[key] as string] : []
  ));
  if (direct.length > 0) {
    return direct;
  }

  return Object.values(record).flatMap((item) => collectErrorMessages(item));
}

function sanitizeErrorDetail(detail: string, sensitiveValues: string[]): string {
  return sensitiveValues
    .filter((value) => value.length >= 4)
    .reduce((safeDetail, value) => safeDetail.replace(new RegExp(escapeRegExp(value), 'g'), '[REDACTED]'), detail);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function limitDetail(detail: string): string {
  const normalized = detail.replace(/\s+/g, ' ').trim();
  return normalized.length > 500 ? `${normalized.slice(0, 500)}...` : normalized;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
