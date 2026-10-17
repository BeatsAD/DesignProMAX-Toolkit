import type { AiProviderId, PluginSettings } from '../shared/types';

export type AiProviderProtocol = 'openai-compatible' | 'azure-openai' | 'gemini' | 'dashscope-async' | 'special-signature' | 'dedicated-api' | 'not-image';
export type AiModelDiscovery = 'models-endpoint' | 'gemini-list' | 'recommended-catalog' | 'not-available';
export type AiConnectionCheck = 'models-endpoint' | 'gemini-list' | 'dashscope-deployable-models' | 'not-available';

export type AiProviderDefinition = {
  id: AiProviderId;
  label: string;
  region: '国内' | '海外' | '自定义';
  defaultBaseUrl: string;
  protocol: AiProviderProtocol;
  authLabel: string;
  modelDiscovery: AiModelDiscovery;
  /**
   * 与模型发现分离的免计费检查方式。未填写时沿用模型发现协议，
   * 仅适用于确实可以安全复用模型列表的服务商。
   */
  connectionCheck?: AiConnectionCheck;
  supportsImageGeneration: boolean;
  suggestedModels: readonly string[];
  description: string;
  docsUrl: string;
};

/**
 * 服务商目录是模型设置、默认地址、模型获取和运行时请求分流的单一事实来源。
 * “推荐模型”仅用于补足不提供公开模型枚举接口的服务；实际可用性仍由用户账户、
 * 已开通的权限和所选地域决定。
 */
