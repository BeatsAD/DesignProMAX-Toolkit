import { APP_VERSION } from './constants';
import type { PluginSettings } from '../reference/shared/types';

export type DiagnosticLevel = 'info' | 'warning' | 'error';
export type DiagnosticSource = 'ui' | 'main' | 'api';

export type DiagnosticEntry = {
  id: string;
  timestamp: string;
  source: DiagnosticSource;
  level: DiagnosticLevel;
  event: string;
  requestId?: string;
  messageType?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
  detail?: string;
  data?: unknown;
  version: string;
};

export type DiagnosticSettings = {
  detailedEnabled: boolean;
};

export type DiagnosticExportSnapshot = {
  exportedAt: string;
  version: string;
  environment?: DiagnosticEnvironment;
  feedbackTemplate?: DiagnosticFeedbackTemplate;
  recentContext?: DiagnosticContextEntry[];
  settings?: Partial<PluginSettings>;
  diagnosticSettings: DiagnosticSettings;
  entries: DiagnosticEntry[];
};

export type DiagnosticEnvironment = {
  product: string;
  version: string;
  exportedAt: string;
  aiServiceConfigured: boolean;
  cutoutProvider: string;
  diagnosticLogCount: number;
  detailedDiagnostics: boolean;
  userAgent?: string;
  language?: string;
  platform?: string;
  viewport?: {
    width: number;
    height: number;
  };
};

export type DiagnosticFeedbackTemplate = {
  problemDescription: string;
  expectedResult: string;
  actualResult: string;
  reproductionSteps: string[];
};

export type DiagnosticContextEntry = {
  id: string;
  timestamp: string;
  event: string;
  feature?: string;
  requestId?: string;
  messageType?: string;
  result?: 'start' | 'success' | 'error' | 'timeout';
  durationMs?: number;
  errorCode?: string;
  message?: string;
  selection?: DiagnosticSelectionSummary;
  data?: unknown;
  version: string;
};

export type DiagnosticSelectionSummary = {
  count: number;
  types: Record<string, number>;
};


// Only operational metadata is retained. Never export arbitrary error text,
// settings, URLs, node identities, user input, or request/response payloads.
const EVENTS = new Set([
  'request:complete', 'request:failed', 'api:network-error', 'api:http-error',
  'app:startup-package', 'app:mounted', 'app:first-paint-opportunity',
  'app:initialization-settled', 'app:plugin-session', 'feature:enter',
  'message-center:read-save', 'selection:current'
]);
const COMMANDS = new Set(`GET_MESSAGE_READ_STATE MARK_MESSAGE_READ ACKNOWLEDGE_MESSAGE_WELCOME
GET_LOCAL_RESOURCE UI_READY RESTART_UI CANCEL_TASK GET_SELECTION GET_SETTINGS SAVE_SETTINGS
GET_HOME_LAYOUT SAVE_HOME_LAYOUT GET_COMPACT_LAYOUT SAVE_COMPACT_LAYOUT GET_TEXT_FILL_CUSTOM_FIELDS
SAVE_TEXT_FILL_CUSTOM_FIELDS CLEAR_CACHE GET_DIAGNOSTIC_STATUS SAVE_DIAGNOSTIC_SETTINGS
EXPORT_DIAGNOSTIC_LOGS CLEAR_DIAGNOSTIC_LOGS GET_REMOVE_BG_RUNTIME_CONFIG GET_REMOVE_BG_SOURCE
GET_IMAGE_SOURCE GET_TEXT_RECOGNITION_SOURCE SCAN_IMAGE_SPLIT_SOURCE APPLY_IMAGE_SPLIT
PREVIEW_REMOVE_BG APPLY_REMOVE_BG SCAN_TRANSPARENT_CROP APPLY_TRANSPARENT_CROP PREVIEW_TEXT_FILL
RUN_TEXT_FILL PREVIEW_TEXT_SPLIT_MERGE RUN_TEXT_SPLIT_MERGE SCAN_CLEANUP RUN_CLEANUP FIND_REPLACE_PREVIEW
RUN_FIND_REPLACE LIST_AVAILABLE_FONTS SCAN_FIND_REPLACE_STYLES GET_FIND_REPLACE_HISTORY
UPSERT_FIND_REPLACE_HISTORY CLEAR_FIND_REPLACE_HISTORY GET_LOCATE_PAGES SCAN_DESIGN_STATS
PREVIEW_SIZE_FIT RUN_SIZE_FIT RESIZE_UI MINIMIZE_UI SETTINGS_READ SETTINGS_SAVE READ_IMAGE WRITE_IMAGES`.split(/\s+/));
const ERROR_CODES = new Set(`INVALID INVALID_PAYLOAD INVALID_URL CANCELLED TASK_CANCELLED STALE
CONFIRM REQUEST_TIMEOUT TIMEOUT WRITE_STATE_UNKNOWN IMAGE_LIMIT SELECT_IMAGE
UPLOAD_DISABLED IMAGE_UPLOAD_DISABLED API_NOT_CONFIGURED REMOVE_BG_API_KEY_REQUIRED
NETWORK_REQUEST_FAILED FONT_LOAD_FAILED STORAGE_FULL UNKNOWN_ERROR`.split(/\s+/));
const NODE_TYPES = new Set(`TEXT FRAME GROUP RECTANGLE ELLIPSE POLYGON STAR VECTOR LINE
COMPONENT COMPONENT_SET INSTANCE SECTION PAGE SLICE BOOLEAN_OPERATION DOCUMENT UNKNOWN`.split(/\s+/));
const NUMERIC_DATA = ['status', 'htmlBytes', 'count', 'successCount', 'failedCount', 'total', 'selectionCount'] as const;
const BOOLEAN_SETTINGS = ['allowImageUpload', 'saveReplaceHistory', 'compactToolLabelsVisible'] as const;

