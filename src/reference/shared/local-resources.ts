export const LOCAL_RESOURCE_IDS = ['designpromax-vector-map-payload', 'designpromax-ocr-payload'] as const;
export const ICON_RESOURCE_CATEGORIES = ['common', 'user', 'arrow', 'file', 'device', 'data', 'chart', 'status', 'power', 'map', 'system'] as const;
export type LocalResourceId = typeof LOCAL_RESOURCE_IDS[number] | 'designpromax-icon-catalog' | 'designpromax-map-catalog' | 'designpromax-home-banner' | 'designpromax-feedback-qr' | `designpromax-icon-${typeof ICON_RESOURCE_CATEGORIES[number]}`;
export const LOCAL_RESOURCE_CHUNK_SIZE = 512 * 1024;
export const RESOURCE_INDEX_PREFIX = '<!--designpromax-resources:';
export type ResourceRange = { id: LocalResourceId; start: string; end: string };
export type LocalResourceChunk = {
  id: LocalResourceId;
  offset: number;
  total: number;
  text: string;
  appVersion: string;
  buildId: string;
};
export function isLocalResourceId(value: unknown): value is LocalResourceId {
  if (typeof value !== 'string') return false;
  return LOCAL_RESOURCE_IDS.some((id) => id === value)
    || ['designpromax-icon-catalog', 'designpromax-map-catalog', 'designpromax-home-banner', 'designpromax-feedback-qr'].includes(String(value))
    || ICON_RESOURCE_CATEGORIES.some((category) => value === `designpromax-icon-${category}`);
}
