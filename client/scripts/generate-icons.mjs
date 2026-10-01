// server/scripts/generate-icons.js
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../../client/public');
const svgPath = resolve(publicDir, 'icon.svg');

const svg = readFileSync(svgPath);

const targets = [
    { name: 'icon-192.png',           size: 192 },
    { name: 'icon-512.png',           size: 512 },
    { name: 'icon-maskable-512.png',  size: 512 },
    { name: 'apple-touch-icon.png',   size: 180 },
];

for (const t of targets) {
    const out = resolve(publicDir, t.name);
    await sharp(svg, { density: 400 })
        .resize(t.size, t.size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(out);
    console.log('✓ сгенерирован', t.name, `(${t.size}×${t.size})`);
}

console.log('\nГотово. Все иконки лежат в client/public/');