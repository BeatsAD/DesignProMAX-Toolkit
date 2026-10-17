import type {TextFillCustomField, TextFillRule} from '../../../shared/messages';
import {createParameterSignature} from '../../../ui/preview-snapshot';

type Draft = {id?: string; name: string; customInput: string; fillMode: TextFillRule['fillMode']};

export function parseCustomValues(input: string): string[] {
  return input.split(/[\n,，]/).map(value => value.trim()).filter(Boolean);
}

/** An unchanged editor is presentation state, not a new execution configuration. */
export function createTextFillConfigurationSignature(fields: TextFillCustomField[], draft: Draft | null): string {
  const saved = draft?.id ? fields.find(field => field.id === draft.id) : undefined;
  const values = draft ? parseCustomValues(draft.customInput) : [];
  const unchanged = saved && draft && draft.name.trim() === saved.name
    && draft.fillMode === saved.fillMode && JSON.stringify(values) === JSON.stringify(saved.values);
  return createParameterSignature(fields, !draft || unchanged ? null : {
    id: draft.id, name: draft.name.trim(), values, fillMode: draft.fillMode
  });
}
