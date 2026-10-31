// generate-icons.js - Generate PWA/extension PNG icons from the SVG source.
// Run with: node scripts/generate-icons.js
//
// Uses sharp (already installed as a dependency) to rasterize the SVG at
// multiple sizes required by PWAs and browser extensions.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'public', 'icon.svg');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EXT_DIR = path.join(__dirname, '..', 'browser-extension', 'icons');

async function generatePWAIcons() {
  const svg = fs.readFileSync(SVG_PATH);

  const sizes = [192, 512];
  for (const size of sizes) {
    const out = path.join(PUBLIC_DIR, `icon-${size}.png`);
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`  ✓ ${path.relative(process.cwd(), out)}`);
  }

  // Maskable icon (full-bleed background for Android adaptive icons)
  const maskableSvg = svg
    .toString()
    .replace(
      /<rect width="512" height="512" fill="url\(#bg\)" rx="96"/,
      '<rect width="512" height="512" fill="#0b3d2e"',
    );
  const maskableOut = path.join(PUBLIC_DIR, 'icon-maskable-512.png');
  await sharp(Buffer.from(maskableSvg), { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(maskableOut);
  console.log(`  ✓ ${path.relative(process.cwd(), maskableOut)}`);

  // Apple touch icon
  const appleOut = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .png()
    .toFile(appleOut);
  console.log(`  ✓ ${path.relative(process.cwd(), appleOut)}`);

  // Favicon PNG (32x32)
  const faviconOut = path.join(PUBLIC_DIR, 'favicon-32.png');
  await sharp(svg, { density: 384 })
    .resize(32, 32)
    .png()
    .toFile(faviconOut);
  console.log(`  ✓ ${path.relative(process.cwd(), faviconOut)}`);
}

async function generateExtensionIcons() {
  if (!fs.existsSync(EXT_DIR)) {
    fs.mkdirSync(EXT_DIR, { recursive: true });
  }
  const svg = fs.readFileSync(SVG_PATH);

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const out = path.join(EXT_DIR, `icon${size}.png`);
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`  ✓ ${path.relative(process.cwd(), out)}`);
  }
}

(async () => {
  console.log('Generating PWA icons...');
  await generatePWAIcons();
  console.log('\nGenerating browser extension icons...');
  await generateExtensionIcons();
  console.log('\n✅ All icons generated.');
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
