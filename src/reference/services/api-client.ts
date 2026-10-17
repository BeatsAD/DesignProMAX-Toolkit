import type { PreviewRemoveBgPayload } from '../shared/messages';
import { diagnosticStore } from '../shared/diagnostics';
import { createTimeoutSignal } from '../shared/abort';
import type { GenerateAiImagePayload, PluginSettings } from '../shared/types';
import { inferImageMime } from '../shared/image-compress';
import {
  getAiProviderDefinition,
  isAiProviderConnectionTestAvailable,
  requiresAiProviderGateway,
  type AiProviderDefinition
} from './ai-providers';

export type GeneratedImage = {
  url?: string;
  /** 仅用于预览的原始临时 URL；插入时仍使用带鉴权的本机网关地址。 */
  previewUrl?: string;
  base64?: string;
  mimeType?: string;
  name: string;
  requiresGatewayAuth?: boolean;
};

export const AI_SERVICE_DISCOVERY_TIMEOUT_MS = 15_000;
const MAX_DISCOVERED_AI_MODELS = 200;
const MAX_DISCOVERED_AI_MODEL_NAME_LENGTH = 256;

type AiServiceCredentials = Pick<PluginSettings, 'apiBaseUrl' | 'apiKey'> & Partial<Pick<PluginSettings, 'aiProvider'>>;

export type AiServiceConnectionResult = {
  modelCount: number;
  source: 'live' | 'recommended';
  purpose: 'model-list' | 'credentials';
};

/**
 * 读取服务商模型列表，而不发起计费的生图请求。没有公共模型枚举接口的厂商
 * 返回其官方推荐模型；调用方仍需在实际生成时以账户权限为准。
 */
export async function getAvailableAiModels(
  credentials: AiServiceCredentials,
  signal?: AbortSignal
): Promise<string[]> {
  const provider = getAiProviderDefinition(credentials.aiProvider);
  assertAiServiceCredentials(credentials, provider);
  if (provider.modelDiscovery === 'recommended-catalog') {
    return [...provider.suggestedModels];
  }
  if (provider.modelDiscovery === 'not-available') {
    throw new Error(provider.protocol === 'not-image' ? 'AI_PROVIDER_IMAGE_UNAVAILABLE' : 'AI_PROVIDER_MODEL_DISCOVERY_UNAVAILABLE');
  }

  const response = await requestAiModelList(credentials, provider, signal);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('MODEL_LIST_INVALID');
  }

  return provider.modelDiscovery === 'gemini-list'
    ? extractGeminiImageModelIds(payload)
    : extractAiModelIds(payload);
}

export async function testAiServiceConnection(
  credentials: AiServiceCredentials,
  signal?: AbortSignal
): Promise<AiServiceConnectionResult> {
  const provider = getAiProviderDefinition(credentials.aiProvider);
  assertAiServiceCredentials(credentials, provider);
  if (requiresAiProviderGateway(provider, credentials.apiBaseUrl)) {
    throw new Error('AI_PROVIDER_GATEWAY_REQUIRED');
  }
  if (!isAiProviderConnectionTestAvailable(provider)) {
    throw new Error('AI_PROVIDER_CONNECTION_TEST_UNAVAILABLE');
  }
  if (provider.connectionCheck === 'dashscope-deployable-models') {
    await requestDashscopeDeployableModels(credentials, signal);
    return { modelCount: 0, source: 'live', purpose: 'credentials' };
  }
  const models = await getAvailableAiModels(credentials, signal);
  return { modelCount: models.length, source: 'live', purpose: 'model-list' };
}

export async function generateAiImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  const provider = getAiProviderDefinition(settings.aiProvider);
  assertAiServiceCredentials(settings, provider);
  if (requiresAiProviderGateway(provider, settings.apiBaseUrl)) {
    throw new Error('AI_PROVIDER_GATEWAY_REQUIRED');
  }
  if (!provider.supportsImageGeneration || provider.protocol === 'not-image') {
    throw new Error('AI_PROVIDER_IMAGE_UNAVAILABLE');
  }

  if (provider.protocol === 'gemini') {
    return generateGeminiImages(settings, payload, provider, signal);
  }
  if (provider.protocol === 'dashscope-async') {
    return generateDashscopeImages(settings, payload, provider, signal);
  }
  if (provider.protocol === 'azure-openai') {
    return generateOpenAiImages(settings, payload, provider, signal, 'azure');
  }
  if (provider.protocol !== 'openai-compatible') {
    throw new Error('AI_PROVIDER_GENERATION_UNAVAILABLE');
  }
  return generateOpenAiImages(settings, payload, provider, signal);
}

