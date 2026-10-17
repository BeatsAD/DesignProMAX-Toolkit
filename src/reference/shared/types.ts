import type { HomeToolPageId } from './constants';

export type InsertPosition = 'viewportCenter' | 'frameCenter';
export type CutoutProvider = 'removebg' | 'custom';
import type {ThemePreference} from '../../shared/theme';
export type {ThemeMode} from '../../shared/theme';

/**
 * AI 服务商标识只用于本地配置和请求路由；服务商详情、推荐地址和协议能力由
 * services/ai-providers.ts 统一维护，避免 UI 与请求层各自维护一套名单。
 */
export const AI_PROVIDER_IDS = [
  'custom',
  'openai',
  'azure-openai',
  'google-gemini',
  'aws-bedrock',
  'xai',
  'stability-ai',
  'black-forest-labs',
  'replicate',
  'together-ai',
  'fireworks-ai',
  'zhipu-ai',
  'baidu-qianfan',
  'siliconflow',
  'volcengine-ark',
  'aliyun-bailian',
  'tencent-hunyuan',
  'minimax',
  'deepseek',
  'moonshot',
  'baichuan',
  'anthropic',
  'cohere',
  'mistral'
] as const;

export type AiProviderId = typeof AI_PROVIDER_IDS[number];

export type PluginSettings = {
  aiProvider: AiProviderId;
  aiProviderCustomName: string;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  iconModelName: string;
  customImageServiceUrl: string;
  removeBgApiKey: string;
  cutoutProvider: CutoutProvider | '';
  allowImageUpload: boolean;
  savePromptHistory: boolean;
  saveGeneratedImages: boolean;
  saveReplaceHistory: boolean;
  defaultImageRatio: string;
  defaultImageStyle: string;
  defaultInsertPosition: InsertPosition | '';
  themeMode: ThemePreference;
  compactToolLabelsVisible: boolean;
  maxImageCompressBytes: number;
  allowWebpExport: boolean;
  allowLossyReplaceOriginal: boolean;
};

/**
 * 仅供 UI iframe 的 AI 服务请求使用。它不是 UI 与 Figma 主线程之间的
 * 消息载荷，外部 AI 请求不得经过主线程转发。
 */
export type GenerateAiImagePayload = {
  mode: 'image' | 'icon';
  prompt: string;
  ratio?: string;
  style?: string;
  color?: string;
  count: 1 | 2 | 4;
  model?: string;
};

export type HomeLayoutSettings = {
  orderedPageIds: HomeToolPageId[];
  hiddenPageIds: HomeToolPageId[];
};

export type SelectionNodeSnapshot = {
  id: string;
  name: string;
  type: string;
  typeLabel?: string;
  visible?: boolean;
  locked?: boolean;
  width?: number;
  height?: number;
  hasImageFill?: boolean;
  imageMimeType?: string;
  previewImageBytes?: number[];
  previewMimeType?: 'image/png';
  text?: string;
  pageName?: string;
};

export type SelectionSnapshot = {
  count: number;
  nodes: SelectionNodeSnapshot[];
};

export type TaskState = 'idle' | 'loading' | 'success' | 'error' | 'cancelled';

export type PreviewItem = {
  nodeId: string;
  name: string;
  before: string;
  after: string;
  fieldType?: string;
  fieldLabel?: string;
  source?: 'default' | 'custom';
  fillMode?: 'sequence' | 'random' | 'cycle' | 'fixed';
  masked?: boolean;
  /** false 表示这是供总额分配重新勾选的候选项，本次不会写入。 */
  canRun?: boolean;
};

export type NumericPreviewSummary = {
  strategy: 'serial' | 'rangeRandom' | 'totalRandom' | 'code';
  targetCount: number;
  formattedTotal?: string;
};

export type PreviewResult<TItem = PreviewItem> = {
  items: TItem[];
  total: number;
  skipped: number;
  scannedCount?: number;
  skippedLockedCount?: number;
  instanceInternalCount?: number;
  traversalMode?: 'children' | 'deep-query';
  officialHiddenCount?: number;
  fallbackHiddenCount?: number;
  officialLockedCount?: number;
  numericSummary?: NumericPreviewSummary;
};

export type CleanupCandidate = {
  nodeId: string;
  name: string;
  type: string;
  typeLabel?: string;
  reason: string;
  pageName?: string;
  locked?: boolean;
  insideInstance?: boolean;
};

export type ScalePreviewItem = {
  nodeId: string;
  name: string;
  typeLabel?: string;
  previewImageBytes?: number[];
  previewMimeType?: 'image/png';
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
};

export type SizeFitPreviewChange = {
  nodeId: string;
  name: string;
  changeType: 'move' | 'resize' | 'moveAndResize';
  beforeX?: number;
  beforeY?: number;
  afterX?: number;
  afterY?: number;
  beforeWidth?: number;
  beforeHeight?: number;
  afterWidth?: number;
  afterHeight?: number;
};

export type SizeFitPreviewItem = {
  nodeId: string;
  name: string;
  typeLabel?: string;
  previewImageBytes?: number[];
  previewMimeType?: 'image/png';
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  widthRatio: number;
  heightRatio: number;
  fitMode: 'autoLayout' | 'conservative' | 'smart' | 'leaf' | 'noChange' | 'blocked';
  fitModeLabel: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceLabel: string;
  movedCount: number;
  resizedCount: number;
  preservedCount: number;
  frozenCount: number;
  changes: SizeFitPreviewChange[];
  warnings: string[];
  canRun: boolean;
  blockedReason?: string;
};

export type LocateResult = {
  nodeId: string;
  name: string;
  type: string;
  typeLabel?: string;
  previewImageBytes?: number[];
  previewMimeType?: 'image/png';
  pageId?: string;
  pageName?: string;
};

export type ToolExecutionResult = {
  cancelled?: boolean;
  successCount: number;
  failedCount: number;
  message: string;
  recoverable: boolean;
};
