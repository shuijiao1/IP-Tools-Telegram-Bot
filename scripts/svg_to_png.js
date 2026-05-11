#!/usr/bin/env node
const sharp = require('sharp');
const [,, input, output] = process.argv;
if (!input || !output) {
  console.error('usage: svg_to_png.js input.svg output.png');
  process.exit(2);
}
sharp(input, { density: 300 })
  .resize({ width: 2400, height: 1800, fit: 'inside', withoutEnlargement: false })
  .png({ quality: 95, compressionLevel: 6, adaptiveFiltering: true, palette: true })
  .sharpen(1.2, 1.0, 2.0)
  .toFile(output)
  .catch((e) => { console.error(e && e.stack || e); process.exit(1); });