async function generateOpenAiImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  provider: AiProviderDefinition,
  signal?: AbortSignal,
  mode: 'bearer' | 'azure' = 'bearer'
): Promise<GeneratedImage[]> {
  const endpoint = mode === 'azure'
    ? getAzureImagesEndpoint(settings.apiBaseUrl)
    : getAiServiceEndpoint(settings.apiBaseUrl, '/images/generations');
  const requestBody = {
    model: payload.model || (payload.mode === 'icon' ? settings.iconModelName : settings.modelName),
    prompt: buildPrompt(payload),
    n: payload.count,
    size: ratioToSize(payload.ratio || settings.defaultImageRatio || '1:1')
  };
  let response: Response;
  const timeout = createTimeoutSignal(signal);
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: timeout.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(mode === 'azure' ? { 'api-key': settings.apiKey } : { Authorization: `Bearer ${settings.apiKey}` })
      },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    diagnosticStore.record({
      source: 'api',
      level: 'error',
      event: 'api:network-error',
      messageType: 'GENERATE_AI_IMAGE',
      message: errorMessage(error),
      data: { endpoint, provider: provider.id, body: requestBody }
    });
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }

  if (!response.ok) {
    diagnosticStore.record({
      source: 'api',
      level: 'error',
      event: 'api:http-error',
      messageType: 'GENERATE_AI_IMAGE',
      message: `HTTP ${response.status}`,
      data: { endpoint, provider: provider.id, status: response.status, body: requestBody }
    });
    throw new Error(`NETWORK_ERROR:${response.status}`);
  }

  return extractOpenAiGeneratedImages(await response.json(), payload);
}

async function generateGeminiImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  provider: AiProviderDefinition,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  const model = selectedAiModel(settings, payload);
  if (!model) throw new Error('AI_MODEL_NOT_SELECTED');
  const modelPath = model.replace(/^models\//, '');
  const endpoint = `${getAiServiceEndpoint(settings.apiBaseUrl, `/models/${encodeURIComponent(modelPath)}:generateContent`)}?key=${encodeURIComponent(settings.apiKey)}`;
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: `${buildPrompt(payload)}\nRequested aspect ratio: ${payload.ratio || settings.defaultImageRatio || '1:1'}.` }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  };
  const timeout = createTimeoutSignal(signal);
  try {
    const images: GeneratedImage[] = [];
    for (let index = 0; index < payload.count; index += 1) {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: timeout.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) throw new Error(`NETWORK_ERROR:${response.status}`);
      images.push(...extractGeminiGeneratedImages(await response.json(), payload, images.length));
    }
    return images;
  } catch (error) {
    diagnosticStore.record({
      source: 'api', level: 'error', event: 'api:network-error', messageType: 'GENERATE_AI_IMAGE',
      message: errorMessage(error), data: { endpoint: settings.apiBaseUrl, provider: provider.id, model }
    });
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }
}

async function generateDashscopeImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  provider: AiProviderDefinition,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  const model = selectedAiModel(settings, payload);
  if (!model) throw new Error('AI_MODEL_NOT_SELECTED');
  const endpoint = getDashscopeEndpoint(settings.apiBaseUrl, '/services/aigc/text2image/image-synthesis');
  const requestBody = {
    model,
    input: { prompt: buildPrompt(payload) },
    parameters: { size: ratioToSize(payload.ratio || settings.defaultImageRatio || '1:1'), n: payload.count }
  };
  const timeout = createTimeoutSignal(signal);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', signal: timeout.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}`, 'X-DashScope-Async': 'enable' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) throw new Error(`NETWORK_ERROR:${response.status}`);
    const created = await response.json() as { output?: { task_id?: string } };
    const taskId = created.output?.task_id;
    if (!taskId) throw new Error('AI_TASK_INVALID');
    return waitForDashscopeImages(settings, payload, provider, taskId, timeout.signal);
  } catch (error) {
    diagnosticStore.record({
      source: 'api', level: 'error', event: 'api:network-error', messageType: 'GENERATE_AI_IMAGE',
      message: errorMessage(error), data: { endpoint, provider: provider.id, model }
    });
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }
}

