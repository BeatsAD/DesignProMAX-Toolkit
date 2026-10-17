import { HOME_TOOL_PAGE_IDS, STORAGE_KEYS, type HomeToolPageId } from '../shared/constants';
import { AI_PROVIDER_IDS, type HomeLayoutSettings, type PluginSettings } from '../shared/types';
import type {
  FindReplaceHistoryEntry,
  FindReplaceStyleKind,
  FindReplaceTextStyle,
  TextFillCustomField,
  UpsertFindReplaceHistoryPayload
} from '../shared/messages';
import { normalizeTextFillCustomFields } from '../shared/text-fill-custom-fields';

export const DEFAULT_SETTINGS: PluginSettings = {
  aiProvider: 'custom',
  aiProviderCustomName: '',
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
  iconModelName: '',
  customImageServiceUrl: '',
  removeBgApiKey: '',
  cutoutProvider: '',
  allowImageUpload: false,
  savePromptHistory: false,
  saveGeneratedImages: false,
  saveReplaceHistory: true,
  defaultImageRatio: '',
  defaultImageStyle: '',
  defaultInsertPosition: '',
  themeMode: 'system',
  compactToolLabelsVisible: true,
  maxImageCompressBytes: 8 * 1024 * 1024,
  allowWebpExport: true,
  allowLossyReplaceOriginal: false
};

export type ClientStorageLike = {
  getAsync<T = unknown>(key: string): Promise<T | undefined>;
  setAsync<T = unknown>(key: string, value: T): Promise<void>;
  deleteAsync(key: string): Promise<void>;
};

export const DEFAULT_CLIENT_STORAGE_TIMEOUT_MS = 8000;

export type ClientStorageOperation = 'get' | 'set' | 'delete';

export type ClientStorageTimeoutEvent = {
  operation: ClientStorageOperation;
  key: string;
  timeoutMs: number;
  durationMs: number;
};

export type ClientStorageFailureEvent = ClientStorageTimeoutEvent & {
  message: string;
};

export type TimedClientStorageOptions = {
  timeoutMs?: number;
  onTimeout?: (event: ClientStorageTimeoutEvent) => void;
  onFailure?: (event: ClientStorageFailureEvent) => void;
};

export function createTimedClientStorage(
  storage: ClientStorageLike,
  options: TimedClientStorageOptions = {}
): ClientStorageLike {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CLIENT_STORAGE_TIMEOUT_MS;

  return {
    getAsync: <T = unknown>(key: string) => withClientStorageTimeout(
      () => storage.getAsync<T>(key),
      { key, operation: 'get', timeoutMs },
      options
    ),
    setAsync: <T = unknown>(key: string, value: T) => withClientStorageTimeout(
      () => storage.setAsync(key, value),
      { key, operation: 'set', timeoutMs },
      options
    ),
    deleteAsync: (key: string) => withClientStorageTimeout(
      () => storage.deleteAsync(key),
      { key, operation: 'delete', timeoutMs },
      options
    )
  };
}

export function normalizeSettings(input: Partial<PluginSettings> | undefined): PluginSettings {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(input ?? {})
  };

  return {
    ...DEFAULT_SETTINGS,
    aiProvider: isAiProvider(settings.aiProvider) ? settings.aiProvider : DEFAULT_SETTINGS.aiProvider,
    aiProviderCustomName: settings.aiProviderCustomName?.trim() ?? '',
    apiBaseUrl: trimUrl(settings.apiBaseUrl),
    apiKey: settings.apiKey?.trim() ?? '',
    modelName: settings.modelName?.trim() ?? '',
    iconModelName: settings.iconModelName?.trim() ?? '',
    customImageServiceUrl: trimUrl(settings.customImageServiceUrl),
    removeBgApiKey: settings.removeBgApiKey?.trim() ?? '',
    cutoutProvider: isCutoutProvider(settings.cutoutProvider) ? settings.cutoutProvider : '',
    allowImageUpload: settings.allowImageUpload,
    defaultImageRatio: settings.defaultImageRatio?.trim() ?? '',
    defaultImageStyle: settings.defaultImageStyle?.trim() ?? '',
    defaultInsertPosition:
      settings.defaultInsertPosition === 'viewportCenter' || settings.defaultInsertPosition === 'frameCenter'
        ? settings.defaultInsertPosition
        : '',
    themeMode: isThemeMode(settings.themeMode) ? settings.themeMode : DEFAULT_SETTINGS.themeMode,
    compactToolLabelsVisible: settings.compactToolLabelsVisible !== false,
    savePromptHistory: false,
    saveGeneratedImages: false,
    saveReplaceHistory: settings.saveReplaceHistory !== false,
    maxImageCompressBytes: normalizeMaxImageCompressBytes(settings.maxImageCompressBytes),
    allowWebpExport: Boolean(settings.allowWebpExport),
    allowLossyReplaceOriginal: Boolean(settings.allowLossyReplaceOriginal)
  };
}

