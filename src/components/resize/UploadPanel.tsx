import { useEffect, useRef } from 'react';
import { LIMITS } from '../../lib/pdf/errors';
import { formatFileSize } from '../../lib/pdf/files';

interface UploadPanelProps {
  file: File | null;
  pageCount: number | null;
  checking: boolean;
  fileError: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

export default function UploadPanel({
  file,
  pageCount,
  checking,
  fileError,
  disabled,
  onFile,
  onRemove,
}: UploadPanelProps) {
  const maxMegabytes = LIMITS.maxFileBytes / (1024 * 1024);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!fileError) return;
    errorRef.current?.focus();
    errorRef.current?.scrollIntoView({ block: 'center' });
  }, [fileError]);

  function takeFile(list: FileList | null) {
    const next = list?.[0];
    if (next) onFile(next);
  }

  const errorAlert = fileError ? (
    <p className="alert" role="alert" tabIndex={-1} ref={errorRef}>
      {fileError}
    </p>
  ) : null;

  return (
    <div className="upload" id="resize-upload">
      {file ? (
        <div className={fileError ? 'file-card file-card-error' : 'file-card'}>
          <p className="file-name">{file.name}</p>
          <p className="file-meta">
            {formatFileSize(file.size)}
            {pageCount !== null ? ` · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : ''}
            {checking ? ' · Checking file…' : ''}
          </p>
          {errorAlert}
          <div className="file-actions">
            <label className="button button-secondary">
              Replace file
              <input
                className="visually-hidden"
                type="file"
                accept="application/pdf,.pdf"
                disabled={disabled}
                onChange={(event) => {
                  takeFile(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
            <button type="button" className="button button-secondary" onClick={onRemove} disabled={disabled}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className="dropzone"
          onDragOver={(event) => {
            event.preventDefault();
            event.currentTarget.dataset.active = 'true';
          }}
          onDragLeave={(event) => {
            event.currentTarget.dataset.active = 'false';
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.currentTarget.dataset.active = 'false';
            if (!disabled) takeFile(event.dataTransfer.files);
          }}
        >
          <span className="dropzone-title">Drop your PDF here or choose a file</span>
          <span className="dropzone-note">Adjusts page dimensions, not PDF file size.</span>
          <span className="dropzone-note">Up to {maxMegabytes} MB.</span>
          <input
            className="dropzone-input"
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            onChange={(event) => {
              takeFile(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      )}
      {!file ? errorAlert : null}
    </div>
  );
}