async function waitForDashscopeImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  _provider: AiProviderDefinition,
  taskId: string,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  const endpoint = getDashscopeEndpoint(settings.apiBaseUrl, `/tasks/${encodeURIComponent(taskId)}`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? new Error('TASK_CANCELLED');
    const response = await fetch(endpoint, { method: 'GET', signal, headers: { Authorization: `Bearer ${settings.apiKey}` } });
    if (!response.ok) throw new Error(`NETWORK_ERROR:${response.status}`);
    const task = await response.json() as {
      output?: { task_status?: string; results?: Array<{ url?: string; orig_prompt?: string }> };
      code?: string;
      message?: string;
    };
    if (task.output?.task_status === 'SUCCEEDED') {
      return (task.output?.results ?? []).flatMap((result, index) => {
        if (!result.url) return [];
        const gatewayImageUrl = getLocalDashscopeGatewayImageUrl(settings.apiBaseUrl, result.url);
        return [{
          url: gatewayImageUrl ?? result.url,
          previewUrl: gatewayImageUrl ? result.url : undefined,
          requiresGatewayAuth: Boolean(gatewayImageUrl),
          name: `${payload.mode === 'icon' ? 'AI 图标' : 'AI 生图'} ${index + 1}`
        }];
      });
    }
    if (task.output?.task_status === 'FAILED' || task.code) {
      throw new Error('AI_TASK_FAILED');
    }
    await waitForAiTask(1000, signal);
  }
  throw new Error('REQUEST_TIMEOUT');
}

async function requestAiModelList(
  credentials: AiServiceCredentials,
  provider: AiProviderDefinition,
  signal?: AbortSignal
): Promise<Response> {
  const apiBaseUrl = credentials.apiBaseUrl.trim();
  const apiKey = credentials.apiKey.trim();

  const timeout = createTimeoutSignal(signal, AI_SERVICE_DISCOVERY_TIMEOUT_MS);
  try {
    const endpoint = provider.modelDiscovery === 'gemini-list'
      ? `${getAiServiceEndpoint(apiBaseUrl, '/models')}?key=${encodeURIComponent(apiKey)}`
      : getAiServiceEndpoint(apiBaseUrl, '/models');
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: timeout.signal,
      headers: provider.modelDiscovery === 'gemini-list' ? undefined : { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      throw new Error(`AI_SERVICE_ERROR:${response.status}`);
    }
    return response;
  } catch (error) {
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }
}

/**
 * 百炼万相没有可直接用于本插件的公共模型目录。这里调用官方只读的
 * 部署模型列表接口，仅验证 URL 与 Bearer API Key；不会创建生成任务，
 * 也不能据此推断万相模型已获授权。
 */
async function requestDashscopeDeployableModels(
  credentials: AiServiceCredentials,
  signal?: AbortSignal
): Promise<void> {
  const apiBaseUrl = credentials.apiBaseUrl.trim();
  const apiKey = credentials.apiKey.trim();
  const timeout = createTimeoutSignal(signal, AI_SERVICE_DISCOVERY_TIMEOUT_MS);
  try {
    const endpoint = `${getDashscopeEndpoint(apiBaseUrl, '/deployments/models')}?page_no=1&page_size=1`;
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      throw new Error(`AI_SERVICE_ERROR:${response.status}`);
    }
  } catch (error) {
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }
}

function assertAiServiceCredentials(credentials: AiServiceCredentials, provider: AiProviderDefinition) {
  if (!credentials.apiBaseUrl.trim() || !credentials.apiKey.trim() || credentials.apiKey === '********') {
    throw new Error('API_NOT_CONFIGURED');
  }
  if (provider.protocol === 'not-image') throw new Error('AI_PROVIDER_IMAGE_UNAVAILABLE');
  if (provider.protocol === 'special-signature') throw new Error('AI_PROVIDER_SIGNATURE_REQUIRED');
}

function selectedAiModel(settings: PluginSettings, payload: GenerateAiImagePayload): string {
  return (payload.model || (payload.mode === 'icon' ? settings.iconModelName : settings.modelName)).trim();
}

function getAiServiceEndpoint(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.trim().replace(/\/+$/, '')}${path}`;
}

function getAzureImagesEndpoint(apiBaseUrl: string): string {
  const endpoint = getAiServiceEndpoint(apiBaseUrl, '/images/generations');
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}api-version=2025-04-01-preview`;
}

function getDashscopeEndpoint(apiBaseUrl: string, path: string): string {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, '');
  const base = normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
  return `${base}${path}`;
}

function getLocalDashscopeGatewayImageUrl(apiBaseUrl: string, imageUrl: string): string | undefined {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, '');
  if (!/^http:\/\/127\.0\.0\.1(?::\d+)?\/api\/v1$/i.test(normalized)) return undefined;
  return `${normalized}/gateway/image?url=${encodeURIComponent(imageUrl)}`;
}

function extractAiModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('MODEL_LIST_INVALID');
  }

  const candidate = payload as { data?: unknown; models?: unknown };
  const entries = Array.isArray(candidate.data)
    ? candidate.data
    : Array.isArray(candidate.models)
      ? candidate.models
      : undefined;
  if (!entries) {
    throw new Error('MODEL_LIST_INVALID');
  }

  const modelIds = entries.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [entry.trim()];
    }
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const model = entry as { id?: unknown; name?: unknown; model?: unknown };
    const id = [model.id, model.name, model.model].find((value): value is string => typeof value === 'string');
    return id ? [id.trim()] : [];
  }).filter((model): model is string => Boolean(model) && model.length <= MAX_DISCOVERED_AI_MODEL_NAME_LENGTH);

  return [...new Set(modelIds)].slice(0, MAX_DISCOVERED_AI_MODELS);
}

function extractGeminiImageModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { models?: unknown }).models)) {
    throw new Error('MODEL_LIST_INVALID');
  }
  const models = (payload as { models: unknown[] }).models.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const model = entry as { name?: unknown; supportedGenerationMethods?: unknown };
    if (typeof model.name !== 'string') return [];
    const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
    if (methods.length && !methods.some((method) => method === 'generateContent' || method === 'predict')) return [];
    const normalized = model.name.replace(/^models\//, '').trim();
    return normalized ? [normalized] : [];
  });
  return [...new Set(models)].slice(0, MAX_DISCOVERED_AI_MODELS);
}

function extractOpenAiGeneratedImages(payload: unknown, request: GenerateAiImagePayload): GeneratedImage[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: Array<{ url?: string; b64_json?: string; mime_type?: string }> }).data
    : [];
  return data.flatMap((item, index) => {
    const base64 = typeof item.b64_json === 'string' ? item.b64_json : undefined;
    const url = typeof item.url === 'string' ? item.url : undefined;
    if (!base64 && !url) return [];
    return [{
      url,
      base64,
      mimeType: normalizeGeneratedImageMime(item.mime_type) ?? inferGeneratedImageMime(base64),
      name: `${request.mode === 'icon' ? 'AI 图标' : 'AI 生图'} ${index + 1}`
    }];
  });
}

function extractGeminiGeneratedImages(payload: unknown, request: GenerateAiImagePayload, offset: number): GeneratedImage[] {
  if (!payload || typeof payload !== 'object') return [];
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return [];
  const images: GeneratedImage[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const inlineData = (part as { inlineData?: { data?: unknown; mimeType?: unknown } }).inlineData;
      if (typeof inlineData?.data !== 'string') continue;
      images.push({
        base64: inlineData.data,
        mimeType: normalizeGeneratedImageMime(typeof inlineData.mimeType === 'string' ? inlineData.mimeType : undefined) ?? inferGeneratedImageMime(inlineData.data),
        name: `${request.mode === 'icon' ? 'AI 图标' : 'AI 生图'} ${offset + images.length + 1}`
      });
    }
  }
  return images;
}

