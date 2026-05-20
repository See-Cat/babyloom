import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const outDir = join(process.cwd(), 'public', 'icons');

function iconSvg(size: number, maskable = false) {
  const pad = maskable ? size * 0.18 : size * 0.08;
  const inner = size - pad * 2;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#f8f8f0"/>
  <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${inner * 0.42}" fill="#19c8b9"/>
  <path d="M ${size * 0.35} ${size * 0.49} C ${size * 0.35} ${size * 0.35}, ${size * 0.65} ${size * 0.35}, ${size * 0.65} ${size * 0.49} C ${size * 0.65} ${size * 0.68}, ${size * 0.5} ${size * 0.74}, ${size * 0.5} ${size * 0.74} C ${size * 0.5} ${size * 0.74}, ${size * 0.35} ${size * 0.68}, ${size * 0.35} ${size * 0.49} Z" fill="#fff8d7"/>
  <circle cx="${size * 0.44}" cy="${size * 0.5}" r="${size * 0.025}" fill="#794f27"/>
  <circle cx="${size * 0.56}" cy="${size * 0.5}" r="${size * 0.025}" fill="#794f27"/>
  <path d="M ${size * 0.45} ${size * 0.59} Q ${size * 0.5} ${size * 0.63} ${size * 0.55} ${size * 0.59}" stroke="#794f27" stroke-width="${size * 0.02}" stroke-linecap="round" fill="none"/>
</svg>`;
}

async function writePng(name: string, size: number, maskable = false) {
  await sharp(Buffer.from(iconSvg(size, maskable))).png().toFile(join(outDir, name));
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'icon-source.svg'), iconSvg(512));
  await writePng('icon-192.png', 192);
  await writePng('icon-512.png', 512);
  await writePng('icon-maskable-512.png', 512, true);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