function member<const T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}
function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : undefined;
}
function timestamp(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value))
    ? value : new Date().toISOString();
}
function known(value: unknown, allowed: Set<string>, fallback: string): string {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}
function selectionSummary(value: DiagnosticSelectionSummary | undefined): DiagnosticSelectionSummary | undefined {
  if (!value) return undefined;
  const types: Record<string, number> = {};
  for (const [key, count] of Object.entries(value.types ?? {})) {
    if (NODE_TYPES.has(key) && number(count) !== undefined) types[key] = count;
  }
  return { count: number(value.count) ?? 0, types };
}
export function sanitizeDiagnosticValue<T = unknown>(value: T): T {
  // Data is a flat allowlist: arbitrary keys and nested payloads are omitted.
  const data: Record<string, number> = {};
  if (value && typeof value === 'object') {
    for (const key of NUMERIC_DATA) {
      const item = number((value as Record<string, unknown>)[key]);
      if (item !== undefined) data[key] = item;
    }
  }
  return data as T;
}
function safeEntry(input: DiagnosticEntry, id: string): DiagnosticEntry {
  return {
    id, timestamp: timestamp(input.timestamp), version: APP_VERSION,
    source: member(input.source, ['ui', 'main', 'api'], 'ui'),
    level: member(input.level, ['info', 'warning', 'error'], 'error'),
    event: known(input.event, EVENTS, 'other'),
    ...(input.messageType ? { messageType: known(input.messageType, COMMANDS, 'OTHER') } : {}),
    ...(number(input.durationMs) !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.errorCode ? { errorCode: known(input.errorCode, ERROR_CODES, 'UNKNOWN_ERROR') } : {}),
    ...(input.data !== undefined ? { data: sanitizeDiagnosticValue(input.data) } : {})
  };
}
function safeContext(input: DiagnosticContextEntry, id: string): DiagnosticContextEntry {
  return {
    id, timestamp: timestamp(input.timestamp), version: APP_VERSION,
    event: known(input.event, EVENTS, 'other'),
    ...(input.result ? { result: member(input.result, ['start', 'success', 'error', 'timeout'], 'error') } : {}),
    ...(input.messageType ? { messageType: known(input.messageType, COMMANDS, 'OTHER') } : {}),
    ...(number(input.durationMs) !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.errorCode ? { errorCode: known(input.errorCode, ERROR_CODES, 'UNKNOWN_ERROR') } : {}),
    ...(input.selection ? { selection: selectionSummary(input.selection) } : {}),
    ...(input.data !== undefined ? { data: sanitizeDiagnosticValue(input.data) } : {})
  };
}
export function createDiagnosticStore(options: { maxEntries?: number; maxContext?: number } = {}) {
  const maxEntries = options.maxEntries ?? 200, maxContext = options.maxContext ?? 50;
  let detailedEnabled = false, serial = 0;
  let entries: DiagnosticEntry[] = [], recentContext: DiagnosticContextEntry[] = [];
  return {
    record(input: Omit<DiagnosticEntry, 'id' | 'timestamp' | 'version'>) {
      if (input.level !== 'error' && !detailedEnabled) return;
      const id = `diag_${++serial}`;
      entries = [...entries, safeEntry({ ...input, id, timestamp: new Date().toISOString(), version: APP_VERSION }, id)].slice(-maxEntries);
    },
    getEntries() { return entries.map((entry, index) => safeEntry(entry, `diag_${index + 1}`)); },
    recordContext(input: Omit<DiagnosticContextEntry, 'id' | 'timestamp' | 'version'>) {
      const id = `context_${++serial}`;
      recentContext = [...recentContext, safeContext({ ...input, id, timestamp: new Date().toISOString(), version: APP_VERSION }, id)].slice(-maxContext);
    },
    getRecentContext() { return recentContext.map((entry, index) => safeContext(entry, `context_${index + 1}`)); },
    clear() { entries = []; recentContext = []; },
    setDetailedEnabled(value: boolean) { detailedEnabled = value === true; },
    getSettings(): DiagnosticSettings { return { detailedEnabled }; }
  };
}
export const diagnosticStore = createDiagnosticStore();

