import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Local dev: share the repo-root .env (Supabase URL + secret key). In
// production these come from Vercel env vars and this load finds nothing.
loadEnv({ path: resolve(__dirname, '..', '..', '.env') });

const nextConfig: NextConfig = {
  // Phase 2 reads sim output JSON from ../../out at request time (dev/local).
  // The Supabase provider replaces this before deployment.
  outputFileTracingIncludes: {
    '/api/feed': ['../../out/*.json'],
  },
};

export default nextConfig;
