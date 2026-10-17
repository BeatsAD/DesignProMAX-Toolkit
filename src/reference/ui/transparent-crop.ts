import type { TransparentCropResultItem, TransparentCropSourceCandidate } from '../shared/messages';
import {
  calculateTransparentCropBounds,
  inspectTransparentCropPng,
  summarizeTransparentCrop,
  TRANSPARENT_CROP_ALPHA_THRESHOLD,
  TRANSPARENT_CROP_MAX_IMAGE_BYTES,
  TRANSPARENT_CROP_MAX_PIXELS
} from '../shared/transparent-crop';

const TRANSPARENT_CROP_ASYNC_TIMEOUT_MS = 8000;

type LoadedCropImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

export async function cropTransparentPngCandidate(item: TransparentCropSourceCandidate): Promise<TransparentCropResultItem> {
  if (item.mimeType !== 'image/png') {
    return skipped(item, '仅支持 PNG 图片');
  }

  const sourceBytes = new Uint8Array(item.imageBytes ?? []);
  if (sourceBytes.byteLength > TRANSPARENT_CROP_MAX_IMAGE_BYTES) {
    throw new Error('原图超过 32 MiB 单图上限');
  }
  const metadata = inspectTransparentCropPng(sourceBytes);
  if (!metadata) {
    throw new Error('PNG 文件无效');
  }
  if (metadata.pixels > TRANSPARENT_CROP_MAX_PIXELS) {
    throw new Error('图片像素超过 1200 万上限');
  }

  const image = await loadCropImage(sourceBytes, item.mimeType);
  if (image.width * image.height > TRANSPARENT_CROP_MAX_PIXELS) {
    image.close?.();
    throw new Error('图片像素超过 1200 万上限');
  }
  const sourceCanvas = document.createElement('canvas');
  let targetCanvas: HTMLCanvasElement | undefined;
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;

  try {
  const sourceContext = getCanvasContext(sourceCanvas);
  sourceContext.drawImage(image.source, 0, 0);

  const imageData = sourceContext.getImageData(0, 0, image.width, image.height);
  const bounds = calculateTransparentCropBounds(
    imageData.data,
    image.width,
    image.height,
    TRANSPARENT_CROP_ALPHA_THRESHOLD
  );

  if (!bounds) {
    return skipped(item, '整张图片均为透明像素');
  }

  const crop = summarizeTransparentCrop(image.width, image.height, bounds);
  if (!crop.isChanged) {
    return {
      ...item,
      sourcePixelWidth: image.width,
      sourcePixelHeight: image.height,
      bounds,
      crop,
      resultImageBytes: [],
      resultBytes: item.originalBytes,
      status: 'skipped',
      message: '未发现可裁剪透明边'
    };
  }

  targetCanvas = document.createElement('canvas');
  targetCanvas.width = bounds.width;
  targetCanvas.height = bounds.height;
  getCanvasContext(targetCanvas).drawImage(
    sourceCanvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  );

  const blob = await canvasToBlob(targetCanvas, 'image/png');
  const resultImageBytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  if (resultImageBytes.length > TRANSPARENT_CROP_MAX_IMAGE_BYTES) {
    throw new Error('裁剪结果超过 32 MiB 单图上限');
  }

  return {
    ...item,
    sourcePixelWidth: image.width,
    sourcePixelHeight: image.height,
    bounds,
    crop,
    resultImageBytes,
    resultBytes: resultImageBytes.length,
    status: 'ready',
    message: '可裁剪透明边'
  };
  } finally {
    image.close?.();
    sourceCanvas.width = 0;
    sourceCanvas.height = 0;
    if (targetCanvas) {
      targetCanvas.width = 0;
      targetCanvas.height = 0;
    }
  }
}

export function buildTransparentCropSummary(items: Array<Pick<TransparentCropResultItem, 'status' | 'originalBytes' | 'resultBytes'>>) {
  const total = items.length;
  const ready = items.filter((item) => item.status === 'ready').length;
  const skipped = items.filter((item) => item.status === 'skipped').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const originalBytes = items.reduce((sum, item) => sum + item.originalBytes, 0);
  const resultBytes = items.reduce((sum, item) => sum + (item.status === 'ready' ? item.resultBytes : item.originalBytes), 0);

  return {
    total,
    ready,
    skipped,
    failed,
    originalBytes,
    resultBytes,
    savedBytes: Math.max(0, originalBytes - resultBytes)
  };
}

function skipped(item: TransparentCropSourceCandidate, message: string): TransparentCropResultItem {
  return {
    ...item,
    sourcePixelWidth: Math.round(item.width ?? 0),
    sourcePixelHeight: Math.round(item.height ?? 0),
    resultImageBytes: [],
    resultBytes: item.originalBytes,
    status: 'skipped',
    message
  };
}

async function loadCropImage(bytes: Uint8Array, mimeType: string): Promise<LoadedCropImage> {
  const imageBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(imageBuffer).set(bytes);
  const blob = new Blob([imageBuffer], { type: mimeType });

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await withTimeout(createImageBitmap(blob), TRANSPARENT_CROP_ASYNC_TIMEOUT_MS, '图片解码超时');
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close()
      };
    } catch {
      // Some plugin iframe runtimes can leave createImageBitmap pending or fail silently.
    }
  }

  return loadHtmlImage(blob);
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('无法读取图片像素');
  }
  return context;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('裁剪结果生成超时'));
    }, TRANSPARENT_CROP_ASYNC_TIMEOUT_MS);

    canvas.toBlob(
      (blob) => {
        window.clearTimeout(timeout);
        if (!blob) {
          reject(new Error('裁剪结果生成失败'));
          return;
        }
        resolve(blob);
      },
      mimeType
    );
  });
}

function loadHtmlImage(blob: Blob): Promise<LoadedCropImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('图片解码超时'));
    }, TRANSPARENT_CROP_ASYNC_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    }

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      cleanup();
      if (!width || !height) {
        reject(new Error('图片解码失败'));
        return;
      }
      resolve({ source: image, width, height });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('图片解码失败'));
    };
    image.src = url;
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
