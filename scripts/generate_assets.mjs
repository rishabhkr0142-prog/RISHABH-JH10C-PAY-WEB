import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const inputImagePath = 'C:/Users/risha/.gemini/antigravity/brain/ee77cd51-c104-4eed-953d-92963428d9b3/.user_uploaded/media_1793683535507_ee14e3f9.jpg';
const publicDir = path.resolve('public');
const appDir = path.resolve('src/app');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function buildIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;
  let offset = headerSize + dirSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4); // number of images

  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0);
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(p => p.buffer)]);
}

async function run() {
  console.log('Generating logo assets...');

  // 1. Full logo (1024x1024 PNG)
  const fullLogoBuffer = await sharp(inputImagePath)
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo.png'), fullLogoBuffer);
  console.log('Saved public/logo.png');

  // 2. Extract Crown + R + Swoosh for logo-icon.png
  // Horizontal: x 160 to 870 (width 710)
  // Vertical: y 135 to 630 (height 495)
  const crownExtract = await sharp(inputImagePath)
    .extract({ left: 160, top: 135, width: 710, height: 495 })
    .toBuffer();

  // Create a 768x768 square with pure black background
  // Center the 710x495 extracted symbol inside it
  const targetSize = 768;
  const leftPad = Math.round((targetSize - 710) / 2);
  const topPad = Math.round((targetSize - 495) / 2);

  const iconBase = await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: crownExtract,
        top: topPad,
        left: leftPad,
      },
    ])
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'logo-icon.png'), iconBase);
  console.log('Saved public/logo-icon.png (768x768)');

  // 3. Generate icon sizes
  const sizes = [
    { name: 'icon-16.png', size: 16 },
    { name: 'icon-32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'logo-icon-128.png', size: 128 },
  ];

  for (const s of sizes) {
    const buf = await sharp(iconBase)
      .resize(s.size, s.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png({ quality: 95 })
      .toBuffer();
    fs.writeFileSync(path.join(publicDir, s.name), buf);
    console.log(`Saved public/${s.name}`);
  }

  // WebP optimized versions
  const webp128 = await sharp(iconBase).resize(128, 128).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo-icon-128.webp'), webp128);
  const webpFull = await sharp(fullLogoBuffer).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo.webp'), webpFull);
  console.log('Saved public/logo-icon-128.webp & public/logo.webp');

  // 4. Generate Maskable Icon (safe padding: icon scaled to ~75% within 512x512)
  const innerSize = Math.round(512 * 0.76);
  const innerIcon = await sharp(iconBase)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .toBuffer();

  const maskableOffset = Math.round((512 - innerSize) / 2);
  const maskableBuf = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: innerIcon, top: maskableOffset, left: maskableOffset }])
    .png({ quality: 95 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), maskableBuf);
  console.log('Saved public/icon-512-maskable.png');

  // 5. Generate Multi-size favicon.ico (16, 32, 48)
  const ico16 = await sharp(iconBase).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(iconBase).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(iconBase).resize(48, 48).png().toBuffer();
  const faviconBuffer = await buildIco([
    { width: 16, height: 16, buffer: ico16 },
    { width: 32, height: 32, buffer: ico32 },
    { width: 48, height: 48, buffer: ico48 },
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconBuffer);
  console.log('Saved public/favicon.ico');

  // App Router direct icon copies
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), faviconBuffer);
  fs.writeFileSync(path.join(appDir, 'icon.png'), ico32);
  const apple180 = await sharp(iconBase).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), apple180);
  console.log('Saved src/app/favicon.ico, icon.png, apple-icon.png');

  // 6. Generate Open Graph / Twitter Image: 1200x630
  // Center logo.png (scaled to fit nicely in 560x560 inside 1200x630)
  const ogLogo = await sharp(fullLogoBuffer)
    .resize(560, 560, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .toBuffer();

  const ogImageBuf = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: ogLogo,
        top: Math.round((630 - 560) / 2),
        left: Math.round((1200 - 560) / 2),
      },
    ])
    .png({ quality: 90 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogImageBuf);
  console.log('Saved public/og-image.png (1200x630)');

  // 7. Web manifest
  const manifest = {
    name: "RISHABH JH10C PAY WEB",
    short_name: "RJ PAY",
    description: "Premium digital product store & automated delivery platform by RISHABH JH10C",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };

  fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Saved public/manifest.webmanifest and manifest.json');
}

run().catch(console.error);
