import {
  EncryptedPDFError,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { LIMITS, ResizeError, isResizeError, messages } from './errors';
import { hasPdfSignature } from './files';
import { resolveTargetSize, type FitMode, type ResizeSettings } from './paperSizes';

export interface PdfInspection {
  pageCount: number;
}

function assertLoadable(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new ResizeError('empty_file', messages.empty);
  }
  if (bytes.byteLength > LIMITS.maxFileBytes) {
    throw new ResizeError('too_large', messages.tooLarge);
  }
  if (!hasPdfSignature(bytes)) {
    throw new ResizeError('invalid_type', messages.invalidType);
  }
}

async function loadDocument(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    if (document.getPageCount() < 1) {
      throw new ResizeError('corrupt', messages.corrupt);
    }
    return document;
  } catch (error) {
    if (isResizeError(error)) throw error;
    if (error instanceof EncryptedPDFError || /encrypt/i.test(errorText(error))) {
      throw new ResizeError('encrypted', messages.encrypted);
    }
    throw new ResizeError('corrupt', messages.corrupt);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeRotation(angle: number): number {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function numberValue(value: PDFNumber): number {
  return value.asNumber();
}

function translatePairs(array: PDFArray, tx: number, ty: number): void {
  for (let index = 0; index + 1 < array.size(); index += 2) {
    const x = array.lookup(index);
    const y = array.lookup(index + 1);
    if (!(x instanceof PDFNumber) || !(y instanceof PDFNumber)) continue;
    array.set(index, PDFNumber.of(numberValue(x) + tx));
    array.set(index + 1, PDFNumber.of(numberValue(y) + ty));
  }
}

const ABSOLUTE_ANNOT_FIELDS = ['CL', 'Vertices', 'QuadPoints', 'L', 'Rect'] as const;

function translateAnnot(annot: PDFDict, tx: number, ty: number): void {
  for (const key of ABSOLUTE_ANNOT_FIELDS) {
    const list = annot.lookup(PDFName.of(key));
    if (list instanceof PDFArray) translatePairs(list, tx, ty);
  }

  const inkLists = annot.lookup(PDFName.of('InkList'));
  if (!(inkLists instanceof PDFArray)) return;
  for (let index = 0; index < inkLists.size(); index += 1) {
    const list = inkLists.lookup(index);
    if (list instanceof PDFArray) translatePairs(list, tx, ty);
  }
}

function translateAnnotations(page: PDFPage, tx: number, ty: number): void {
  if (tx === 0 && ty === 0) return;
  const annots = page.node.Annots();
  if (!annots) return;

  for (let index = 0; index < annots.size(); index += 1) {
    const annot = annots.lookup(index);
    if (annot instanceof PDFDict) translateAnnot(annot, tx, ty);
  }
}

function resizePage(
  page: PDFPage,
  targetVisualWidth: number,
  targetVisualHeight: number,
  mode: FitMode,
): void {
  const rotation = normalizeRotation(page.getRotation().angle);
  const rotated = rotation === 90 || rotation === 270;
  const crop = page.getCropBox();

  if (!(crop.width > 0) || !(crop.height > 0)) {
    throw new ResizeError('corrupt', messages.corrupt);
  }

  const sourceVisualWidth = rotated ? crop.height : crop.width;
  const sourceVisualHeight = rotated ? crop.width : crop.height;
  const targetBoxWidth = rotated ? targetVisualHeight : targetVisualWidth;
  const targetBoxHeight = rotated ? targetVisualWidth : targetVisualHeight;

  let scaleX: number;
  let scaleY: number;
  if (mode === 'stretch') {
    scaleX = targetBoxWidth / crop.width;
    scaleY = targetBoxHeight / crop.height;
  } else {
    const scale =
      mode === 'fit'
        ? Math.min(
            targetVisualWidth / sourceVisualWidth,
            targetVisualHeight / sourceVisualHeight,
          )
        : Math.max(
            targetVisualWidth / sourceVisualWidth,
            targetVisualHeight / sourceVisualHeight,
          );
    scaleX = scale;
    scaleY = scale;
  }

  if (![scaleX, scaleY].every((value) => Number.isFinite(value) && value > 0)) {
    throw new ResizeError('process_failed', messages.processFailed);
  }

  const scaledWidth = crop.width * scaleX;
  const scaledHeight = crop.height * scaleY;
  const translateX = (targetBoxWidth - scaledWidth) / 2 - crop.x * scaleX;
  const translateY = (targetBoxHeight - scaledHeight) / 2 - crop.y * scaleY;

  // scaleContent is wrapped first. translateContent then wraps outside it, and
  // pdf-lib applies that outer translation after the scale, in page space.
  page.scaleContent(scaleX, scaleY);
  if (translateX !== 0 || translateY !== 0) {
    page.translateContent(translateX, translateY);
  }
  page.scaleAnnotations(scaleX, scaleY);
  translateAnnotations(page, translateX, translateY);

  page.setMediaBox(0, 0, targetBoxWidth, targetBoxHeight);
  page.setCropBox(0, 0, targetBoxWidth, targetBoxHeight);
  page.setBleedBox(0, 0, targetBoxWidth, targetBoxHeight);
  page.setTrimBox(0, 0, targetBoxWidth, targetBoxHeight);
  page.setArtBox(0, 0, targetBoxWidth, targetBoxHeight);
}

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  assertLoadable(bytes);
  const document = await loadDocument(bytes);
  const pageCount = document.getPageCount();
  if (pageCount < 1) throw new ResizeError('corrupt', messages.corrupt);
  return { pageCount };
}

export async function resizePdf(bytes: Uint8Array, settings: ResizeSettings): Promise<Uint8Array> {
  const target = resolveTargetSize(settings);
  assertLoadable(bytes);
  const document = await loadDocument(bytes);
  const pages = document.getPages();

  if (pages.length < 1) throw new ResizeError('corrupt', messages.corrupt);

  try {
    for (const page of pages) {
      resizePage(page, target.width, target.height, settings.mode);
    }
    return await document.save({ useObjectStreams: false });
  } catch (error) {
    if (isResizeError(error)) throw error;
    if (/out of memory|allocation failed/i.test(errorText(error))) {
      throw new ResizeError('out_of_memory', messages.outOfMemory);
    }
    throw new ResizeError('process_failed', messages.processFailed);
  }
}
