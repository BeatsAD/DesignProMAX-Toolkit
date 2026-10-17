import { inferImageMime } from './image-compress';

export const TEXT_RECOGNITION_MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const TEXT_RECOGNITION_MAX_IMAGE_PIXELS = 12 * 1024 * 1024;
export const TEXT_RECOGNITION_MAX_LONG_EDGE = 2560;

export type TextRecognitionImageMetadata = {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  pixels: number;
};

export type TextRecognitionLine = {
  text: string;
  confidence: number;
};

export type TextRecognitionResult = {
  fullText: string;
  lines: TextRecognitionLine[];
  averageConfidence: number;
  lowConfidenceLineIndexes: number[];
  durationMs: number;
};

const CJK_OR_PUNCTUATION = '[\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF，。！？；：、】【（）《》〈〉「」『』“”‘’]';
const OCR_CJK_INTERNAL_SPACE = new RegExp(`(${CJK_OR_PUNCTUATION})[\\t \\u00A0\\u3000]+(${CJK_OR_PUNCTUATION})`, 'gu');

/**
 * 清理 OCR 在中文文字或中文标点之间误插的空格，同时保留英文单词与日期标题之间的必要间距。
 */
export function normalizeRecognizedText(text: string): string {
  let normalized = text.replace(/[^\S\r\n]+/gu, ' ');
  let previous: string;
  do {
    previous = normalized;
    normalized = normalized.replace(OCR_CJK_INTERNAL_SPACE, '$1$2');
  } while (normalized !== previous);
  return normalized;
}

/**
 * 只读取格式头，避免超大图片在 UI 解码前占用大量像素内存。
 */
export function inspectTextRecognitionImage(bytes: Uint8Array | number[]): TextRecognitionImageMetadata | undefined {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const mimeType = inferImageMime(source);
  const dimensions = mimeType === 'image/png'
    ? pngDimensions(source)
    : mimeType === 'image/jpeg'
      ? jpegDimensions(source)
      : mimeType === 'image/webp'
        ? webpDimensions(source)
        : undefined;

  if (
    !dimensions
    || (mimeType !== 'image/png' && mimeType !== 'image/jpeg' && mimeType !== 'image/webp')
  ) {
    return undefined;
  }

  return {
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    pixels: dimensions.width * dimensions.height
  };
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24) return undefined;
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  return width && height ? { width, height } : undefined;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = readUint16(bytes, offset);
    if (!length || offset + length > bytes.length) return undefined;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      const height = readUint16(bytes, offset + 3);
      const width = readUint16(bytes, offset + 5);
      return width && height ? { width, height } : undefined;
    }
    offset += length;
  }
  return undefined;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return undefined;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + readUint24(bytes, 24), height: 1 + readUint24(bytes, 27) };
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: readUint16(bytes, 26) & 0x3fff, height: readUint16(bytes, 28) & 0x3fff };
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const value = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: 1 + (value & 0x3fff), height: 1 + ((value >> 14) & 0x3fff) };
  }
  return undefined;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}
