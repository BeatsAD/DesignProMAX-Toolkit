import { APP_VERSION } from '../../shared/constants';
import type { PluginSettings } from './types';

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

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_CONTEXT = 50;
const SECRET_KEY_PATTERN = /(api[-_]?key|authorization|token|secret|signature|removebgapikey|remove[-_]?bg[-_]?api[-_]?key)/i;
const BINARY_KEY_PATTERN = /(bytes|base64|b64|b64_json|imagebytes|resultimagebytes|previewimagebytes)/i;
const TEXT_KEY_PATTERN = /^(prompt|text|beforeText|afterText)$/i;
const URL_SECRET_PARAM_PATTERN = /(key|token|secret|signature|authorization|api[-_]?key)/i;

export function createDiagnosticStore(options: { maxEntries?: number; maxContext?: number } = {}) {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxContext = options.maxContext ?? DEFAULT_MAX_CONTEXT;
  let detailedEnabled = false;
  let entries: DiagnosticEntry[] = [];
  let recentContext: DiagnosticContextEntry[] = [];

  return {
    record(input: Omit<DiagnosticEntry, 'id' | 'timestamp' | 'version'>) {
      if (input.level !== 'error' && !detailedEnabled) {
        return;
      }

      entries = [
        ...entries,
        {
          ...input,
          id: createDiagnosticId(),
          timestamp: new Date().toISOString(),
          data: input.data === undefined ? undefined : sanitizeDiagnosticValue(input.data),
          version: APP_VERSION
        }
      ].slice(-maxEntries);
    },
    getEntries() {
      return entries;
    },
    recordContext(input: Omit<DiagnosticContextEntry, 'id' | 'timestamp' | 'version'>) {
      recentContext = [
        ...recentContext,
        {
          ...input,
          id: createDiagnosticId(),
          timestamp: new Date().toISOString(),
          data: input.data === undefined ? undefined : sanitizeDiagnosticValue(input.data),
          version: APP_VERSION
        }
      ].slice(-maxContext);
    },
    getRecentContext() {
      return recentContext;
    },
    clear() {
      entries = [];
    },
    setDetailedEnabled(value: boolean) {
      detailedEnabled = value;
    },
    getSettings(): DiagnosticSettings {
      return { detailedEnabled };
    }
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
  return {
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    environment: input.environment ? sanitizeDiagnosticValue(input.environment) : undefined,
    feedbackTemplate: input.feedbackTemplate ? sanitizeDiagnosticValue(input.feedbackTemplate) : undefined,
    recentContext: input.recentContext?.map((entry) => ({
      ...entry,
      data: entry.data === undefined ? undefined : sanitizeDiagnosticValue(entry.data)
    })),
    settings: input.settings ? redactSettingsLike(input.settings) : undefined,
    diagnosticSettings: input.diagnosticSettings ?? diagnosticStore.getSettings(),
    entries: input.entries.map((entry) => ({
      ...entry,
      data: entry.data === undefined ? undefined : sanitizeDiagnosticValue(entry.data)
    }))
  };
}

export function sanitizeDiagnosticValue<T = unknown>(value: T): T {
  return sanitizeValue(value, '') as T;
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (SECRET_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (BINARY_KEY_PATTERN.test(key)) {
    return '[BINARY_REDACTED]';
  }

  if (TEXT_KEY_PATTERN.test(key) && typeof value === 'string') {
    return { redacted: true, length: value.length };
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return '[BINARY_REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = sanitizeValue(entryValue, entryKey);
    }
    return result;
  }

  return value;
}

function sanitizeString(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    // Figma main has no browser URL constructor. Redact query values directly.
    return trimmed.replace(/([?&])([^=&#]+)=([^&#]*)/g,(match,separator,key)=>{
      let decoded=key;try{decoded=decodeURIComponent(key);}catch{/* Preserve malformed keys. */}
      return URL_SECRET_PARAM_PATTERN.test(decoded)?`${separator}${key}=[REDACTED]`:match;
    }).replace(/^(https?:\/\/)[^/@]+@/i,'$1[REDACTED]@');
  }

  if (/data:image\/|^[A-Za-z0-9+/]{80,}={0,2}$/.test(trimmed)) {
    return '[BINARY_REDACTED]';
  }

  return value;
}

function redactSettingsLike(settings: Partial<PluginSettings>): Partial<PluginSettings> {
  return {
    ...settings,
    apiKey: settings.apiKey ? '********' : '',
    removeBgApiKey: settings.removeBgApiKey ? '********' : ''
  };
}

function createDiagnosticId(): string {
  const randomPart = Math.random().toString(36).slice(2);
  return `diag_${Date.now()}_${randomPart}`;
}
