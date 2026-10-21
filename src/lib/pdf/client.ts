import { ResizeError, messages, type ResizeErrorCode } from './errors';
import type { ResizeSettings } from './paperSizes';

type WorkerSuccess =
  | { id: number; ok: true; action: 'inspect'; pageCount: number }
  | { id: number; ok: true; action: 'resize'; bytes: ArrayBuffer };

type WorkerFailure = {
  id: number;
  ok: false;
  code: ResizeErrorCode;
  message: string;
};

type Pending = {
  resolve: (value: WorkerSuccess) => void;
  reject: (error: ResizeError) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./resize.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerSuccess | WorkerFailure>) => {
    const message = event.data;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.ok) {
      waiter.resolve(message);
      return;
    }
    waiter.reject(new ResizeError(message.code, message.message));
  };
  worker.onerror = () => {
    const error = new ResizeError('process_failed', messages.processFailed);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function send(
  message: { action: 'inspect' } | { action: 'resize'; settings: ResizeSettings },
  bytes: ArrayBuffer,
): Promise<WorkerSuccess> {
  const id = nextId;
  nextId += 1;
  const copy = bytes.slice(0);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...message, id, bytes: copy }, [copy]);
  });
}

export async function inspectPdfInBrowser(bytes: ArrayBuffer): Promise<{ pageCount: number }> {
  const response = await send({ action: 'inspect' }, bytes);
  if (response.action !== 'inspect') {
    throw new ResizeError('process_failed', messages.processFailed);
  }
  return { pageCount: response.pageCount };
}

export async function resizePdfInBrowser(
  bytes: ArrayBuffer,
  settings: ResizeSettings,
): Promise<ArrayBuffer> {
  const response = await send({ action: 'resize', settings }, bytes);
  if (response.action !== 'resize') {
    throw new ResizeError('process_failed', messages.processFailed);
  }
  return response.bytes;
}
