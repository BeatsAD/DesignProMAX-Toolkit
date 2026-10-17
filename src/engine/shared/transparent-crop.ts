// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
export type TransparentCropBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type TransparentCropSummary = {
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  isChanged: boolean;
};

export const TRANSPARENT_CROP_ALPHA_THRESHOLD = 1;
export const TRANSPARENT_CROP_MAX_IMAGE_BYTES = 32 * 1024 * 1024;
export const TRANSPARENT_CROP_MAX_PIXELS = 12_000_000;
export const TRANSPARENT_CROP_MAX_ACTIVE_RESULT_BYTES = 48 * 1024 * 1024;

export type TransparentCropPngMetadata = {
  width: number;
  height: number;
  pixels: number;
};

export function inspectTransparentCropPng(bytes: Uint8Array): TransparentCropPngMetadata | undefined {
  if (
    bytes.length < 24
    || bytes[0] !== 0x89
    || bytes[1] !== 0x50
    || bytes[2] !== 0x4e
    || bytes[3] !== 0x47
    || bytes[4] !== 0x0d
    || bytes[5] !== 0x0a
    || bytes[6] !== 0x1a
    || bytes[7] !== 0x0a
    || bytes[12] !== 0x49
    || bytes[13] !== 0x48
    || bytes[14] !== 0x44
    || bytes[15] !== 0x52
  ) {
    return undefined;
  }

  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (width <= 0 || height <= 0) {
    return undefined;
  }

  return { width, height, pixels: width * height };
}

export function calculateTransparentCropBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = TRANSPARENT_CROP_ALPHA_THRESHOLD
): TransparentCropBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    return null;
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

export function summarizeTransparentCrop(
  sourcePixelWidth: number,
  sourcePixelHeight: number,
  bounds: TransparentCropBounds
): TransparentCropSummary {
  const cropLeft = bounds.left;
  const cropTop = bounds.top;
  const cropRight = Math.max(0, sourcePixelWidth - bounds.right - 1);
  const cropBottom = Math.max(0, sourcePixelHeight - bounds.bottom - 1);

  return {
    cropLeft,
    cropTop,
    cropRight,
    cropBottom,
    isChanged: cropLeft > 0 || cropTop > 0 || cropRight > 0 || cropBottom > 0
  };
}

export function scaleTransparentCropBounds(
  nodeWidth: number | undefined,
  nodeHeight: number | undefined,
  sourcePixelWidth: number,
  sourcePixelHeight: number,
  bounds: TransparentCropBounds
) {
  const width = typeof nodeWidth === 'number' && nodeWidth > 0 ? nodeWidth : sourcePixelWidth;
  const height = typeof nodeHeight === 'number' && nodeHeight > 0 ? nodeHeight : sourcePixelHeight;
  const scaleX = width / sourcePixelWidth;
  const scaleY = height / sourcePixelHeight;

  return {
    offsetX: bounds.left * scaleX,
    offsetY: bounds.top * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  );
}
