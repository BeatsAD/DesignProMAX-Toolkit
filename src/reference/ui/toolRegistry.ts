import {
  Archive,
  BarChart3,
  Crop,
  Download,
  Eraser,
  FileSearch,
  Home,
  LibraryBig,
  LocateFixed,
  Map as MapIcon,
  Rows3,
  Scaling,
  ScanText,
  Scan,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  type LucideIcon
} from 'lucide-react';
import { HIDDEN_TOOL_PAGE_IDS } from '../shared/release-features';
import type { HomeToolPageId, PageId } from '../shared/constants';
import type { PluginSettings } from '../shared/types';

export type ToolAvailability = 'ready' | 'requires-config' | 'restricted';

export type ToolGroupId = 'ai-image' | 'text-batch' | 'inspect-locate' | 'resources';

export type ToolEntry = {
  page: HomeToolPageId;
  label: string;
  desc: string;
  icon: LucideIcon;
  group: ToolGroupId;
  availability: ToolAvailability;
};

export type NavEntry = {
  page: PageId;
  label: string;
  icon: LucideIcon;
  availability?: ToolAvailability;
};

export type ToolStatus = {
  label: string;
  tone: 'warning' | 'neutral';
};

/**
 * 暂停对外展示的能力仍保留底层实现与用户配置，避免后续重新开放时发生
 * 数据迁移或兼容性问题。所有插件可见入口必须先经过此判断。
 */
const HIDDEN_TOOL_PAGES = new Set<HomeToolPageId>(HIDDEN_TOOL_PAGE_IDS);

export function isToolVisible(page: HomeToolPageId): boolean {
  return !HIDDEN_TOOL_PAGES.has(page);
}

export const toolEntries = {
  
  cutout: { page: 'cutout', label: '一键抠图', desc: '通过外部服务移除背景', icon: Eraser, group: 'ai-image', availability: 'requires-config' },
  transparentCrop: { page: 'transparentCrop', label: '裁剪透明', desc: '裁掉 PNG 透明边', icon: Crop, group: 'ai-image', availability: 'ready' },
  imageSplit: { page: 'imageSplit', label: '图片分割', desc: '自动识别元素并拆分图片', icon: Scan, group: 'ai-image', availability: 'ready' },
  
  textFill: { page: 'textFill', label: '文本填充', desc: '自定义候选内容填充', icon: Type, group: 'text-batch', availability: 'ready' },
  textRecognition: { page: 'textRecognition', label: '文本识别', desc: '本地图片文字识别与复制', icon: ScanText, group: 'text-batch', availability: 'ready' },
  textSplitMerge: { page: 'textSplitMerge', label: '文本拆合', desc: '文本合并与标点拆分', icon: Rows3, group: 'text-batch', availability: 'ready' },
  cleanup: { page: 'cleanup', label: '图层清理', desc: '扫描后确认清理', icon: Trash2, group: 'text-batch', availability: 'ready' },
  replace: { page: 'replace', label: '文本替换', desc: '批量查找替换', icon: FileSearch, group: 'text-batch', availability: 'ready' },
  
  statistics: { page: 'statistics', label: '数据统计', desc: '跨页面设计图清单', icon: BarChart3, group: 'inspect-locate', availability: 'ready' },
  
  
  scale: { page: 'scale', label: '尺寸适配', desc: '调整容器尺寸并保留布局结构', icon: Scaling, group: 'text-batch', availability: 'ready' },
  
  
} as Record<HomeToolPageId, ToolEntry>;

export function resolveToolStatus(entry: ToolEntry, settings?: PluginSettings): ToolStatus | undefined {
  if (entry.availability === 'restricted') {
    return { label: '环境相关', tone: 'neutral' };
  }
  if (entry.availability !== 'requires-config') {
    return undefined;
  }
  if (entry.page === 'ai') {
    const configured = Boolean(settings?.apiBaseUrl && settings.apiKey && (settings.modelName || settings.iconModelName));
    return configured ? undefined : { label: '需配置', tone: 'warning' };
  }
  if (entry.page === 'cutout') {
    const configured = settings?.cutoutProvider === 'removebg'
        ? Boolean(settings.removeBgApiKey && settings.allowImageUpload)
        : settings?.cutoutProvider === 'custom'
          ? Boolean(settings.customImageServiceUrl && settings.apiKey && settings.allowImageUpload)
          : false;
    return configured ? undefined : { label: '需配置', tone: 'warning' };
  }
  return { label: '需配置', tone: 'warning' };
}

const referenceNavGroups: Array<{
  title: string;
  items: NavEntry[];
}> = [
  {
    title: '总览',
    items: [{ page: 'home', label: '首页', icon: Home }]
  },
  {
    title: '图片工具',
    items: [
      toolEntries.cutout,
      toolEntries.transparentCrop,
      toolEntries.imageSplit
    ]
  },
  {
    title: '文本与批处理',
    items: [
      toolEntries.textFill,
      toolEntries.textRecognition,
      toolEntries.textSplitMerge,
      toolEntries.cleanup,
      toolEntries.replace,
      toolEntries.scale
    ]
  },
  {
    title: '检查与统计',
    items: [toolEntries.statistics]
  }
];
export const navGroups=referenceNavGroups.map(group=>({...group,items:group.items.filter(item=>item&&(item.page==='home'||isToolVisible(item.page as HomeToolPageId)))})).filter(group=>group.items.length);
