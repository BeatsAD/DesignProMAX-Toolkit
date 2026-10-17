import type { TextFillCustomField } from './messages';

export const MAX_TEXT_FILL_CUSTOM_FIELDS = 20;
export const MAX_TEXT_FILL_CUSTOM_VALUES = 100;
export const MAX_TEXT_FILL_CUSTOM_NAME_LENGTH = 20;
export const MAX_TEXT_FILL_CUSTOM_VALUE_LENGTH = 100;

const FILL_MODES = new Set<TextFillCustomField['fillMode']>(['sequence', 'random', 'cycle', 'fixed']);

export function normalizeTextFillCustomFields(input: unknown): TextFillCustomField[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const names = new Set<string>();
  const normalized: TextFillCustomField[] = [];
  for (const candidate of input.slice(0, MAX_TEXT_FILL_CUSTOM_FIELDS)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Partial<TextFillCustomField>;
    const id = typeof record.id === 'string' ? record.id.trim().slice(0, 64) : '';
    const name = typeof record.name === 'string' ? record.name.trim().slice(0, MAX_TEXT_FILL_CUSTOM_NAME_LENGTH) : '';
    const nameKey = name.toLocaleLowerCase();
    const values = normalizeTextFillCustomValues(record.values);
    const fillMode = record.fillMode && FILL_MODES.has(record.fillMode) ? record.fillMode : 'sequence';
    if (!id || !name || names.has(nameKey) || values.length === 0) continue;
    names.add(nameKey);
    normalized.push({ id, name, values, fillMode });
  }
  return normalized;
}

export function normalizeTextFillCustomValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().slice(0, MAX_TEXT_FILL_CUSTOM_VALUE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TEXT_FILL_CUSTOM_VALUES);
}
