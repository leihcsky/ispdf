import { useEffect, useRef, useState } from 'react';
import { fileSizeMb, trackEvent } from '../../lib/analytics';
import { ResizeError, isResizeError, messages, type ResizeErrorCode } from '../../lib/pdf/errors';
import { resizedFilename, validateSelectedFile } from '../../lib/pdf/files';
import { inspectPdfInBrowser, resizePdfInBrowser } from '../../lib/pdf/client';
import { defaultSettings, resolveTargetSize, type ResizeSettings } from '../../lib/pdf/paperSizes';
import ProcessingStatus from './ProcessingStatus';
import ResizeSettingsPanel from './ResizeSettings';
import ResultPanel from './ResultPanel';
import UploadPanel from './UploadPanel';

type Phase = 'idle' | 'ready' | 'processing' | 'complete' | 'error';

interface ResultState {
  url: string;
  filename: string;
}

export default function ResizeApp() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<ResizeSettings>(defaultSettings);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const resultRef = useRef<ResultState | null>(null);
  const requestId = useRef(0);
  const returnToUpload = useRef(false);

  useEffect(() => {
    return () => {
      if (resultRef.current?.url) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  useEffect(() => {
    if (!returnToUpload.current || phase !== 'idle') return;
    returnToUpload.current = false;
    document.getElementById('resize-upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [phase]);

  function replaceResult(next: ResultState | null) {
    if (resultRef.current?.url && resultRef.current.url !== next?.url) {
      URL.revokeObjectURL(resultRef.current.url);
    }
    resultRef.current = next;
    setResult(next);
  }

  function removeFile() {
    requestId.current += 1;
    setFile(null);
    setPageCount(null);
    setPhase('idle');
    setStatus('');
    setFileError(null);
    setActionError(null);
    replaceResult(null);
  }

  function resizeAnother() {
    trackEvent('resize_another', resizeParams());
    returnToUpload.current = true;
    removeFile();
  }

  function resizeParams() {
    return {
      paper_size: settings.preset,
      orientation: settings.orientation,
      fit_mode: settings.mode,
      ...(settings.preset === 'custom'
        ? {
            size_unit: settings.customUnit,
            custom_width: Number.isFinite(settings.customWidth) ? settings.customWidth : undefined,
            custom_height: Number.isFinite(settings.customHeight) ? settings.customHeight : undefined,
          }
        : {}),
      page_count: pageCount ?? undefined,
      file_size_mb: file ? fileSizeMb(file.size) : undefined,
    };
  }

  async function acceptFile(next: File) {
    const request = requestId.current + 1;
    requestId.current = request;
    const size = { file_size_mb: fileSizeMb(next.size) };
    trackEvent('select_file', size);
    setFile(next);
    setPageCount(null);
    setFileError(null);
    setActionError(null);
    replaceResult(null);
    setPhase('processing');
    setStatus('Checking file');
    try {
      validateSelectedFile(next);
      const bytes = await next.arrayBuffer();
      if (request !== requestId.current) return;
      const info = await inspectPdfInBrowser(bytes);
      if (request !== requestId.current) return;
      setPageCount(info.pageCount);
      setPhase('ready');
      setStatus('');
      trackEvent('file_ready', { ...size, page_count: info.pageCount });
    } catch (caught) {
      if (request !== requestId.current) return;
      setPageCount(null);
      setPhase('error');
      setStatus('');
      setFileError(caught instanceof ResizeError ? caught.message : messages.corrupt);
      trackEvent('file_rejected', {
        ...size,
        error_code: caught instanceof ResizeError ? caught.code : 'corrupt',
      });
    }
  }

  function failureCode(caught: unknown, fallback: ResizeErrorCode): ResizeErrorCode {
    return caught instanceof ResizeError ? caught.code : fallback;
  }

  async function resize() {
    if (phase === 'processing') return;
    if (!file || fileError) {
      trackEvent('resize_failed', { error_code: 'no_file' });
      setPhase('error');
      setFileError(fileError ?? messages.noFile);
      setStatus('');
      return;
    }

    try {
      resolveTargetSize(settings);
    } catch (caught) {
      trackEvent('resize_failed', { ...resizeParams(), error_code: failureCode(caught, 'invalid_size') });
      setPhase('error');
      setStatus('');
      setActionError(caught instanceof ResizeError ? caught.message : messages.invalidSize);
      return;
    }

    const request = requestId.current + 1;
    requestId.current = request;
    const params = resizeParams();
    trackEvent('resize_pdf', params);
    setPhase('processing');
    setActionError(null);
    replaceResult(null);
    setStatus('Preparing file');

    try {
      const bytes = await file.arrayBuffer();
      if (request !== requestId.current) return;
      setStatus('Resizing pages');
      const output = await resizePdfInBrowser(bytes, settings);
      if (request !== requestId.current) return;
      setStatus('Preparing download');
      const url = URL.createObjectURL(new Blob([output], { type: 'application/pdf' }));
      replaceResult({ url, filename: resizedFilename(file.name) });
      setStatus('Complete');
      setPhase('complete');
      trackEvent('resize_complete', { ...params, output_size_mb: fileSizeMb(output.byteLength) });
    } catch (caught) {
      if (request !== requestId.current) return;
      setPhase('error');
      setStatus('');
      setActionError(isResizeError(caught) ? caught.message : messages.processFailed);
      trackEvent('resize_failed', { ...params, error_code: failureCode(caught, 'process_failed') });
    }
  }

  function downloadResult() {
    trackEvent('download_pdf', resizeParams());
  }

  const processing = phase === 'processing';

  return (
    <div className="tool">
      <UploadPanel
        file={file}
        pageCount={pageCount}
        checking={processing && !pageCount && !fileError}
        fileError={fileError}
        disabled={processing}
        onFile={acceptFile}
        onRemove={() => {
          trackEvent('remove_file', {
            page_count: pageCount ?? undefined,
            file_size_mb: file ? fileSizeMb(file.size) : undefined,
            had_error: Boolean(fileError),
          });
          removeFile();
        }}
      />
      <ResizeSettingsPanel
        settings={settings}
        disabled={processing}
        onChange={(next) => {
          setSettings(next);
          setActionError(null);
        }}
      />
      <button
        type="button"
        className="button button-primary"
        onClick={resize}
        disabled={processing || Boolean(fileError)}
        aria-busy={processing}
      >
        {processing ? status || 'Resizing pages' : 'Resize PDF'}
      </button>
      <ProcessingStatus message={status} />
      {actionError ? (
        <p className="alert" role="alert">
          {actionError}
        </p>
      ) : null}
      {phase === 'complete' && result ? (
        <ResultPanel
          url={result.url}
          filename={result.filename}
          onDownload={downloadResult}
          onReset={resizeAnother}
        />
      ) : null}
    </div>
  );
}