export function redactSettings(settings: PluginSettings): PluginSettings {
  return {
    ...settings,
    apiKey: settings.apiKey ? '********' : '',
    removeBgApiKey: settings.removeBgApiKey ? '********' : ''
  };
}

export async function loadSettings(storage: ClientStorageLike): Promise<PluginSettings> {
  const saved = await storage.getAsync<Partial<PluginSettings>>(STORAGE_KEYS.settings);
  return normalizeSettings(saved);
}

export async function saveSettings(storage: ClientStorageLike, settings: Partial<PluginSettings>): Promise<PluginSettings> {
  const existing = await loadSettings(storage);
  const normalized = normalizeSettings({
    ...existing,
    ...settings,
    apiKey: settings.apiKey === '********' ? existing.apiKey : settings.apiKey ?? existing.apiKey,
    removeBgApiKey:
      settings.removeBgApiKey === '********' ? existing.removeBgApiKey : settings.removeBgApiKey ?? existing.removeBgApiKey
  });

  await storage.setAsync(STORAGE_KEYS.settings, normalized);
  return normalized;
}

export function normalizeHomeLayout(input: Partial<HomeLayoutSettings> | undefined): HomeLayoutSettings {
  return normalizeToolLayout(input);
}

export function normalizeCompactLayout(input: Partial<HomeLayoutSettings> | undefined): HomeLayoutSettings {
  return normalizeToolLayout(input);
}

function normalizeToolLayout(input: Partial<HomeLayoutSettings> | undefined): HomeLayoutSettings {
  const orderedPageIds = uniqueHomeToolPageIds(input?.orderedPageIds);
  const hiddenPageIds = uniqueHomeToolPageIds(input?.hiddenPageIds);
  const orderedWithFallbacks = [
    ...orderedPageIds,
    ...HOME_TOOL_PAGE_IDS.filter((pageId) => !orderedPageIds.includes(pageId))
  ];

  return {
    orderedPageIds: orderedWithFallbacks,
    hiddenPageIds
  };
}

export async function loadHomeLayout(storage: ClientStorageLike): Promise<HomeLayoutSettings> {
  const saved = await storage.getAsync<Partial<HomeLayoutSettings>>(STORAGE_KEYS.homeLayout);
  return normalizeHomeLayout(saved);
}

export async function saveHomeLayout(
  storage: ClientStorageLike,
  layout: Partial<HomeLayoutSettings>
): Promise<HomeLayoutSettings> {
  const normalized = normalizeHomeLayout(layout);
  await storage.setAsync(STORAGE_KEYS.homeLayout, normalized);
  return normalized;
}

export async function loadCompactLayout(storage: ClientStorageLike): Promise<HomeLayoutSettings> {
  const saved = await storage.getAsync<Partial<HomeLayoutSettings>>(STORAGE_KEYS.compactLayout);
  return normalizeCompactLayout(saved);
}

export async function saveCompactLayout(
  storage: ClientStorageLike,
  layout: Partial<HomeLayoutSettings>
): Promise<HomeLayoutSettings> {
  const normalized = normalizeCompactLayout(layout);
  await storage.setAsync(STORAGE_KEYS.compactLayout, normalized);
  return normalized;
}

export async function loadTextFillCustomFields(storage: ClientStorageLike): Promise<TextFillCustomField[]> {
  const saved = await storage.getAsync<unknown>(STORAGE_KEYS.textFillCustomFields);
  return normalizeTextFillCustomFields(saved);
}

