// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { ImageCompressFormat } from './messages';

export type ImageCompressDecision = {
  status: 'ready' | 'skipped';
  message: string;
};

export type ImageCompressSummaryInput = {
  originalBytes: number;
  /** 最终采用的体积；跳过项必须传入 originalBytes。 */
  compressedBytes: number;
  status: 'ready' | 'skipped' | 'failed';
};

export type ImageCompressSummary = {
  total: number;
  ready: number;
  skipped: number;
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
  savedRatio: number;
};

export function inferImageMime(bytes: Uint8Array | number[]): string {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (source[0] === 0x89 && source[1] === 0x50 && source[2] === 0x4e && source[3] === 0x47) {
    return 'image/png';
  }
  if (source[0] === 0xff && source[1] === 0xd8 && source[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    source[0] === 0x52 &&
    source[1] === 0x49 &&
    source[2] === 0x46 &&
    source[3] === 0x46 &&
    source[8] === 0x57 &&
    source[9] === 0x45 &&
    source[10] === 0x42 &&
    source[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

export function shouldProtectTransparentPng(
  mimeType: string,
  outputFormat: ImageCompressFormat,
  hasAlpha: boolean
): boolean {
  return mimeType === 'image/png' && outputFormat === 'jpg' && hasAlpha;
}

export function getImageCompressDecision(originalBytes: number, compressedBytes: number): ImageCompressDecision {
  if (compressedBytes >= originalBytes) {
    return {
      status: 'skipped',
      message: '压缩后体积变大，不建议继续压缩'
    };
  }

  return {
    status: 'ready',
    message: '可写入压缩结果'
  };
}

export function buildImageCompressSummary(items: ImageCompressSummaryInput[]): ImageCompressSummary {
  const originalBytes = sum(items.map((item) => item.originalBytes));
  const compressedBytes = sum(items.map((item) =>
    item.status === 'ready' ? item.compressedBytes : item.originalBytes
  ));
  const savedBytes = Math.max(0, originalBytes - compressedBytes);

  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    skipped: items.filter((item) => item.status !== 'ready').length,
    originalBytes,
    compressedBytes,
    savedBytes,
    savedRatio: originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${round(bytes / 1024)} KB`;
  }
  return `${round(bytes / 1024 / 1024)} MB`;
}

export function calculateSavedRatio(originalBytes: number, compressedBytes: number): number {
  if (originalBytes <= 0 || compressedBytes >= originalBytes) {
    return 0;
  }
  return Math.round(((originalBytes - compressedBytes) / originalBytes) * 100);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): string {
  return value.toFixed(value >= 10 ? 1 : 2).replace(/\.0$/, '');
}
