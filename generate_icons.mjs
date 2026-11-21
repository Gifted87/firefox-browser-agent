import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, a = 255) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with scanline filter byte 0
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData.writeUInt8(0, rowOffset); // filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Draw rounded rect with cyber gradient
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const maxRadius = width * 0.46;

      if (dist <= maxRadius) {
        // Gradient from violet to cyan
        const t = (x + y) / (width + height);
        const red = Math.round(99 * (1 - t) + 6 * t);
        const green = Math.round(102 * (1 - t) + 182 * t);
        const blue = Math.round(241 * (1 - t) + 212 * t);
        
        rawData.writeUInt8(red, pixelOffset);
        rawData.writeUInt8(green, pixelOffset + 1);
        rawData.writeUInt8(blue, pixelOffset + 2);
        rawData.writeUInt8(255, pixelOffset + 3);
      } else {
        rawData.writeUInt8(0, pixelOffset);
        rawData.writeUInt8(0, pixelOffset + 1);
        rawData.writeUInt8(0, pixelOffset + 2);
        rawData.writeUInt8(0, pixelOffset + 3);
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuffer, data]);

  const crc = crc32(body);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, body, crcBuffer]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ ~0) >>> 0;
}

if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons', { recursive: true });
}

fs.writeFileSync('icons/icon-48.png', createPNG(48, 48));
fs.writeFileSync('icons/icon-128.png', createPNG(128, 128));
console.log('Generated PNG icons successfully!');
