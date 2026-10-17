// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { HandlerContext, TaskCancellationSignal } from './host-runtime';

export type TaskHandle = {
  readonly signal: TaskCancellationSignal;
};

class CooperativeTaskHandle implements TaskHandle {
  private cancelled = false;
  private readonly listeners = new Set<() => void>();
  readonly signal: TaskCancellationSignal;

  constructor() {
    const handle = this;
    this.signal = {
      get aborted() {
        return handle.cancelled;
      },
      onCancel: (listener) => handle.onCancel(listener)
    };
  }

  abort(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    const listeners = [...this.listeners];
    this.listeners.clear();
    for (const listener of listeners) listener();
  }

  private onCancel(listener: () => void): () => void {
    if (this.cancelled) {
      listener();
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class SingleTaskController {
  private activeTask?: { requestId: string; handle: CooperativeTaskHandle };

  begin(requestId: string): TaskHandle | undefined {
    if (this.activeTask) return undefined;
    const handle = new CooperativeTaskHandle();
    this.activeTask = { requestId, handle };
    return handle;
  }

  cancel(requestId: string): boolean {
    if (this.activeTask?.requestId !== requestId) return false;
    const task = this.activeTask;
    this.activeTask = undefined;
    task.handle.abort();
    return true;
  }

  complete(requestId: string): void {
    if (this.activeTask?.requestId === requestId) this.activeTask = undefined;
  }
}

export function throwIfTaskCancelled(context: HandlerContext): void {
  if (context.signal?.aborted) {
    throw new Error('TASK_CANCELLED');
  }
}

export function reportTaskProgress(context: HandlerContext, current: number, total: number, text: string): void {
  context.reportProgress?.(current, total, text);
}

export async function yieldTask(context: HandlerContext): Promise<void> {
  throwIfTaskCancelled(context);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  throwIfTaskCancelled(context);
}

/** A cancelled batch acknowledges work already completed instead of losing its receipt. */
export async function runItemBatch<T>(context: HandlerContext, items: readonly T[], run: (item: T, index: number) => Promise<boolean>): Promise<{successCount: number; failedCount: number; cancelled: boolean}> {
  let successCount = 0, failedCount = 0, processed = 0;
  for (const [index, item] of items.entries()) {
    if (context.signal?.aborted) break;
    try { if (await run(item, index)) successCount++; else failedCount++; }
    catch (error) {
      if (error instanceof Error && error.message === 'WRITE_STATE_UNKNOWN') throw error;
      if (context.signal?.aborted) break;
      failedCount++;
    }
    processed++;
    if (processed < items.length) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (!processed && context.signal?.aborted) throw new Error('TASK_CANCELLED');
  return {successCount, failedCount, cancelled: processed < items.length && context.signal?.aborted === true};
}

export function withTaskTimeout<T>(context: HandlerContext, promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: () => void = () => undefined;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
      settle();
    };
    const abort = () => finish(() => reject(new Error('TASK_CANCELLED')));
    timer = setTimeout(() => finish(() => reject(new Error(errorMessage))), timeoutMs);
    unsubscribe = context.signal?.onCancel(abort) ?? unsubscribe;
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
}