export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  {
    id: 'custom', label: '自定义 OpenAI 兼容服务', region: '自定义', defaultBaseUrl: '', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '适用于自建网关、企业私有部署及任意兼容 GET /models、POST /images/generations 的服务。',
    docsUrl: 'https://platform.openai.com/docs/api-reference/images'
  },
  {
    id: 'openai', label: 'OpenAI', region: '海外', defaultBaseUrl: 'https://api.openai.com/v1', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: ['gpt-image-1'],
    description: '标准 Images API；可用模型以账户返回的模型列表和权限为准。',
    docsUrl: 'https://platform.openai.com/docs/api-reference/images'
  },
  {
    id: 'azure-openai', label: 'Azure OpenAI', region: '海外', defaultBaseUrl: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME', protocol: 'azure-openai',
    authLabel: 'api-key 请求头', modelDiscovery: 'recommended-catalog', supportsImageGeneration: true, suggestedModels: [],
    description: '请将推荐地址中的资源名和部署名替换为你的 Azure 部署；请求会附带 Azure API 版本。',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/'
  },
  {
    id: 'google-gemini', label: 'Google Gemini / Imagen', region: '海外', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', protocol: 'gemini',
    authLabel: 'Google API Key（query key）', modelDiscovery: 'gemini-list', supportsImageGeneration: true, suggestedModels: ['gemini-2.5-flash-image-preview', 'imagen-4.0-generate-001'],
    description: '使用 Gemini 原生模型列表与 generateContent / Imagen 协议，不走 OpenAI 路由。',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/image-generation'
  },
  {
    id: 'aws-bedrock', label: 'AWS Bedrock', region: '海外', defaultBaseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com', protocol: 'special-signature',
    authLabel: 'AWS SigV4（Access Key + Secret Key）', modelDiscovery: 'not-available', supportsImageGeneration: true, suggestedModels: [],
    description: '需 AWS SigV4 和区域/模型访问权限；单一 API Key 无法安全完成签名。',
    docsUrl: 'https://docs.aws.amazon.com/bedrock/'
  },
  {
    id: 'xai', label: 'xAI', region: '海外', defaultBaseUrl: 'https://api.x.ai/v1', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '使用 xAI 账户已开通的图像模型；通过兼容模型目录读取可选项。',
    docsUrl: 'https://docs.x.ai/'
  },
  {
    id: 'stability-ai', label: 'Stability AI', region: '海外', defaultBaseUrl: 'https://api.stability.ai', protocol: 'dedicated-api',
    authLabel: 'Bearer API Key', modelDiscovery: 'recommended-catalog', supportsImageGeneration: true, suggestedModels: ['stable-image-core', 'stable-image-ultra'],
    description: '采用 Stable Image 专属端点和表单参数，当前设置页提供推荐模型与接入说明。',
    docsUrl: 'https://platform.stability.ai/docs/api-reference'
  },
  {
    id: 'black-forest-labs', label: 'Black Forest Labs（FLUX）', region: '海外', defaultBaseUrl: 'https://api.bfl.ai/v1', protocol: 'dedicated-api',
    authLabel: 'x-key 请求头', modelDiscovery: 'recommended-catalog', supportsImageGeneration: true, suggestedModels: ['flux-pro-1.1', 'flux-pro-1.1-ultra', 'flux-kontext-pro'],
    description: '创建任务后需轮询 polling_url；模型目录使用官方推荐项。',
    docsUrl: 'https://docs.bfl.ai/'
  },
  {
    id: 'replicate', label: 'Replicate', region: '海外', defaultBaseUrl: 'https://api.replicate.com/v1', protocol: 'dedicated-api',
    authLabel: 'Token API Key', modelDiscovery: 'recommended-catalog', supportsImageGeneration: true, suggestedModels: ['black-forest-labs/flux-schnell'],
    description: '按模型版本创建 prediction 并轮询任务状态；模型名通常需要包含版本或官方标识。',
    docsUrl: 'https://replicate.com/docs/reference/http'
  },
  {
    id: 'together-ai', label: 'Together AI', region: '海外', defaultBaseUrl: 'https://api.together.xyz/v1', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '兼容 OpenAI 风格模型目录和图片生成接口，模型可用性取决于账户权限。',
    docsUrl: 'https://docs.together.ai/docs/introduction'
  },
  {
    id: 'fireworks-ai', label: 'Fireworks AI', region: '海外', defaultBaseUrl: 'https://api.fireworks.ai/inference/v1', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '兼容 OpenAI 风格请求；请以账户实际开放的图像模型为准。',
    docsUrl: 'https://docs.fireworks.ai/'
  },
  {
    id: 'zhipu-ai', label: '智谱 AI', region: '国内', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: ['glm-image', 'cogview-3-plus'],
    description: '图像生成接口与标准 Images API 接近，模型以账户权限和接口返回为准。',
    docsUrl: 'https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%9B%BE%E5%83%8F%E7%94%9F%E6%88%90'
  },
  {
    id: 'baidu-qianfan', label: '百度智能云千帆', region: '国内', defaultBaseUrl: 'https://qianfan.baidubce.com/v2', protocol: 'openai-compatible',
    authLabel: 'Bearer Access Token', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '使用千帆通用图像生成地址与访问令牌；模型以控制台授权和接口返回为准。',
    docsUrl: 'https://cloud.baidu.com/doc/qianfan-api/s/8m7u6un8a'
  },
  {
    id: 'siliconflow', label: '硅基流动', region: '国内', defaultBaseUrl: 'https://api.siliconflow.cn/v1', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: ['Kwai-Kolors/Kolors', 'black-forest-labs/FLUX.1-schnell'],
    description: '图像参数与 OpenAI 略有差异，插件优先使用服务端兼容层并保留用户可修改地址。',
    docsUrl: 'https://docs.siliconflow.cn/cn/api-reference/images/images-generations'
  },
  {
    id: 'volcengine-ark', label: '火山方舟', region: '国内', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai-compatible',
    authLabel: 'Bearer API Key', modelDiscovery: 'models-endpoint', supportsImageGeneration: true, suggestedModels: [],
    description: '使用方舟视觉模型推理接入点；请在模型位置选择或填写已创建的 Endpoint ID。',
    docsUrl: 'https://www.volcengine.com/docs/82379/2375486'
  },
  {
    id: 'aliyun-bailian', label: '阿里云百炼（万相）', region: '国内', defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1', protocol: 'dashscope-async',
    authLabel: 'Bearer API Key', modelDiscovery: 'recommended-catalog', connectionCheck: 'dashscope-deployable-models', supportsImageGeneration: true, suggestedModels: ['wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus'],
    description: '万相为异步任务：创建任务后轮询 task_id；国际/北京地域可手动替换地址。',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/text-to-image-api-reference'
  },
  {
    id: 'tencent-hunyuan', label: '腾讯混元', region: '国内', defaultBaseUrl: 'https://hunyuan.tencentcloudapi.com', protocol: 'special-signature',
    authLabel: '腾讯云 TC3-HMAC-SHA256（SecretId + SecretKey）', modelDiscovery: 'not-available', supportsImageGeneration: true, suggestedModels: [],
    description: '腾讯云 API 需 TC3 签名及异步任务查询，不能用单一 API Key 直接调用。',
    docsUrl: 'https://cloud.tencent.com/document/product/1729/108738'
  },
  {
    id: 'minimax', label: 'MiniMax', region: '国内', defaultBaseUrl: 'https://api.minimaxi.com/v1', protocol: 'dedicated-api',
    authLabel: 'Bearer API Key', modelDiscovery: 'recommended-catalog', supportsImageGeneration: true, suggestedModels: [],
    description: '请根据账户开通的图像能力选择模型；专属图像请求格式与 OpenAI 兼容接口不同。',
    docsUrl: 'https://www.minimaxi.com/document'
  },
  {
    id: 'deepseek', label: 'DeepSeek（当前不支持生图）', region: '国内', defaultBaseUrl: 'https://api.deepseek.com/v1', protocol: 'not-image',
    authLabel: 'Bearer API Key', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: '当前公开 API 侧重文本与推理模型，不能作为本插件的生图或图标模型。',
    docsUrl: 'https://api-docs.deepseek.com/'
  },
  {
    id: 'moonshot', label: 'Moonshot / Kimi（当前不支持生图）', region: '国内', defaultBaseUrl: 'https://api.moonshot.cn/v1', protocol: 'not-image',
    authLabel: 'Bearer API Key', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: '当前 API 侧重对话与视觉理解，不能作为本插件的生图或图标模型。',
    docsUrl: 'https://platform.moonshot.cn/docs'
  },
  {
    id: 'baichuan', label: '百川智能（当前不支持生图）', region: '国内', defaultBaseUrl: 'https://api.baichuan-ai.com/v1', protocol: 'not-image',
    authLabel: 'Bearer API Key', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: '当前公开 API 侧重语言模型，不能作为本插件的生图或图标模型。',
    docsUrl: 'https://platform.baichuan-ai.com/docs'
  },
  {
    id: 'anthropic', label: 'Anthropic Claude（当前不支持生图）', region: '海外', defaultBaseUrl: 'https://api.anthropic.com/v1', protocol: 'not-image',
    authLabel: 'x-api-key + anthropic-version', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: 'Claude 可理解图片但不提供本插件所需的图片生成接口。',
    docsUrl: 'https://docs.anthropic.com/'
  },
  {
    id: 'cohere', label: 'Cohere（当前不支持生图）', region: '海外', defaultBaseUrl: 'https://api.cohere.com/v2', protocol: 'not-image',
    authLabel: 'Bearer API Key', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: '当前公开 API 侧重文本与检索，不能作为本插件的生图或图标模型。',
    docsUrl: 'https://docs.cohere.com/'
  },
  {
    id: 'mistral', label: 'Mistral AI（当前不支持生图）', region: '海外', defaultBaseUrl: 'https://api.mistral.ai/v1', protocol: 'not-image',
    authLabel: 'Bearer API Key', modelDiscovery: 'not-available', supportsImageGeneration: false, suggestedModels: [],
    description: '当前公开 API 侧重对话与视觉理解，不能作为本插件的生图或图标模型。',
    docsUrl: 'https://docs.mistral.ai/'
  }
];