export async function saveTextFillCustomFields(
  storage: ClientStorageLike,
  fields: TextFillCustomField[]
): Promise<TextFillCustomField[]> {
  const normalized = normalizeTextFillCustomFields(fields);
  await storage.setAsync(STORAGE_KEYS.textFillCustomFields, normalized);
  return normalized;
}

export function normalizeFindReplaceHistory(input: unknown): FindReplaceHistoryEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const entries: FindReplaceHistoryEntry[] = [];
  const seen = new Set<string>();
  for (const rawEntry of input) {
    const entry = normalizeFindReplaceHistoryEntry(rawEntry);
    if (!entry) {
      continue;
    }
    const key = findReplaceHistoryKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  return entries
    .sort((left, right) => right.usedAt - left.usedAt)
    .filter((entry, index, all) => all.slice(0, index).filter((item) => item.kind === entry.kind).length < 8);
}

export async function loadFindReplaceHistory(storage: ClientStorageLike): Promise<FindReplaceHistoryEntry[]> {
  return normalizeFindReplaceHistory(await storage.getAsync<unknown>(STORAGE_KEYS.findReplaceHistory));
}

export async function upsertFindReplaceHistory(
  storage: ClientStorageLike,
  payload: UpsertFindReplaceHistoryPayload
): Promise<FindReplaceHistoryEntry[]> {
  const entry = normalizeFindReplaceHistoryEntry({ ...payload, usedAt: Date.now() });
  if (!entry) {
    throw new Error('INVALID_FIND_REPLACE_HISTORY');
  }
  const existing = await loadFindReplaceHistory(storage);
  const key = findReplaceHistoryKey(entry);
  const next = normalizeFindReplaceHistory([entry, ...existing.filter((item) => findReplaceHistoryKey(item) !== key)]);
  await storage.setAsync(STORAGE_KEYS.findReplaceHistory, next);
  return next;
}

export async function clearFindReplaceHistory(storage: ClientStorageLike): Promise<{ cleared: true }> {
  await storage.deleteAsync(STORAGE_KEYS.findReplaceHistory);
  return { cleared: true };
}

export async function clearStoredData(
  storage: ClientStorageLike,
  scope: 'cache' | 'history' | 'all'
): Promise<{ clearedKeys: string[] }> {
  const keys =
    scope === 'all'
      ? Object.values(STORAGE_KEYS)
      : scope === 'history'
        ? [STORAGE_KEYS.promptHistory, STORAGE_KEYS.generatedImages, STORAGE_KEYS.recentTask, STORAGE_KEYS.findReplaceHistory]
        : [STORAGE_KEYS.cache];

  for (const key of keys) {
    await storage.deleteAsync(key);
  }

  return { clearedKeys: keys };
}

function normalizeFindReplaceHistoryEntry(input: unknown): FindReplaceHistoryEntry | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const candidate = input as Partial<FindReplaceHistoryEntry>;
  if (!isFindReplaceStyleKind(candidate.kind) || !Array.isArray(candidate.sourceStyles)) {
    return undefined;
  }
  const sourceStyles = candidate.sourceStyles
    .map((style) => normalizeHistoryStyle(candidate.kind as FindReplaceStyleKind, style))
    .filter((style): style is FindReplaceTextStyle => Boolean(style));
  const targetStyle = normalizeHistoryStyle(candidate.kind, candidate.targetStyle);
  const usedAt = typeof candidate.usedAt === 'number' && Number.isFinite(candidate.usedAt) && candidate.usedAt > 0
    ? candidate.usedAt
    : undefined;
  if (!sourceStyles.length || !targetStyle || !usedAt) {
    return undefined;
  }
  const uniqueSources = [...new Map(sourceStyles.map((style) => [historyStyleKey(candidate.kind as FindReplaceStyleKind, style), style])).values()]
    .sort((left, right) => historyStyleKey(candidate.kind as FindReplaceStyleKind, left).localeCompare(historyStyleKey(candidate.kind as FindReplaceStyleKind, right)));
  return { kind: candidate.kind, sourceStyles: uniqueSources, targetStyle, usedAt };
}

