import { useEffect, useRef, useState } from 'react';
import { ResizeError, isResizeError, messages } from '../../lib/pdf/errors';
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
    returnToUpload.current = true;
    removeFile();
  }

  async function acceptFile(next: File) {
    const request = requestId.current + 1;
    requestId.current = request;
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
    } catch (caught) {
      if (request !== requestId.current) return;
      setPageCount(null);
      setPhase('error');
      setStatus('');
      setFileError(caught instanceof ResizeError ? caught.message : messages.corrupt);
    }
  }

  async function resize() {
    if (phase === 'processing') return;
    if (!file || fileError) {
      setPhase('error');
      setFileError(fileError ?? messages.noFile);
      setStatus('');
      return;
    }

    try {
      resolveTargetSize(settings);
    } catch (caught) {
      setPhase('error');
      setStatus('');
      setActionError(caught instanceof ResizeError ? caught.message : messages.invalidSize);
      return;
    }

    const request = requestId.current + 1;
    requestId.current = request;
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
    } catch (caught) {
      if (request !== requestId.current) return;
      setPhase('error');
      setStatus('');
      setActionError(isResizeError(caught) ? caught.message : messages.processFailed);
    }
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
        onRemove={removeFile}
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
        <ResultPanel url={result.url} filename={result.filename} onReset={resizeAnother} />
      ) : null}
    </div>
  );
}