function waitForAiTask(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('TASK_CANCELLED'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal?.reason ?? new Error('TASK_CANCELLED'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeGeneratedImageMime(mimeType: string | undefined): string | undefined {
  const normalized = mimeType?.toLowerCase();
  return normalized === 'image/png' || normalized === 'image/jpeg' || normalized === 'image/webp'
    ? normalized
    : undefined;
}

function inferGeneratedImageMime(base64: string | undefined): string | undefined {
  if (!base64) return undefined;
  try {
    return normalizeGeneratedImageMime(inferImageMime(base64ToBytes(stripBase64Prefix(base64))));
  } catch {
    return undefined;
  }
}

export async function removeImageBackground(
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
      return await removeBackgroundWithRemoveBg(settings, imageBytes, timeout.signal);
    }

    const endpointBase = settings.customImageServiceUrl;
    if (!endpointBase) {
      throw new Error('API_NOT_CONFIGURED');
    }

    const form = createMultipartBody({
      fields: [{ name: 'quality', value: payload.quality }],
      files: [{ name: 'image', filename: 'source.png', contentType: 'image/png', bytes: imageBytes }]
    });

    const response = await postForm(`${endpointBase}/remove-background`, {
      signal: timeout.signal,
      headers: { 'Content-Type': form.contentType },
      body: form.body
    });

    if (!response.ok) {
      recordRemoveBackgroundHttpError(`${endpointBase}/remove-background`, response.status, payload.service);
      throw new Error(`NETWORK_ERROR:${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw timeout.didTimeout() ? new Error('REQUEST_TIMEOUT') : error;
  } finally {
    timeout.dispose();
  }
}

async function removeBackgroundWithRemoveBg(
  settings: PluginSettings,
  imageBytes: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8Array> {
  if (!settings.removeBgApiKey) {
    throw new Error('REMOVE_BG_API_KEY_REQUIRED');
  }

  const form = createMultipartBody({
    fields: [
      { name: 'size', value: 'auto' },
      { name: 'format', value: 'png' }
    ],
    files: [{ name: 'image_file', filename: 'source.png', contentType: 'image/png', bytes: imageBytes }]
  });

  const response = await postForm('https://api.remove.bg/v1.0/removebg', {
    signal,
    headers: {
      'Content-Type': form.contentType,
      'X-Api-Key': settings.removeBgApiKey
    },
    body: form.body
  });

  if (!response.ok) {
    recordRemoveBackgroundHttpError('https://api.remove.bg/v1.0/removebg', response.status, 'removebg');
    if (response.status === 401 || response.status === 403) {
      throw new Error('REMOVE_BG_AUTH_FAILED');
    }
    if (response.status === 402 || response.status === 429) {
      throw new Error('REMOVE_BG_QUOTA_OR_RATE_LIMIT');
    }
    throw new Error(`NETWORK_ERROR:${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

type MultipartRequestInit = Omit<RequestInit, 'body' | 'method'> & {
  body: Uint8Array;
};

async function postForm(url: string, init: MultipartRequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      ...init,
      body: init.body as unknown as BodyInit
    });
  } catch (error) {
    diagnosticStore.record({
      source: 'api',
      level: 'error',
      event: 'api:network-error',
      message: errorMessage(error),
      data: { url, headers: init.headers }
    });
    throw new Error(`NETWORK_REQUEST_FAILED:${errorMessage(error)}`);
  }
}

function recordRemoveBackgroundHttpError(url: string, status: number, service: string) {
  diagnosticStore.record({
    source: 'api',
    level: 'error',
    event: 'api:http-error',
    messageType: 'PREVIEW_REMOVE_BG',
    message: `HTTP ${status}`,
    data: { url, status, service }
  });
}

type MultipartField = {
  name: string;
  value: string;
};

type MultipartFile = {
  name: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

function createMultipartBody(input: { fields: MultipartField[]; files: MultipartFile[] }): {
  body: Uint8Array;
  contentType: string;
} {
  const boundary = `----DesignProMAXBoundary${Math.random().toString(36).slice(2)}`;
  const chunks: Uint8Array[] = [];

  for (const field of input.fields) {
    chunks.push(encodeText(`--${boundary}\r\n`));
    chunks.push(encodeText(`Content-Disposition: form-data; name="${escapeHeaderValue(field.name)}"\r\n\r\n`));
    chunks.push(encodeText(`${field.value}\r\n`));
  }

  for (const file of input.files) {
    chunks.push(encodeText(`--${boundary}\r\n`));
    chunks.push(
      encodeText(
        `Content-Disposition: form-data; name="${escapeHeaderValue(file.name)}"; filename="${escapeHeaderValue(file.filename)}"\r\n`
      )
    );
    chunks.push(encodeText(`Content-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(file.bytes);
    chunks.push(encodeText('\r\n'));
  }

  chunks.push(encodeText(`--${boundary}--\r\n`));

  return {
    body: concatBytes(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function encodeText(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function escapeHeaderValue(value: string): string {
  return value.replace(/["\r\n]/g, '_');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(stripBase64Prefix(base64));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripBase64Prefix(base64: string): string {
  const match = /^data:[^;,]+;base64,(.*)$/is.exec(base64.trim());
  return match?.[1] ?? base64.trim();
}

function buildPrompt(payload: GenerateAiImagePayload): string {
  const parts = [payload.prompt.trim()];
  if (payload.style) {
    parts.push(`style: ${payload.style}`);
  }
  if (payload.color) {
    parts.push(`color palette: ${payload.color}`);
  }
  if (payload.mode === 'icon') {
    parts.push('single icon, clean vector-like design, transparent background if supported');
  }
  return parts.filter(Boolean).join('\n');
}

function ratioToSize(ratio: string): string {
  switch (ratio) {
    case '16:9':
      return '1536x864';
    case '4:3':
      return '1024x768';
    case '3:4':
      return '768x1024';
    case '9:16':
      return '864x1536';
    default:
      return '1024x1024';
  }
}
