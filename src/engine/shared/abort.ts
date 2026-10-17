// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
export const EXTERNAL_REQUEST_TIMEOUT_MS = 120_000;

export function createTimeoutSignal(
  sourceSignal?: AbortSignal,
  timeoutMs = EXTERNAL_REQUEST_TIMEOUT_MS
): {
  signal?: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
} {
  if (typeof AbortController !== 'function') {
    return {
      signal: undefined,
      didTimeout: () => false,
      dispose: () => undefined
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromSource = () => controller.abort(sourceSignal?.reason);

  if (sourceSignal?.aborted) {
    abortFromSource();
  } else {
    sourceSignal?.addEventListener('abort', abortFromSource, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('请求超时'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      sourceSignal?.removeEventListener('abort', abortFromSource);
    }
  };
}
