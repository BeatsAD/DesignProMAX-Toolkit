import type {HostRuntime} from './host-runtime';

/** Only use around a short synchronous mutation, after all async preparation. */
export function mutateWithRecovery<T>(host: HostRuntime, mutate: (changed: () => void) => T, recover: () => void): T {
  const nativeUndo = Boolean(host.beginUndoStep && host.rollbackUndoStep);
  if (nativeUndo) host.beginUndoStep!();
  let changed = false, committing = false;
  try {
    const result = mutate(() => { changed = true; });
    if (changed) { committing = true; host.commitUndo?.(); }
    return result;
  } catch (error) {
    if (committing) throw new Error('WRITE_STATE_UNKNOWN');
    try {
      if (changed && nativeUndo) {
        // Seal this failed step before undoing it. Figma otherwise undoes the
        // previously committed step, including its original source nodes.
        host.commitUndo?.();
        host.rollbackUndoStep!();
      }
      else if (changed) recover();
    } catch { throw new Error('WRITE_STATE_UNKNOWN'); }
    throw error;
  }
}
