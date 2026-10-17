export type UiMessage = { type: 'UI_READY' } | { type: 'CLOSE_PLUGIN' };
export type SessionMessage = {
  type: 'SESSION_STATE';
  version: string;
  selectionCount: number;
};

export function isUiMessage(value: unknown): value is UiMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as Record<string, unknown>).type;
  return type === 'UI_READY' || type === 'CLOSE_PLUGIN';
}

export function isSessionMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.type === 'SESSION_STATE'
    && typeof message.version === 'string'
    && typeof message.selectionCount === 'number'
    && Number.isSafeInteger(message.selectionCount)
    && message.selectionCount >= 0;
}
