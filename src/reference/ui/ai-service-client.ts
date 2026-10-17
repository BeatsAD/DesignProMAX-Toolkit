/**
 * AI 服务请求只能从插件 UI iframe 发起。
 *
 * Figma 主线程不是浏览器运行时，真实环境没有 fetch。此模块将 UI 的
 * 浏览器网络失败统一映射为可操作的提示，同时不改变服务商协议适配层。
 */
import {
  generateAiImages as requestAiImageGeneration,
  getAvailableAiModels as requestAvailableAiModels,
  testAiServiceConnection as requestAiServiceConnection,
  type AiServiceConnectionResult,
  type GeneratedImage
} from '../services/api-client';
import type { GenerateAiImagePayload, PluginSettings } from '../shared/types';

export type { AiServiceConnectionResult, GeneratedImage };

export type AiServiceCredentials = Pick<PluginSettings, 'apiBaseUrl' | 'apiKey'>
  & Partial<Pick<PluginSettings, 'aiProvider'>>;

export async function getAvailableAiModels(
  credentials: AiServiceCredentials,
  signal?: AbortSignal
): Promise<string[]> {
  return requestFromUi(() => requestAvailableAiModels(credentials, signal));
}

export async function testAiServiceConnection(
  credentials: AiServiceCredentials,
  signal?: AbortSignal
): Promise<AiServiceConnectionResult> {
  return requestFromUi(() => requestAiServiceConnection(credentials, signal));
}

export async function generateAiImages(
  settings: PluginSettings,
  payload: GenerateAiImagePayload,
  signal?: AbortSignal
): Promise<GeneratedImage[]> {
  return requestFromUi(() => requestAiImageGeneration(settings, payload, signal));
}

async function requestFromUi<TResult>(request: () => Promise<TResult>): Promise<TResult> {
  try {
    return await request();
  } catch (error) {
    if (isBrowserNetworkOrCorsFailure(error)) {
      throw new Error('AI_UI_NETWORK_OR_CORS_BLOCKED');
    }
    throw error;
  }
}

function isBrowserNetworkOrCorsFailure(error: unknown): boolean {
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return /(fetch|network|failed to fetch)/i.test(error.message);
  }
  return false;
}