export function exportDiagnostics(input: {
  entries: DiagnosticEntry[];
  settings?: PluginSettings | Partial<PluginSettings>;
  diagnosticSettings?: DiagnosticSettings;
  environment?: DiagnosticEnvironment;
  feedbackTemplate?: DiagnosticFeedbackTemplate;
  recentContext?: DiagnosticContextEntry[];
}): DiagnosticExportSnapshot {
  const exportedAt = new Date().toISOString();
  const settings: Partial<PluginSettings> = {};
  // Even URL hosts/paths and freeform configuration may identify a customer.
  for (const key of BOOLEAN_SETTINGS) {
    if (typeof input.settings?.[key] === 'boolean') settings[key] = input.settings[key];
  }
  if (input.settings?.cutoutProvider) settings.cutoutProvider = member(input.settings.cutoutProvider, ['removebg', 'custom'], 'custom');
  if (input.settings?.themeMode) settings.themeMode = member(input.settings.themeMode, ['system', 'light', 'dark'], 'system');
  const environment = input.environment;
  return {
    exportedAt, version: APP_VERSION,
    ...(environment ? { environment: {
      product: 'DesignProMAX Toolkit', version: APP_VERSION, exportedAt,
      aiServiceConfigured: environment.aiServiceConfigured === true,
      cutoutProvider: member(environment.cutoutProvider, ['', 'removebg', 'custom'], ''),
      diagnosticLogCount: input.entries.length,
      detailedDiagnostics: input.diagnosticSettings?.detailedEnabled === true,
      // Browser fingerprints, system strings and arbitrary platform values are not exported.
      ...(environment.viewport ? { viewport: { width: number(environment.viewport.width) ?? 0, height: number(environment.viewport.height) ?? 0 } } : {})
    } } : {}),
    ...(input.settings ? { settings } : {}),
    diagnosticSettings: { detailedEnabled: input.diagnosticSettings?.detailedEnabled === true },
    entries: input.entries.slice(-400).map((entry, index) => safeEntry(entry, `diag_${index + 1}`)),
    recentContext: input.recentContext?.slice(-50).map((entry, index) => safeContext(entry, `context_${index + 1}`))
    // Feedback prose is deliberately submitted separately, not in a diagnostic file.
  };
}
