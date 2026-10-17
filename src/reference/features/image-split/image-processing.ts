import { clampBounds, SPLIT_MAX_RESULT_BYTES, type SplitRegion, type SplitSource } from '../../shared/image-split';
export type SplitOutput = { id: string; name: string; bounds: SplitRegion; bytes: Uint8Array; url: string; inserted?: boolean; unknown?: boolean; error?: string };
export type DecodedSplitSource = { canvas: HTMLCanvasElement; url: string; pixels: ImageData; dispose: () => void };
export function checkCancelled(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('已取消', 'AbortError'); }
export async function decodeSplitSource(source: SplitSource, signal?: AbortSignal): Promise<DecodedSplitSource> {
  checkCancelled(signal);
  const bytes = new Uint8Array(source.imageBytes);
  const url = URL.createObjectURL(new Blob([bytes], { type: source.mimeType }));
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
      const abort = () => { cleanup(); image.src = ''; reject(new DOMException('已取消', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); image.src = ''; reject(new Error('图片解码超时')); }, 30_000);
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('图片解码失败')); };
      signal?.addEventListener('abort', abort, { once: true }); image.src = url;
    });
    checkCancelled(signal);
    if (image.naturalWidth !== source.width || image.naturalHeight !== source.height) throw new Error('原图尺寸不一致');
    canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('当前环境不支持图片处理');
    ctx.drawImage(image, 0, 0);
    const sample = document.createElement('canvas');
    const scale = Math.min(1, 768 / Math.max(source.width, source.height));
    sample.width = Math.max(1, Math.round(source.width * scale)); sample.height = Math.max(1, Math.round(source.height * scale));
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true }); if (!sampleCtx) throw new Error('当前环境不支持像素读取');
    sampleCtx.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height);
    sample.width = sample.height = 0;
    return { canvas, url, pixels, dispose: () => { canvas.width = canvas.height = 0; image.src = ''; URL.revokeObjectURL(url); } };
  } catch (error) { canvas.width = canvas.height = 0; URL.revokeObjectURL(url); throw error; }
}
export async function generateSplitOutputs(decoded: DecodedSplitSource, regions: SplitRegion[], sourceName: string, padding: number, signal?: AbortSignal): Promise<SplitOutput[]> {
  const results: SplitOutput[] = []; let total = 0;
  try {
    for (const [i, region] of regions.entries()) {
      checkCancelled(signal);
      const left = Math.max(0, region.x - padding), top = Math.max(0, region.y - padding);
      const bounds = { ...region, ...clampBounds({ x: left, y: top, width: Math.min(decoded.canvas.width, region.x + region.width + padding) - left, height: Math.min(decoded.canvas.height, region.y + region.height + padding) - top }, decoded.canvas.width, decoded.canvas.height) };
      const canvas = document.createElement('canvas'); canvas.width = bounds.width; canvas.height = bounds.height;
      try {
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('当前环境不支持图片处理');
        ctx.drawImage(decoded.canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG 生成失败')), 'image/png'));
        checkCancelled(signal); const bytes = new Uint8Array(await blob.arrayBuffer()); total += bytes.length;
        if (total > SPLIT_MAX_RESULT_BYTES) throw new Error('分割结果超过 48 MiB，请减少区域或缩小原图');
        results.push({ id: region.id, name: `${sourceName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) || '图片'}_${String(i + 1).padStart(2, '0')}.png`, bounds, bytes, url: URL.createObjectURL(blob) });
      } finally { canvas.width = canvas.height = 0; }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    checkCancelled(signal); return results;
  } catch (error) { results.forEach(item => URL.revokeObjectURL(item.url)); throw error; }
}
export function downloadSplitBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
