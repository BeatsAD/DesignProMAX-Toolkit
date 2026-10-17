import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { clampBounds, type SplitBounds, type SplitRegion, type SplitSource } from '../../../shared/image-split';

type Props = {
  source: SplitSource; url: string; regions: SplitRegion[]; active: string;
  editable: boolean; drawing: boolean; visible: boolean; scale: number;
  gesture: MutableRefObject<(() => void) | undefined>;
  onActive: (id: string) => void; onChange: (regions: SplitRegion[]) => void;
  onDraw: (bounds: SplitBounds) => void;
};

export function SplitPreview({ source, url, regions, active, editable, drawing, visible, scale, gesture, onActive, onChange, onDraw }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [newBox, setNewBox] = useState<SplitBounds>();
  useEffect(() => () => gesture.current?.(), [gesture]);

  function start(event: ReactPointerEvent, region?: SplitRegion) {
    if (!editable || event.button !== 0 || (!region && !drawing)) return;
    event.preventDefault(); event.stopPropagation(); gesture.current?.();
    const rect = stage.current!.getBoundingClientRect();
    const edge = (event.target as HTMLElement).dataset.edge;
    const point = (e: { clientX: number; clientY: number }) => ({
      x: Math.max(0, Math.min(source.width, Math.round((e.clientX - rect.left) * source.width / rect.width))),
      y: Math.max(0, Math.min(source.height, Math.round((e.clientY - rect.top) * source.height / rect.height)))
    });
    const origin = point(event); let box: SplitBounds | undefined;
    if (region) onActive(region.id);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      const p = point(e), dx = p.x - origin.x, dy = p.y - origin.y;
      if (!region) {
        box = { x: Math.min(origin.x, p.x), y: Math.min(origin.y, p.y), width: Math.abs(dx), height: Math.abs(dy) };
        setNewBox(box); return;
      }
      let bounds: SplitBounds;
      if (!edge) bounds = { ...region, x: Math.max(0, Math.min(source.width - region.width, region.x + dx)), y: Math.max(0, Math.min(source.height - region.height, region.y + dy)) };
      else {
        const x = edge.includes('l') ? Math.max(0, Math.min(region.x + region.width - 1, region.x + dx)) : region.x;
        const y = edge.includes('t') ? Math.max(0, Math.min(region.y + region.height - 1, region.y + dy)) : region.y;
        const right = edge.includes('r') ? Math.max(x + 1, Math.min(source.width, region.x + region.width + dx)) : region.x + region.width;
        const bottom = edge.includes('b') ? Math.max(y + 1, Math.min(source.height, region.y + region.height + dy)) : region.y + region.height;
        bounds = { x, y, width: right - x, height: bottom - y };
      }
      onChange(regions.map(r => r.id === region.id ? { ...r, ...clampBounds(bounds, source.width, source.height), confirmed: true } : r));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', abort);
      gesture.current = undefined; setNewBox(undefined);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      cleanup(); if (!region && box && box.width >= 2 && box.height >= 2) onDraw(clampBounds(box, source.width, source.height));
    };
    const abort = () => { cleanup(); if (region) onChange(regions); };
    gesture.current = abort;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', abort, { once: true });
  }
  const style = (r: SplitBounds) => ({ left: `${r.x / source.width * 100}%`, top: `${r.y / source.height * 100}%`, width: `${r.width / source.width * 100}%`, height: `${r.height / source.height * 100}%` });
  return <div className="image-split-viewport">
    <div ref={stage} className={`image-split-stage ${drawing ? 'is-drawing' : ''}`} style={{ width: `${scale * 100}%`, aspectRatio: `${source.width}/${source.height}` }} onPointerDown={e => start(e)}>
      <img src={url} alt="分割原图" draggable={false} />
      {(visible || editable) && regions.map((r, i) => <button key={r.id} type="button" aria-label={`区域 ${i + 1} 边界`} aria-pressed={active === r.id} className={`image-split-overlay ${editable && active === r.id ? 'is-active' : ''}`} style={style(r)} onClick={() => onActive(r.id)} onPointerDown={e => !drawing && start(e, r)}>
        <span className="image-split-number">{i + 1}</span>
        {editable && active === r.id && ['tl', 'tr', 'bl', 'br'].map(edge => <span key={edge} className="image-split-handle" data-edge={edge} />)}
      </button>)}
      {newBox && <div className="image-split-new-box" style={style(newBox)} />}
    </div>
  </div>;
}
