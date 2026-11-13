// Writes web/icon-192.png and web/icon-512.png: a flat dark tile with a white play triangle.
// Pure Node (zlib + crc), so the build needs no image library.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

function png(size) {
  const bg = [0x1a, 0x1d, 0x27];
  const fg = [0xff, 0xff, 0xff];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const left = size * 0.34, right = size * 0.74, top = size * 0.26, bottom = size * 0.74, midY = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      // Inside the triangle when x is between the left edge and the slanted right edge for this row.
      const t = Math.abs(y - midY) / (midY - top);
      const inside = y >= top && y <= bottom && x >= left && x <= right - (right - left) * t;
      const c = inside ? fg : bg;
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const chunks = [
    chunk('IHDR', Buffer.from([...u32(size), ...u32(size), 8, 2, 0, 0, 0])),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
}

function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([Buffer.from(u32(data.length)), typeBuf, data, Buffer.from(u32(crc))]);
}

const table = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

for (const size of [192, 512]) writeFileSync(path.join(webDir, `icon-${size}.png`), png(size));
console.log('icons written');
