import { isResizeError, messages, type ResizeErrorCode } from './errors';
import type { ResizeSettings } from './paperSizes';
import { inspectPdf, resizePdf } from './resizePdf';

type WorkerRequest =
  | { id: number; action: 'inspect'; bytes: ArrayBuffer }
  | { id: number; action: 'resize'; bytes: ArrayBuffer; settings: ResizeSettings };

type WorkerSuccess =
  | { id: number; ok: true; action: 'inspect'; pageCount: number }
  | { id: number; ok: true; action: 'resize'; bytes: ArrayBuffer };

type WorkerFailure = {
  id: number;
  ok: false;
  code: ResizeErrorCode;
  message: string;
};

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
};

async function handle(request: WorkerRequest): Promise<void> {
  try {
    const bytes = new Uint8Array(request.bytes);
    if (request.action === 'inspect') {
      const result = await inspectPdf(bytes);
      const response: WorkerSuccess = {
        id: request.id,
        ok: true,
        action: 'inspect',
        pageCount: result.pageCount,
      };
      scope.postMessage(response);
      return;
    }

    const resized = await resizePdf(bytes, request.settings);
    const copy = new Uint8Array(resized);
    const response: WorkerSuccess = {
      id: request.id,
      ok: true,
      action: 'resize',
      bytes: copy.buffer,
    };
    scope.postMessage(response, [copy.buffer]);
  } catch (error) {
    const failure: WorkerFailure = {
      id: request.id,
      ok: false,
      code: isResizeError(error) ? error.code : 'process_failed',
      message: isResizeError(error) ? error.message : messages.processFailed,
    };
    scope.postMessage(failure);
  }
}
