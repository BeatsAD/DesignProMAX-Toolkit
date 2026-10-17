// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { AvailableFontInfo } from './messages';

type FontFamilyLocalization = {
  displayName: string;
  aliases: string[];
};

type FontStyleLocalization = {
  displayName: string;
  aliases: string[];
};

const FONT_FAMILY_LOCALIZATIONS: Record<string, FontFamilyLocalization> = {
  'Alibaba PuHuiTi': {
    displayName: '阿里巴巴普惠体',
    aliases: ['阿里普惠体', '普惠体', 'Alibaba Puhui', 'Ali PuHuiTi', 'alipuhuiti']
  },
  'Alibaba PuHuiTi 2.0': {
    displayName: '阿里巴巴普惠体 2.0',
    aliases: ['阿里普惠体 2.0', '普惠体 2.0', 'Alibaba Puhui 2.0', 'alipuhuiti 2.0']
  },
  'PingFang SC': {
    displayName: '苹方-简',
    aliases: ['苹方', '苹方简体', 'PingFang', 'pingfang']
  },
  'Microsoft YaHei': {
    displayName: '微软雅黑',
    aliases: ['微软正黑体', 'YaHei', 'weiruanyahei']
  },
  SimSun: {
    displayName: '宋体',
    aliases: ['中易宋体', 'simsun']
  },
  SimHei: {
    displayName: '黑体',
    aliases: ['中易黑体', 'simhei']
  },
  KaiTi: {
    displayName: '楷体',
    aliases: ['中易楷体', 'kaiti']
  },
  FangSong: {
    displayName: '仿宋',
    aliases: ['中易仿宋', 'fangsong']
  },
  'Source Han Sans CN': {
    displayName: '思源黑体 CN',
    aliases: ['思源黑体', 'Source Han Sans', 'siyuanheiti']
  },
  'Source Han Serif CN': {
    displayName: '思源宋体 CN',
    aliases: ['思源宋体', 'Source Han Serif', 'siyuansongti']
  }
};

const FONT_STYLE_LOCALIZATIONS: Record<string, FontStyleLocalization> = {
  Regular: { displayName: '常规体', aliases: ['常规', '普通', '正常'] },
  Normal: { displayName: '常规体', aliases: ['常规', '普通', '正常'] },
  Medium: { displayName: '中等', aliases: ['中等体', '中黑'] },
  Bold: { displayName: '粗体', aliases: ['加粗', '粗'] },
  SemiBold: { displayName: '半粗体', aliases: ['半粗', '中粗'] },
  Semibold: { displayName: '半粗体', aliases: ['半粗', '中粗'] },
  'Semi Bold': { displayName: '半粗体', aliases: ['半粗', '中粗'] },
  Light: { displayName: '细体', aliases: ['细', '轻体'] },
  ExtraLight: { displayName: '特细体', aliases: ['特细', '超细'] },
  'Extra Light': { displayName: '特细体', aliases: ['特细', '超细'] },
  Thin: { displayName: '纤细体', aliases: ['纤细', '极细'] },
  Heavy: { displayName: '特粗体', aliases: ['特粗', '重体'] },
  Black: { displayName: '超粗体', aliases: ['超粗', '黑体字重'] },
  ExtraBold: { displayName: '超粗体', aliases: ['超粗', '特粗'] },
  'Extra Bold': { displayName: '超粗体', aliases: ['超粗', '特粗'] }
};

export type AvailableFontLocalization = {
  displayFamily: string;
  displayStyle: string;
  displayLabel: string;
  aliases: string[];
  searchKeywords: string[];
  familyAliases: string[];
  styleAliases: string[];
  familySearchKeywords: string[];
  styleSearchKeywords: string[];
};

