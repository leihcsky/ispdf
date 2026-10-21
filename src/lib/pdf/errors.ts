export const LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  minPoints: 1,
  maxPoints: 14400,
} as const;

export type ResizeErrorCode =
  | 'no_file'
  | 'empty_file'
  | 'invalid_type'
  | 'too_large'
  | 'encrypted'
  | 'corrupt'
  | 'invalid_size'
  | 'process_failed'
  | 'out_of_memory';

const maxMegabytes = LIMITS.maxFileBytes / (1024 * 1024);

export const messages = {
  noFile: 'Choose a PDF file before resizing.',
  empty: 'This file is empty. Choose a PDF with at least one page.',
  invalidType: 'This file is not a PDF. Choose a .pdf file and try again.',
  tooLarge: `This PDF is larger than ${maxMegabytes} MB. Choose a smaller file.`,
  encrypted:
    'This PDF is encrypted or password-protected. Remove the password and try again.',
  corrupt:
    'This file could not be read as a PDF. Check that it is not damaged, then try another file.',
  invalidSize:
    'Enter a width and height greater than 0. Each side must be between 1 point and 200 inches.',
  processFailed:
    'The PDF could not be resized. Try Fit mode, or use a simpler PDF.',
  outOfMemory:
    'Your browser ran out of memory while resizing this PDF. Try a smaller file.',
} as const;

export class ResizeError extends Error {
  readonly code: ResizeErrorCode;

  constructor(code: ResizeErrorCode, message: string) {
    super(message);
    this.name = 'ResizeError';
    this.code = code;
  }
}

export function isResizeError(error: unknown): error is ResizeError {
  return error instanceof ResizeError;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
