export const APP_NAME = 'DesignProMAX Toolkit';
export {APP_VERSION} from '../../shared/constants';
export const PRIMARY_BLUE = '#1664FF';

export const STORAGE_KEYS = {
  messageReadState: 'figma.toolkit.reference.messageReadState.v1',
  settings: 'figma.toolkit.reference.settings.v1',
  recentTask: 'figma.toolkit.reference.recentTask.v1',
  cache: 'figma.toolkit.reference.cache.v1',
  promptHistory: 'figma.toolkit.reference.promptHistory.v1',
  generatedImages: 'figma.toolkit.reference.generatedImages.v1',
  favoriteIcons: 'figma.toolkit.reference.favoriteIcons.v1',
  recentIcons: 'figma.toolkit.reference.recentIcons.v1',
  findReplaceHistory: 'figma.toolkit.reference.findReplaceHistory.v1',
  diagnosticSettings: 'figma.toolkit.reference.diagnosticSettings.v1',
  homeLayout: 'figma.toolkit.reference.homeLayout.v1',
  compactLayout: 'figma.toolkit.reference.compactLayout.v1',
  textFillCustomFields: 'figma.toolkit.reference.textFillCustomFields.v1'
} as const;

export const PLACEHOLDER_FEATURES = {
  imageCompress: '图片压缩',
  batchExport: '批量导出',
  vectorMap: '矢量地图'
} as const;

export const V1_PAGES = [
  'home',
  'help',
  'ai',
  'cutout',
  'transparentCrop',
  'imageSplit',
  'textFill',
  'textRecognition',
  'textSplitMerge',
  'cleanup',
  'replace',
  'locate',
  'statistics',
  'teamLibrary',
  'iconLibrary',
  'scale',
  'settings',
  'compress',
  'export',
  'map'
] as const;

export type PageId = (typeof V1_PAGES)[number];

export const HOME_TOOL_PAGE_IDS = [
  'ai',
  'cutout',
  'transparentCrop',
  'imageSplit',
  'compress',
  'textFill',
  'textRecognition',
  'textSplitMerge',
  'cleanup',
  'replace',
  'locate',
  'statistics',
  'teamLibrary',
  'iconLibrary',
  'scale',
  'export',
  'map'
] as const satisfies readonly PageId[];

export type HomeToolPageId = (typeof HOME_TOOL_PAGE_IDS)[number];