function normalizeHistoryStyle(kind: FindReplaceStyleKind, input: unknown): FindReplaceTextStyle | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const style = input as FindReplaceTextStyle;
  if (kind === 'font') {
    const fontFamily = style.fontFamily?.trim();
    if (!fontFamily) return undefined;
    return { fontFamily, fontStyle: style.fontStyle?.trim() || 'Regular' };
  }
  if (kind === 'fontSize') {
    return typeof style.fontSize === 'number' && Number.isFinite(style.fontSize) && style.fontSize > 0 && style.fontSize <= 1000
      ? { fontSize: style.fontSize }
      : undefined;
  }
  const color = normalizeHistoryColor(style.color);
  return color ? { color } : undefined;
}

function normalizeHistoryColor(value: string | undefined): string | undefined {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value?.trim() ?? '');
  return match ? `#${match[1].toUpperCase()}` : undefined;
}

function isFindReplaceStyleKind(value: unknown): value is FindReplaceStyleKind {
  return value === 'font' || value === 'fontSize' || value === 'color';
}

function historyStyleKey(kind: FindReplaceStyleKind, style: FindReplaceTextStyle): string {
  if (kind === 'font') return `${style.fontFamily}\u0000${style.fontStyle || 'Regular'}`;
  if (kind === 'fontSize') return String(style.fontSize);
  return style.color ?? '';
}

function findReplaceHistoryKey(entry: Pick<FindReplaceHistoryEntry, 'kind' | 'sourceStyles' | 'targetStyle'>): string {
  return `${entry.kind}:${entry.sourceStyles.map((style) => historyStyleKey(entry.kind, style)).sort().join('|')}->${historyStyleKey(entry.kind, entry.targetStyle)}`;
}

function trimUrl(value: string): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

async function withClientStorageTimeout<T>(
  run: () => Promise<T>,
  event: Pick<ClientStorageTimeoutEvent, 'key' | 'operation' | 'timeoutMs'>,
  options: TimedClientStorageOptions
): Promise<T> {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const timeoutEvent = {
            ...event,
            durationMs: Date.now() - startedAt
          };
          options.onTimeout?.(timeoutEvent);
          reject(new ClientStorageTimeoutError(timeoutEvent));
        }, event.timeoutMs);
      })
    ]);
  } catch (error) {
    if (error instanceof ClientStorageTimeoutError) {
      throw error;
    }
    options.onFailure?.({
      ...event,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    });
    throw new ClientStorageUnavailableError(event, error);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

class ClientStorageTimeoutError extends Error {
  constructor(event: ClientStorageTimeoutEvent) {
    super(`STORAGE_TIMEOUT:${event.operation}:${event.key}:${event.timeoutMs}`);
    this.name = 'ClientStorageTimeoutError';
  }
}

class ClientStorageUnavailableError extends Error {
  constructor(
    event: Pick<ClientStorageTimeoutEvent, 'key' | 'operation' | 'timeoutMs'>,
    cause: unknown
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`STORAGE_UNAVAILABLE:${event.operation}:${event.key}:${message}`);
    this.name = 'ClientStorageUnavailableError';
  }
}

function isCutoutProvider(value: unknown): value is PluginSettings['cutoutProvider'] {
  return value === 'removebg' || value === 'custom';
}

function isAiProvider(value: unknown): value is PluginSettings['aiProvider'] {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

function isThemeMode(value: unknown): value is PluginSettings['themeMode'] {
  return value === 'system' || value === 'light' || value === 'dark';
}

function uniqueHomeToolPageIds(value: unknown): HomeToolPageId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validPageIds = new Set<HomeToolPageId>(HOME_TOOL_PAGE_IDS);
  const result: HomeToolPageId[] = [];

  for (const pageId of value) {
    if (validPageIds.has(pageId) && !result.includes(pageId)) {
      result.push(pageId);
    }
  }

  return result;
}

function normalizeMaxImageCompressBytes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_SETTINGS.maxImageCompressBytes;
  }

  return Math.min(Math.max(Math.round(value), 1024 * 1024), 32 * 1024 * 1024);
}
