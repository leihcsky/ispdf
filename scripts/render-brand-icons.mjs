import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url));

function png(size) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  }).render();
  return rendered.asPng();
}

function ico(images) {
  const count = images.length;
  let offset = 6 + 16 * count;
  const entries = images.map((image) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    return entry;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const icon48 = png(48);
const icon192 = png(192);
const icon512 = png(512);

writeFileSync(new URL('../public/favicon.ico', import.meta.url), ico([
  { size: 48, png: icon48 },
  { size: 192, png: icon192 },
]));
writeFileSync(new URL('../public/favicon.png', import.meta.url), icon192);
writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), png(180));
writeFileSync(new URL('../public/logo.png', import.meta.url), icon512);