export function createAvailableFontLocalization(
  family: string,
  style: string,
  localized?: { family?: string; style?: string; aliases?: string[] }
): AvailableFontLocalization {
  const familyLocalization = FONT_FAMILY_LOCALIZATIONS[family];
  const styleLocalization = FONT_STYLE_LOCALIZATIONS[style];
  const displayFamily = cleanString(localized?.family) ?? familyLocalization?.displayName ?? family;
  const displayStyle = cleanString(localized?.style) ?? styleLocalization?.displayName ?? style;
  const familyLabel = formatFontFamilyDisplayLabel(family, displayFamily);
  const displayLabel = `${familyLabel} / ${displayStyle}`;
  const familyAliases = uniqueStrings([
    ...(localized?.aliases ?? []),
    ...(familyLocalization?.aliases ?? [])
  ]);
  const styleAliases = uniqueStrings([
    ...(styleLocalization?.aliases ?? [])
  ]);
  const aliases = uniqueStrings([...familyAliases, ...styleAliases]);
  const familySearchKeywords = uniqueStrings([
    family,
    displayFamily,
    familyLabel,
    ...familyAliases
  ]);
  const styleSearchKeywords = uniqueStrings([style, displayStyle, ...styleAliases]);
  const searchKeywords = uniqueStrings([...familySearchKeywords, ...styleSearchKeywords, `${family} / ${style}`, displayLabel]);

  return {
    displayFamily,
    displayStyle,
    displayLabel,
    aliases,
    searchKeywords,
    familyAliases,
    styleAliases,
    familySearchKeywords,
    styleSearchKeywords
  };
}

export function getAvailableFontDisplayLabel(font: AvailableFontInfo): string {
  return cleanString(font.displayLabel)
    ?? createAvailableFontLocalization(font.family, font.style, {
      family: font.displayFamily,
      style: font.displayStyle,
      aliases: font.aliases
    }).displayLabel;
}

export function getAvailableFontFamilyDisplayLabel(font: AvailableFontInfo): string {
  const displayFamily = cleanString(font.displayFamily)
    ?? createAvailableFontLocalization(font.family, font.style, { aliases: font.familyAliases }).displayFamily;
  return formatFontFamilyDisplayLabel(font.family, displayFamily);
}

export function getAvailableFontStyleDisplayLabel(font: AvailableFontInfo): string {
  const displayStyle = cleanString(font.displayStyle)
    ?? createAvailableFontLocalization(font.family, font.style, { aliases: font.styleAliases }).displayStyle;
  return displayStyle === font.style ? font.style : `${displayStyle}（${font.style}）`;
}

export function matchesAvailableFontQuery(font: AvailableFontInfo, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const values = font.searchKeywords?.length
    ? font.searchKeywords
    : createAvailableFontLocalization(font.family, font.style, {
      family: font.displayFamily,
      style: font.displayStyle,
      aliases: font.aliases
    }).searchKeywords;
  return values.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

export function matchesAvailableFontFamilyQuery(font: AvailableFontInfo, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const values = font.familySearchKeywords?.length
    ? font.familySearchKeywords
    : createAvailableFontLocalization(font.family, font.style, {
      family: font.displayFamily,
      aliases: font.familyAliases ?? font.aliases
    }).familySearchKeywords;
  return values.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

export function compareAvailableFontStyles(left: AvailableFontInfo, right: AvailableFontInfo): number {
  const weightDifference = fontStyleSortWeight(left.style) - fontStyleSortWeight(right.style);
  return weightDifference || left.style.localeCompare(right.style, undefined, { numeric: true, sensitivity: 'base' });
}

function formatFontFamilyDisplayLabel(family: string, displayFamily: string): string {
  return displayFamily === family ? family : `${displayFamily}（${family}）`;
}

function fontStyleSortWeight(style: string): number {
  const normalized = style.toLocaleLowerCase().replace(/[\s_-]+/g, '');
  if (normalized.includes('thin')) return 100;
  if (normalized.includes('extralight') || normalized.includes('ultralight')) return 200;
  if (normalized.includes('light')) return 300;
  if (normalized.includes('regular') || normalized.includes('normal') || normalized.includes('book')) return 400;
  if (normalized.includes('medium')) return 500;
  if (normalized.includes('semibold') || normalized.includes('demibold')) return 600;
  if (normalized.includes('extrabold') || normalized.includes('ultrabold')) return 800;
  if (normalized.includes('bold')) return 700;
  if (normalized.includes('heavy')) return 900;
  if (normalized.includes('black')) return 950;
  return 1000;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = cleanString(value);
    if (!trimmed) return [];
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}
