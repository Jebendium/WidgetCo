// Upload the chosen LimeZu premade character sheets to a PRIVATE Supabase
// Storage bucket. The licence prohibits redistribution, so the public repo
// never contains them and the site serves them only through our own route.
//   npx tsx scripts/upload-sprites.ts <assets-root>
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// agentId -> premade character number (chosen from the pack's line-up).
const CAST: Record<string, string> = {
  ceo: '09',
  cfo: '05',
  sales: '17',
  comms: '02',
  'middle-manager': '06',
  audit: '14',
};

const BUCKET = 'sprites';

async function main(): Promise<void> {
  const assetsRoot = process.argv[2];
  if (!assetsRoot) throw new Error('usage: tsx scripts/upload-sprites.ts <assets-root>');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY required.');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false });
    if (error) throw new Error(`createBucket: ${error.message}`);
    console.log(`Created private bucket '${BUCKET}'.`);
  }

  const dir = join(
    assetsRoot,
    '2_Characters',
    'Character_Generator',
    '0_Premade_Characters',
    '16x16',
  );
  for (const [agentId, num] of Object.entries(CAST)) {
    const file = readFileSync(join(dir, `Premade_Character_${num}.png`));
    const { error } = await db.storage
      .from(BUCKET)
      .upload(`${agentId}.png`, file, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`upload ${agentId}: ${error.message}`);
    console.log(`  ${agentId} <- Premade_Character_${num}.png (${file.length} bytes)`);
  }
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
