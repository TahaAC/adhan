// generate-ico.js - Generate a multi-resolution .ico file for Windows
// from the SVG icon source. Uses sharp to rasterize at multiple sizes
// and assembles them into a single .ico file.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'public', 'icon.svg');
const ICO_OUT = path.join(__dirname, '..', 'windows-installer', 'icons', 'shia-azan.ico');
const PNG_OUT = path.join(__dirname, '..', 'windows-installer', 'icons', 'shia-azan.png');

// ICO file format:
// - 6-byte header (reserved=0, type=1, count=N)
// - N x 16-byte directory entries (width, height, colors, reserved, planes, bpp, size, offset)
// - N image data blobs (PNG or BMP)
//
// We embed PNGs (Vista+ supports PNG-compressed ICO entries) for
// smaller file size and better quality.

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generatePngs(svg) {
  const pngs = [];
  for (const size of SIZES) {
    const png = await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toBuffer();
    pngs.push({ size, png });
  }
  return pngs;
}

function buildIco(pngs) {
  const count = pngs.length;
  const headerSize = 6;
  const dirSize = 16 * count;
  let offset = headerSize + dirSize;

  // Calculate total size
  let totalSize = headerSize + dirSize;
  for (const { png } of pngs) totalSize += png.length;

  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  // Header
  buf.writeUInt16LE(0, pos); pos += 2; // reserved
  buf.writeUInt16LE(1, pos); pos += 2; // type = 1 (icon)
  buf.writeUInt16LE(count, pos); pos += 2; // image count

  // Directory entries
  for (const { size, png } of pngs) {
    const w = size === 256 ? 0 : size; // 0 means 256
    const h = w;
    buf.writeUInt8(w, pos); pos += 1; // width
    buf.writeUInt8(h, pos); pos += 1; // height
    buf.writeUInt8(0, pos); pos += 1; // color count (0 = >256)
    buf.writeUInt8(0, pos); pos += 1; // reserved
    buf.writeUInt16LE(1, pos); pos += 2; // color planes
    buf.writeUInt16LE(32, pos); pos += 2; // bits per pixel
    buf.writeUInt32LE(png.length, pos); pos += 4; // image size
    buf.writeUInt32LE(offset, pos); pos += 4; // image offset
    offset += png.length;
  }

  // Image data
  for (const { png } of pngs) {
    png.copy(buf, pos);
    pos += png.length;
  }

  return buf;
}

(async () => {
  console.log('Generating ICO from SVG...');
  const svg = fs.readFileSync(SVG_PATH);

  // Also save a 256x256 PNG for use in the installer script
  await sharp(svg, { density: 384 })
    .resize(256, 256)
    .png()
    .toFile(PNG_OUT);
  console.log(`  ✓ ${path.relative(process.cwd(), PNG_OUT)}`);

  const pngs = await generatePngs(svg);
  const ico = buildIco(pngs);
  fs.writeFileSync(ICO_OUT, ico);
  console.log(`  ✓ ${path.relative(process.cwd(), ICO_OUT)} (${ico.length} bytes, ${pngs.length} sizes)`);

  console.log('✅ ICO file generated.');
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
