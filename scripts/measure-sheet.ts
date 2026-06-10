// One-off: find the animation row bands in a LimeZu character sheet by
// scanning for fully-transparent horizontal gaps. Prints y-offset + height
// of each occupied band so the loader can be configured precisely.
import sharp from 'sharp';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('usage: tsx scripts/measure-sheet.ts <png>');

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rowHasInk: boolean[] = [];
  for (let y = 0; y < info.height; y++) {
    let ink = false;
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]! > 0) {
        ink = true;
        break;
      }
    }
    rowHasInk.push(ink);
  }

  let bandStart: number | null = null;
  const bands: { y: number; h: number }[] = [];
  for (let y = 0; y <= info.height; y++) {
    const ink = y < info.height && rowHasInk[y];
    if (ink && bandStart === null) bandStart = y;
    if (!ink && bandStart !== null) {
      bands.push({ y: bandStart, h: y - bandStart });
      bandStart = null;
    }
  }
  console.log(`${info.width}x${info.height}; ${bands.length} bands:`);
  bands.forEach((b, i) => {
    console.log(`  band ${i}: y=${b.y} h=${b.h}`);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