export function getAiProviderDefinition(id: AiProviderId | string | undefined): AiProviderDefinition {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}

export function getAiProviderLabel(settings: Pick<PluginSettings, 'aiProvider' | 'aiProviderCustomName'>): string {
  const provider = getAiProviderDefinition(settings.aiProvider);
  return provider.id === 'custom' && settings.aiProviderCustomName.trim()
    ? settings.aiProviderCustomName.trim()
    : provider.label;
}

export function isAiProviderConnectionTestAvailable(provider: AiProviderDefinition): boolean {
  const connectionCheck = provider.connectionCheck ?? provider.modelDiscovery;
  return connectionCheck === 'models-endpoint'
    || connectionCheck === 'gemini-list'
    || connectionCheck === 'dashscope-deployable-models';
}

/**
 * 百炼官方公网地址目前会对 Figma iframe 的 `Origin: null` 预检返回非 2xx。
 * 这会让浏览器在实际请求和 Key 校验前中止请求。仅限制该官方直连地址；用户
 * 替换为自己提供且已配置 CORS 的透明网关后，仍可继续使用 DashScope 原生协议。
 */
export function requiresAiProviderGateway(provider: AiProviderDefinition, apiBaseUrl: string): boolean {
  return provider.id === 'aliyun-bailian'
    && /^https:\/\/dashscope\.aliyuncs\.com(?:\/|$)/i.test(apiBaseUrl.trim());
}
