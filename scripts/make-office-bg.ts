// Build the office background from LimeZu's Office_Design_2: take the first
// GIF frame, patch out the baked-in characters by copying clean regions from
// identical furniture elsewhere, save a PNG for review, and (with --upload)
// push it to the private sprites bucket as office-bg.png.
//   npx tsx scripts/make-office-bg.ts <assets-root> [--upload]
import 'dotenv/config';
import { join } from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Rectangles to repair: copy {from} over {to} (same size). Tuned by eye
// against the design; re-run and re-review after any change.
const PATCHES: { from: { x: number; y: number; w: number; h: number }; to: { x: number; y: number } }[] = [
  // Top-left standing character: tile the clean wall strip (between the
  // poster and the bookshelf) across the whole zone he occupied.
  { from: { x: 242, y: 36, w: 18, h: 60 }, to: { x: 108, y: 36 } },
  { from: { x: 242, y: 36, w: 18, h: 60 }, to: { x: 126, y: 36 } },
  { from: { x: 242, y: 36, w: 18, h: 60 }, to: { x: 144, y: 36 } },
  { from: { x: 242, y: 36, w: 18, h: 60 }, to: { x: 162, y: 36 } },
  // Orange-haired worker seated in row 1, middle cubicle.
  { from: { x: 192, y: 96, w: 48, h: 48 }, to: { x: 128, y: 96 } },
  // Worker in row 1 right cubicle (orange shirt at desk).
  { from: { x: 192, y: 96, w: 48, h: 48 }, to: { x: 320, y: 96 } },
  // Brown-haired worker seated in row 2, third cubicle.
  { from: { x: 352, y: 224, w: 48, h: 64 }, to: { x: 272, y: 224 } },
  // Red-haired head in row 2 right cubicle shelving.
  { from: { x: 224, y: 224, w: 32, h: 48 }, to: { x: 304, y: 224 } },
];

async function main(): Promise<void> {
  const assetsRoot = process.argv[2];
  if (!assetsRoot) throw new Error('usage: tsx scripts/make-office-bg.ts <assets-root> [--upload]');
  const src = join(assetsRoot, '6_Office_Designs', 'Office_Design_2.gif');

  const base = sharp(src, { pages: 1 }).ensureAlpha();
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });

  // Apply patches on the raw buffer (copy rect from -> to).
  for (const p of PATCHES) {
    for (let dy = 0; dy < p.from.h; dy++) {
      for (let dx = 0; dx < p.from.w; dx++) {
        const si = ((p.from.y + dy) * info.width + (p.from.x + dx)) * 4;
        const di = ((p.to.y + dy) * info.width + (p.to.x + dx)) * 4;
        data[di] = data[si] ?? 0;
        data[di + 1] = data[si + 1] ?? 0;
        data[di + 2] = data[si + 2] ?? 0;
        data[di + 3] = data[si + 3] ?? 255;
      }
    }
  }

  // Widen the BUILDING by duplicating the repeating 96px band (x 200-296,
  // full height: cubicle column up top, lounge clutter below) twice:
  // 512 -> 704. Then extend exterior ground to 1344 total.
  const BAND_X = 200;
  const BAND_W = 96;
  const newW = info.width + BAND_W * 2;
  const wide = Buffer.alloc(newW * info.height * 4);
  const copyCols = (srcX: number, dstX: number, w: number) => {
    for (let y = 0; y < info.height; y++) {
      data.copy(
        wide,
        (y * newW + dstX) * 4,
        (y * info.width + srcX) * 4,
        (y * info.width + srcX + w) * 4,
      );
    }
  };
  copyCols(0, 0, BAND_X + BAND_W); // up to and including the band
  copyCols(BAND_X, BAND_X + BAND_W, BAND_W); // copy 1
  copyCols(BAND_X, BAND_X + BAND_W * 2, BAND_W); // copy 2
  copyCols(BAND_X + BAND_W, BAND_X + BAND_W * 3, info.width - BAND_X - BAND_W); // the rest

  const out = join(assetsRoot, 'office-bg.png');
  const pad = (1344 - newW) / 2;
  await sharp(wide, { raw: { width: newW, height: info.height, channels: 4 } })
    .extend({
      left: pad,
      right: pad,
      background: { r: 214, g: 197, b: 165, alpha: 255 },
    })
    .png()
    .toFile(out);
  console.log(`Wrote ${out} (1344x${info.height}, building ${newW} wide)`);

  if (process.argv.includes('--upload')) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY required.');
    const db = createClient(url, key, { auth: { persistSession: false } });
    const file = await sharp(out).png().toBuffer();
    const { error } = await db.storage
      .from('sprites')
      .upload('office-bg.png', file, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(error.message);
    console.log('Uploaded to sprites/office-bg.png');
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
