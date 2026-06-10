// Supabase client for the sim's crons (sync, submission/disturbance
// consumption). Returns null when env is absent — local dry runs and tests
// never touch the network.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function makeDb(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
