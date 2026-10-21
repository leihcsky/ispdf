import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, PDFString, degrees, StandardFonts } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ResizeError } from '../src/lib/pdf/errors';
import { LIMITS } from '../src/lib/pdf/errors';
import { validateSelectedFile } from '../src/lib/pdf/files';
import { PAPER_SIZES, paperById, resolveTargetSize, toPoints, type ResizeSettings } from '../src/lib/pdf/paperSizes';
import { resizePdf } from '../src/lib/pdf/resizePdf';

type Group = 'core' | 'extended';

const results: { group: Group; name: string; ok: boolean; detail?: string }[] = [];

function close(actual: number, expected: number, label: string, tolerance = 0.2): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function check(group: Group, name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ group, name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ group, name, ok: false, detail });
    console.error(`FAIL  ${name}\n      ${detail}`);
  }
}

function settings(partial: Partial<ResizeSettings>): ResizeSettings {
  return {
    preset: 'a4',
    orientation: 'portrait',
    mode: 'fit',
    customWidth: 210,
    customHeight: 297,
    customUnit: 'mm',
    ...partial,
  };
}

async function makePdf(
  setup: (doc: PDFDocument) => Promise<void> | void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await setup(doc);
  return doc.save({ useObjectStreams: false });
}

function addLink(doc: PDFDocument, page: ReturnType<PDFDocument['addPage']>, rect: number[]): void {
  const link = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rect,
    Border: [0, 0, 0],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of('https://example.com/resize-pdf'),
    },
  });
  page.node.set(PDFName.of('Annots'), doc.context.obj([link]));
}

async function readRects(bytes: Uint8Array, pageIndex = 0): Promise<number[][]> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  const annots = page.node.Annots();
  if (!annots) return [];
  const rects: number[][] = [];
  for (let index = 0; index < annots.size(); index += 1) {
    const annot = annots.lookup(index);
    if (!(annot instanceof PDFDict)) continue;
    const rect = annot.lookup(PDFName.of('Rect'));
    if (!(rect instanceof PDFArray)) continue;
    const values: number[] = [];
    for (let cursor = 0; cursor < rect.size(); cursor += 1) {
      const value = rect.lookup(cursor);
      if (value instanceof PDFNumber) values.push(value.asNumber());
    }
    rects.push(values);
  }
  return rects;
}

async function readBoxes(bytes: Uint8Array, pageIndex = 0) {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  return {
    pageCount: doc.getPageCount(),
    rotation: ((page.getRotation().angle % 360) + 360) % 360,
    media: page.getMediaBox(),
    crop: page.getCropBox(),
  };
}

async function readText(bytes: Uint8Array, pageNumber: number) {
  const params = {
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  };
  const task = getDocument(params as Parameters<typeof getDocument>[0]);
  const pdf = await task.promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const strings = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .filter(Boolean);
  const positioned = content.items.flatMap((item) => {
    if (!('str' in item) || !item.str) return [];
    return [{ str: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 }];
  });
  const view = { width: viewport.width, height: viewport.height };
  await pdf.destroy();
  return { strings, positioned, view, pageCount: pdf.numPages };
}

async function expectError(bytes: Uint8Array, code: string, partial?: Partial<ResizeSettings>): Promise<void> {
  try {
    await resizePdf(bytes, settings(partial ?? {}));
  } catch (error) {
    if (error instanceof ResizeError && error.code === code) return;
    throw new Error(`expected ${code}, got ${error instanceof Error ? `${error.name}: ${error.message}` : error}`);
  }
  throw new Error(`expected ${code}, but resize succeeded`);
}

function buildEncryptedPdf(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
    '<< /Filter /Standard /V 1 /R 2 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body);
  const size = objects.length + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let index = 1; index < size; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${size} /Root 1 0 R /Encrypt ${objects.length} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(body + xref);
}

