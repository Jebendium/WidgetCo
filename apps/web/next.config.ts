import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Phase 2 reads sim output JSON from ../../out at request time (dev/local).
  // The Supabase provider replaces this before deployment.
  outputFileTracingIncludes: {
    '/api/feed': ['../../out/*.json'],
  },
};

export default nextConfig;
