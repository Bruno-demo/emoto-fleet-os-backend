const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.join(__dirname, '../public/icon.svg');
const PUBLIC_DIR = path.join(__dirname, '../public');

function packIco(pngBuffers) {
  // pngBuffers: Array of { buffer: Buffer, width: number, height: number }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirSize = 16;
  const offsetStart = headerSize + dirSize * count;

  const out = Buffer.alloc(offsetStart + pngBuffers.reduce((sum, p) => sum + p.buffer.length, 0));

  // Write ICO Header
  out.writeUInt16LE(0, 0);       // Reserved
  out.writeUInt16LE(1, 2);       // Type (1 = ICO)
  out.writeUInt16LE(count, 4);   // Number of images

  let currentOffset = offsetStart;

  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    const dirOffset = headerSize + i * dirSize;

    // Width and Height (0 means 256)
    out.writeUInt8(png.width === 256 ? 0 : png.width, dirOffset);
    out.writeUInt8(png.height === 256 ? 0 : png.height, dirOffset + 1);
    out.writeUInt8(0, dirOffset + 2); // Colors (0 for >= 256)
    out.writeUInt8(0, dirOffset + 3); // Reserved (0)
    out.writeUInt16LE(1, dirOffset + 4); // Color planes (1)
    out.writeUInt16LE(32, dirOffset + 6); // Bits per pixel (32)
    out.writeUInt32LE(png.buffer.length, dirOffset + 8); // Size of image data in bytes
    out.writeUInt32LE(currentOffset, dirOffset + 12); // Offset of image data from beginning of file

    // Copy PNG buffer to image data section
    png.buffer.copy(out, currentOffset);
    currentOffset += png.buffer.length;
  }

  return out;
}

async function main() {
  console.log('Generating favicons from:', SVG_PATH);

  // 1. Generate PNGs of various sizes
  const sizes = [16, 32, 48, 96, 144, 192, 512];
  const pngBuffers = [];

  for (const size of sizes) {
    const buffer = await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toBuffer();

    const destPath = path.join(PUBLIC_DIR, `icon-${size}.png`);
    fs.writeFileSync(destPath, buffer);
    console.log(`Generated: icon-${size}.png`);

    // We only include 16x16, 32x32, and 48x48 in the .ico file
    if ([16, 32, 48].includes(size)) {
      pngBuffers.push({ buffer, width: size, height: size });
    }
  }

  // Also save a default 32x32 as favicon.png
  const defaultPng = pngBuffers.find(p => p.width === 32).buffer;
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.png'), defaultPng);
  console.log('Generated: favicon.png (32x32)');

  // 2. Generate favicon.ico containing 16x16, 32x32, 48x48
  const icoBuffer = packIco(pngBuffers);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('Generated: favicon.ico');

  console.log('All icons generated successfully!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
