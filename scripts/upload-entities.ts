// Upload entity sprite sheets (cat, haunted mirror) to the private bucket.
//   npx tsx scripts/upload-entities.ts <assets-root>
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const root = process.argv[2];
  if (!root) throw new Error('usage: tsx scripts/upload-entities.ts <assets-root>');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY required.');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const dir = join(root, '3_Animated_objects', '16x16', 'spritesheets');
  const files: [string, string][] = [
    ['cat', 'animated_cat.png'],
    ['mirror', 'aniamted_haunted_mirror.png'], // sic — the typo is LimeZu's
    // The coffee machine plays the kettle of record. The Company will not be
    // drawn on the distinction.
    ['kettle', 'animated_coffee.png'],
  ];
  for (const [name, file] of files) {
    const buf = readFileSync(join(dir, file));
    const { error } = await db.storage
      .from('sprites')
      .upload(`${name}.png`, buf, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`${name}: ${error.message}`);
    console.log(`  ${name} <- ${file} (${buf.length} bytes)`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
