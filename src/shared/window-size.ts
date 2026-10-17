import {UI_SIZE} from './constants';
export const COMPACT_BOTTOM_SPACE = 4;
export function compactContentHeight(topbar: number, toolbar: number) {
  return Math.ceil(topbar + toolbar + COMPACT_BOTTOM_SPACE);
}

// Keep preview and Figma limits identical, including when restoring a full window.
export function normalizeWindowSize(payload: Record<string, unknown>, current: {width:number;height:number} = UI_SIZE) {
  const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  return {
    width: Math.max(320, Math.min(1440, number(payload.width, current.width))),
    height: Math.max(payload.minimized === true ? 80 : 400, Math.min(1200, number(payload.height, current.height)))
  };
}
