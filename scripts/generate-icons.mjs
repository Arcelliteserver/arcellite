import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [32, 72, 96, 128, 144, 152, 192, 384, 512];

// App icon SVG: Purple rounded rectangle background + white cloud
function makeAppIconSvg(size) {
  const rx = Math.round(size * 0.15); // 15% corner radius
  const pad = Math.round(size * 0.18); // padding for the cloud
  const cloudW = size - pad * 2;
  const cloudH = Math.round(cloudW * 0.75);
  const cloudY = Math.round((size - cloudH) / 2);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#5D5FEF"/>
  <svg x="${pad}" y="${cloudY}" width="${cloudW}" height="${cloudH}" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" 
          fill="rgba(255,255,255,0.2)" 
          stroke="white" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"/>
  </svg>
</svg>`;
}

async function generate() {
  for (const size of sizes) {
    const svg = makeAppIconSvg(size);
    const outPath = join(outDir, `icon-${size}x${size}.png`);
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outPath);
    
    console.log(`✓ Generated ${outPath} (${size}x${size})`);
  }
  console.log('\nAll icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
