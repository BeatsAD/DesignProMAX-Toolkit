/** Detection uses a bounded thumbnail; all returned bounds are restored to source pixels. */
export type SplitMode = 'auto' | 'cards' | 'elements';
export type SplitBounds = { x: number; y: number; width: number; height: number };
export type SplitRegion = SplitBounds & { id: string; confirmed: boolean };
export const SPLIT_MAX_REGIONS = 50;
export const SPLIT_MAX_RESULT_BYTES = 48 * 1024 * 1024;
export type SplitSource = {
  sourceToken?: string;
  nodeId: string; nodeName: string; width: number; height: number;
  imageBytes: number[]; mimeType: string; fingerprint: string;
};
export type SplitWritePayload = {
  confirmed: boolean; source: { sourceToken: string; nodeId: string; fingerprint: string; width: number; height: number };
  items: Array<{ id: string; name: string; bounds: SplitBounds; imageBytes: number[] }>;
};
export type SplitWriteResult = { items: Array<{ id: string; nodeId?: string; error?: string }>; cancelled: boolean };

export function clampBounds(b: SplitBounds, width: number, height: number): SplitBounds {
  const x = Math.max(0, Math.min(width - 1, Math.round(b.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(b.y)));
  return { x, y, width: Math.max(1, Math.min(width - x, Math.round(b.width))), height: Math.max(1, Math.min(height - y, Math.round(b.height))) };
}
export function sourceFingerprint(bytes: Uint8Array): string {
  // A full-byte fingerprint also catches same-ref source changes before writing.
  let hash = 2166136261;
  for (const value of bytes) hash = Math.imul(hash ^ value, 16777619);
  return `${bytes.length}:${hash >>> 0}`;
}
function spans(flags: boolean[]): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (flags[i] && start < 0) start = i;
    if (!flags[i] && start >= 0) { result.push([start, i]); start = -1; }
  }
  return result;
}
export function detectSplitRegions(
  rgba: Uint8ClampedArray, w: number, h: number, sourceWidth: number, sourceHeight: number,
  mode: SplitMode = 'auto', rows = 0, columns = 0, tolerance = 24
): { regions: SplitRegion[]; method: 'cards' | 'elements'; warning?: string } {
  if (rgba.length !== w * h * 4 || !w || !h) throw new Error('图片像素无效');
  const restore = (boxes: SplitBounds[], confirmed: boolean): SplitRegion[] => {
    if (boxes.length > SPLIT_MAX_REGIONS) throw new Error('候选区域超过 50 个，请降低识别灵敏度或手动指定行列');
    return boxes.map((b, i) => ({ ...clampBounds({ x: b.x * sourceWidth / w, y: b.y * sourceHeight / h,
      width: b.width * sourceWidth / w, height: b.height * sourceHeight / h }, sourceWidth, sourceHeight), id: `region-${i + 1}`, confirmed }));
  };
  const grid = (ys: Array<[number, number]>, xs: Array<[number, number]>) => ys.flatMap(([y, bottom]) =>
    xs.map(([x, right]) => ({ x, y, width: right - x, height: bottom - y })));
  if (mode === 'cards' && rows > 0 && columns > 0) {
    const ys = Array.from({ length: rows }, (_, i) => [Math.round(i * h / rows), Math.round((i + 1) * h / rows)] as [number, number]);
    const xs = Array.from({ length: columns }, (_, i) => [Math.round(i * w / columns), Math.round((i + 1) * w / columns)] as [number, number]);
    return { regions: restore(grid(ys, xs), true), method: 'cards' };
  }
  // Full-height/full-width pale dividers. Decorative white pixels cannot form a divider.
  const divider = (vertical: boolean) => Array.from({ length: vertical ? w : h }, (_, a) => {
    let white = 0;
    for (let b = 0; b < (vertical ? h : w); b++) {
      const p = ((vertical ? b * w + a : a * w + b)) * 4;
      if (rgba[p + 3] > 245 && Math.min(rgba[p], rgba[p + 1], rgba[p + 2]) > 225
        && Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) - Math.min(rgba[p], rgba[p + 1], rgba[p + 2]) < 15) white++;
    }
    return white / (vertical ? h : w) > 0.96;
  });
  const intervals = (flags: boolean[]) => spans(flags.map(v => !v)).filter(([a, b]) => b - a > flags.length * 0.06);
  const xs = intervals(divider(true)), ys = intervals(divider(false));
  if (mode !== 'elements' && xs.length && ys.length && xs.length * ys.length > 1) {
    return { regions: restore(grid(ys, xs), true), method: 'cards' };
  }
  if (mode === 'cards') return { regions: [], method: 'cards', warning: '未找到清晰的卡片分隔线，请指定行数和列数' };
  // Median border colour resists a foreground object touching one border.
  const border: number[][] = [[], [], []]; let transparent = 0, samples = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
    const p = (y * w + x) * 4; samples++;
    if (rgba[p + 3] < 16) transparent++;
    for (let c = 0; c < 3; c++) border[c].push(rgba[p + c]);
  }
  const bg = border.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
  const alphaBackground = transparent / samples > 0.5;
  const foreground = new Uint8Array(w * h);
  const col = new Array<number>(w).fill(0), row = new Array<number>(h).fill(0);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const on = rgba[p + 3] > (alphaBackground ? 8 : 16) && (alphaBackground || Math.max(...bg.map((v, c) => Math.abs(v - rgba[p + c]))) > tolerance);
    if (on) { foreground[i] = 1; col[i % w]++; row[Math.floor(i / w)]++; }
  }
  // Projection gaps keep a character's disconnected crown, props and glow together.
  const bands = (counts: number[], cross: number) => {
    const flags = counts.map(n => n > Math.max(1, cross * 0.002));
    const parts = spans(flags);
    const merged: Array<[number, number]> = [];
    for (const part of parts) {
      const last = merged[merged.length - 1];
      if (last && part[0] - last[1] <= Math.max(2, counts.length * 0.005)) last[1] = part[1];
      else merged.push([...part]);
    }
    return merged;
  };
  const xBands = bands(col, h), yBands = bands(row, w);
  const boxes: SplitBounds[] = [];
  for (const [left, right] of xBands) for (const [top, bottom] of yBands) {
    let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (foreground[y * w + x]) {
      count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (count >= Math.max(9, w * h * 0.001)) boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
  }
  // Attach small nearby components to a larger character rather than counting accessories.
  const ordered = [...boxes].sort((a, b) => b.width * b.height - a.width * a.height);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const small = ordered[i]; let best = -1, distance = Infinity;
    for (let j = 0; j < i; j++) {
      const large = ordered[j];
      if (large.width * large.height < small.width * small.height * 3) continue;
      const dx = Math.max(0, large.x - (small.x + small.width), small.x - (large.x + large.width));
      const dy = Math.max(0, large.y - (small.y + small.height), small.y - (large.y + large.height));
      const d = Math.hypot(dx, dy);
      if ((dx === 0 || dy === 0) && d <= Math.max(large.width, large.height) * 0.35 && d < distance) { best = j; distance = d; }
    }
    if (best >= 0) {
      const large = ordered[best]; const x = Math.min(small.x, large.x), y = Math.min(small.y, large.y);
      ordered[best] = { x, y, width: Math.max(small.x + small.width, large.x + large.width) - x, height: Math.max(small.y + small.height, large.y + large.height) - y };
      ordered.splice(i, 1);
    }
  }
  boxes.splice(0, boxes.length, ...ordered.sort((a, b) => Math.abs(a.y - b.y) > h * 0.15 ? a.y - b.y : a.x - b.x));
  const ambiguous = !alphaBackground || boxes.length === 1;
  return { regions: restore(boxes, !ambiguous), method: 'elements', warning: ambiguous ? '请核对元素数量与边界；复杂背景、相连元素可手动拆分或合并' : undefined };
}