async function main(): Promise<void> {
  await check('core', 'preset point sizes', () => {
    const expected: Record<string, [number, number]> = {
      a3: [841.89, 1190.55],
      a4: [595.28, 841.89],
      a5: [419.53, 595.28],
      letter: [612, 792],
      legal: [612, 1008],
      tabloid: [792, 1224],
    };
    for (const paper of PAPER_SIZES) {
      const pair = expected[paper.id];
      if (!pair) throw new Error(`missing ${paper.id}`);
      if (paper.width !== pair[0] || paper.height !== pair[1]) {
        throw new Error(`${paper.id} is ${paper.width} x ${paper.height}`);
      }
    }
    const a4 = resolveTargetSize(settings({ preset: 'a4', orientation: 'landscape' }));
    close(a4.width, 841.89, 'A4 landscape width', 0);
    close(a4.height, 595.28, 'A4 landscape height', 0);
  });

  await check('core', 'unit conversion', () => {
    close(toPoints(1, 'in'), 72, 'inch', 0);
    close(toPoints(25.4, 'mm'), 72, 'mm', 0.001);
    close(toPoints(2.54, 'cm'), 72, 'cm', 0.001);
    const letter = resolveTargetSize(
      settings({
        preset: 'custom',
        orientation: 'portrait',
        customWidth: 8.5,
        customHeight: 11,
        customUnit: 'in',
      }),
    );
    close(letter.width, 612, 'custom letter width', 0);
    close(letter.height, 792, 'custom letter height', 0);
    const a4mm = resolveTargetSize(
      settings({
        preset: 'custom',
        customWidth: 210,
        customHeight: 297,
        customUnit: 'mm',
      }),
    );
    close(a4mm.width, paperById('a4').width, '210 mm', 0.02);
    close(a4mm.height, paperById('a4').height, '297 mm', 0.02);
  });

  await check('core', 'invalid custom size is rejected', async () => {
    await expectError(await makePdf((doc) => {
      doc.addPage([200, 200]);
    }), 'invalid_size', {
      preset: 'custom',
      customWidth: 0,
      customHeight: 10,
      customUnit: 'in',
    });
    await expectError(await makePdf((doc) => {
      doc.addPage([200, 200]);
    }), 'invalid_size', {
      preset: 'custom',
      customWidth: 201,
      customHeight: 1,
      customUnit: 'in',
    });
  });

  await check('core', 'single-page text keeps letters and A4 size', async () => {
    const source = await makePdf(async (doc) => {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([612, 792]);
      page.drawText('MARKER', { x: 72, y: 720, size: 18, font });
    });
    const output = await resizePdf(source, settings({ preset: 'a4', mode: 'fit' }));
    const boxes = await readBoxes(output);
    close(boxes.crop.width, 595.28, 'crop width');
    close(boxes.crop.height, 841.89, 'crop height');
    close(boxes.media.width, 595.28, 'media width');
    close(boxes.media.height, 841.89, 'media height');
    close(boxes.pageCount, 1, 'page count', 0);
    const text = await readText(output, 1);
    if (!text.strings.includes('MARKER')) throw new Error(`text missing: ${text.strings.join('|')}`);
    close(text.view.width, 595.28, 'visual width');
    close(text.view.height, 841.89, 'visual height');
  });

  await check('core', 'multi-page text and page count', async () => {
    const source = await makePdf(async (doc) => {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (const word of ['ONE', 'TWO', 'THREE']) {
        const page = doc.addPage([500, 500]);
        page.drawText(word, { x: 40, y: 40, size: 24, font });
      }
    });
    const output = await resizePdf(source, settings({ preset: 'letter', mode: 'fit' }));
    const boxes = await readBoxes(output, 2);
    close(boxes.pageCount, 3, 'pages', 0);
    close(boxes.crop.width, 612, 'width', 0);
    close(boxes.crop.height, 792, 'height', 0);
    for (const [pageNumber, word] of ['ONE', 'TWO', 'THREE'].entries()) {
      const text = await readText(output, pageNumber + 1);
      if (!text.strings.includes(word)) throw new Error(`page ${pageNumber + 1} lost ${word}`);
    }
  });

  await check('core', 'fit scales proportionally and centers', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([400, 800]);
      addLink(doc, page, [0, 0, 400, 800]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 200 / 72,
      customHeight: 200 / 72,
      customUnit: 'in',
      mode: 'fit',
    }));
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    // s = 200/800 = 0.25; scaled 100 x 200; offset x = 50
    close(rect[0] ?? 0, 50, 'fit llx');
    close(rect[1] ?? 0, 0, 'fit lly');
    close(rect[2] ?? 0, 150, 'fit urx');
    close(rect[3] ?? 0, 200, 'fit ury');
    const text = await readText(await withMarker(400, 800, 200, 400), 1);
    const marker = text.positioned.find((item) => item.str === 'CENTER');
    if (!marker) throw new Error('center marker missing');
    close(marker.x, 100, 'fit center x', 1.5);
    close(marker.y, 100, 'fit center y', 1.5);
  });

  await check('core', 'fill covers the target and crops the long edge', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([400, 800]);
      addLink(doc, page, [0, 0, 400, 800]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 200 / 72,
      customHeight: 200 / 72,
      customUnit: 'in',
      mode: 'fill',
    }));
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    // s = 200/400 = 0.5; scaled 200 x 400; offset y = -100
    close(rect[0] ?? 0, 0, 'fill llx');
    close(rect[1] ?? 0, -100, 'fill lly');
    close(rect[2] ?? 0, 200, 'fill urx');
    close(rect[3] ?? 0, 300, 'fill ury');
    const boxes = await readBoxes(output);
    close(boxes.crop.width, 200, 'fill page width');
    close(boxes.crop.height, 200, 'fill page height');
  });

  await check('core', 'stretch maps both axes onto the target', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([400, 800]);
      addLink(doc, page, [0, 0, 400, 800]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 200 / 72,
      customHeight: 200 / 72,
      customUnit: 'in',
      mode: 'stretch',
    }));
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    close(rect[0] ?? 0, 0, 'stretch llx');
    close(rect[1] ?? 0, 0, 'stretch lly');
    close(rect[2] ?? 0, 200, 'stretch urx');
    close(rect[3] ?? 0, 200, 'stretch ury');
    const text = await readText(output, 1);
    close(text.view.width, 200, 'stretch visual width');
    close(text.view.height, 200, 'stretch visual height');
  });

  await check('extended', 'landscape source page fits a portrait target', async () => {
    const source = await makePdf(async (doc) => {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([792, 612]);
      page.drawText('WIDE', { x: 40, y: 40, size: 18, font });
    });
    const output = await resizePdf(source, settings({ preset: 'a4', orientation: 'portrait', mode: 'fit' }));
    const boxes = await readBoxes(output);
    close(boxes.crop.width, 595.28, 'width');
    close(boxes.crop.height, 841.89, 'height');
    const text = await readText(output, 1);
    if (!text.strings.includes('WIDE')) throw new Error('landscape text missing');
  });

  await check('extended', 'rotate 90 keeps visual size and link box', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([400, 200]);
      page.setRotation(degrees(90));
      addLink(doc, page, [0, 0, 400, 200]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 100 / 72,
      customHeight: 300 / 72,
      customUnit: 'in',
      mode: 'stretch',
    }));
    const boxes = await readBoxes(output);
    close(boxes.rotation, 90, 'rotation', 0);
    close(boxes.media.width, 300, 'media width');
    close(boxes.media.height, 100, 'media height');
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    close(rect[0] ?? 0, 0, 'llx');
    close(rect[1] ?? 0, 0, 'lly');
    close(rect[2] ?? 0, 300, 'urx');
    close(rect[3] ?? 0, 100, 'ury');
    const text = await readText(output, 1);
    close(text.view.width, 100, 'visual width');
    close(text.view.height, 300, 'visual height');
  });

  await check('extended', 'rotate 180 and 270 still map the page box', async () => {
    for (const angle of [180, 270]) {
      const source = await makePdf((doc) => {
        const page = doc.addPage([400, 200]);
        page.setRotation(degrees(angle));
        addLink(doc, page, [0, 0, 400, 200]);
      });
      const output = await resizePdf(source, settings({
        preset: 'custom',
        customWidth: (angle === 270 ? 100 : 200) / 72,
        customHeight: (angle === 270 ? 300 : 100) / 72,
        customUnit: 'in',
        mode: 'stretch',
      }));
      const boxes = await readBoxes(output);
      close(boxes.rotation, angle, `rotation ${angle}`, 0);
      const [rect] = await readRects(output);
      if (!rect || rect.length !== 4) throw new Error(`link missing for ${angle}`);
    }
  });

  await check('extended', 'crop box smaller than media box defines the page', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([500, 900]);
      page.setCropBox(50, 100, 400, 800);
      addLink(doc, page, [50, 100, 450, 900]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 200 / 72,
      customHeight: 200 / 72,
      customUnit: 'in',
      mode: 'stretch',
    }));
    const boxes = await readBoxes(output);
    close(boxes.crop.width, 200, 'crop width');
    close(boxes.crop.height, 200, 'crop height');
    close(boxes.media.width, 200, 'media width');
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    close(rect[0] ?? 0, 0, 'llx');
    close(rect[1] ?? 0, 0, 'lly');
    close(rect[2] ?? 0, 200, 'urx');
    close(rect[3] ?? 0, 200, 'ury');
  });

  await check('extended', 'non-zero media box origin is normalized', async () => {
    const source = await makePdf((doc) => {
      const page = doc.addPage([200, 200]);
      page.setMediaBox(10, 20, 400, 800);
      page.setCropBox(10, 20, 400, 800);
      addLink(doc, page, [10, 20, 410, 820]);
    });
    const output = await resizePdf(source, settings({
      preset: 'custom',
      customWidth: 200 / 72,
      customHeight: 200 / 72,
      customUnit: 'in',
      mode: 'stretch',
    }));
    const boxes = await readBoxes(output);
    close(boxes.media.x, 0, 'origin x');
    close(boxes.media.y, 0, 'origin y');
    close(boxes.media.width, 200, 'width');
    close(boxes.media.height, 200, 'height');
    const [rect] = await readRects(output);
    if (!rect) throw new Error('link missing');
    close(rect[0] ?? 0, 0, 'llx');
    close(rect[1] ?? 0, 0, 'lly');
    close(rect[2] ?? 0, 200, 'urx');
    close(rect[3] ?? 0, 200, 'ury');
  });

  await check('core', 'empty, corrupt, and encrypted files fail clearly', async () => {
    await expectError(new Uint8Array(), 'empty_file');
    await expectError(new TextEncoder().encode('not a pdf'), 'invalid_type');
    await expectError(new TextEncoder().encode('%PDF-1.4\nthis is not a real xref'), 'corrupt');
    await expectError(buildEncryptedPdf(), 'encrypted');
    const oversized = new Uint8Array(LIMITS.maxFileBytes + 1);
    oversized.set(new TextEncoder().encode('%PDF-1.4'), 0);
    await expectError(oversized, 'too_large');
  });

  await check('core', 'a 207-page PDF is resized', async () => {
    const pageCount = 207;
    const source = await makePdf((doc) => {
      for (let index = 0; index < pageCount; index += 1) doc.addPage([200, 200]);
    });
    const output = await resizePdf(source, settings({ preset: 'a4', mode: 'fit' }));
    const boxes = await readBoxes(output, pageCount - 1);
    close(boxes.pageCount, pageCount, 'pages', 0);
    close(boxes.crop.width, 595.28, 'width');
    close(boxes.crop.height, 841.89, 'height');
  });

  await check('core', 'file selection rejects the wrong type before parsing', () => {
    expectThrow(() => validateSelectedFile({ name: 'photo.png', type: 'image/png', size: 10 }), 'invalid_type');
    expectThrow(() => validateSelectedFile({ name: 'empty.pdf', type: 'application/pdf', size: 0 }), 'empty_file');
    expectThrow(() => validateSelectedFile({ name: 'big.pdf', type: 'application/pdf', size: LIMITS.maxFileBytes + 1 }), 'too_large');
    validateSelectedFile({ name: 'scan.pdf', type: '', size: 128 });
  });

  const failed = results.filter((result) => !result.ok);
  const coreFailed = failed.filter((result) => result.group === 'core');
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (coreFailed.length > 0) {
    console.error('Core PDF checks failed. Do not treat the library path as ready.');
    process.exit(1);
  }
  if (failed.length > 0) {
    console.error('Extended checks failed. Those inputs must show a compatibility error in the product.');
    process.exit(2);
  }
}

function expectThrow(fn: () => void, code: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof ResizeError && error.code === code) return;
    throw error;
  }
  throw new Error(`expected ${code}`);
}

async function withMarker(width: number, height: number, markerX: number, markerY: number): Promise<Uint8Array> {
  const source = await makePdf(async (doc) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([width, height]);
    page.drawText('CENTER', { x: markerX, y: markerY, size: 12, font });
  });
  return resizePdf(source, settings({
    preset: 'custom',
    customWidth: 200 / 72,
    customHeight: 200 / 72,
    customUnit: 'in',
    mode: 'fit',
  }));
}

void main();
