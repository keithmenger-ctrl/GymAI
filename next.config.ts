import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Local dev without the Supabase docker stack: forward /auth/v1/* to a locally-run GoTrue.
  async rewrites() {
    const gotrue = process.env.DEV_GOTRUE_URL
    return gotrue ? [{ source: '/auth/v1/:path*', destination: `${gotrue}/:path*` }] : []
  },
}

export default nextConfig
