import { LIMITS, ResizeError, formatBytes, messages } from './errors';

export function formatFileSize(size: number): string {
  return formatBytes(size);
}

export function validateSelectedFile(file: { name: string; type: string; size: number }): void {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const extensionPdf = name.endsWith('.pdf');
  const extensionOther = name.includes('.') && !extensionPdf;
  const mimePdf = type === 'application/pdf' || type === 'application/x-pdf';
  const mimeGeneric = type === '' || type === 'application/octet-stream';
  const mimeOther = !mimePdf && !mimeGeneric;

  if (extensionOther || mimeOther) {
    throw new ResizeError('invalid_type', messages.invalidType);
  }

  if (file.size === 0) {
    throw new ResizeError('empty_file', messages.empty);
  }

  if (file.size > LIMITS.maxFileBytes) {
    throw new ResizeError(
      'too_large',
      `This PDF is ${formatBytes(file.size)}. The limit is ${formatBytes(LIMITS.maxFileBytes)}. Choose a smaller file.`,
    );
  }
}

export function resizedFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').replace(/\.pdf$/i, '').trim();
  const clean = base.replace(/[^\p{L}\p{N}.\- ()]+/gu, '').trim() || 'document';
  return `${clean}-resized.pdf`;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  const length = Math.min(bytes.length, 1024);
  let header = '';
  for (let index = 0; index < length; index += 1) {
    header += String.fromCharCode(bytes[index] ?? 0);
  }
  return header.includes('%PDF-');
}
