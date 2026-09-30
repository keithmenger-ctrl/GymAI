import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // lets a second dev server (e.g. Stripe-mode webhook tests) run from the same checkout
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Local dev without the Supabase docker stack: forward /auth/v1/* to a locally-run GoTrue.
  // Baseline security headers (no framing = no clickjacking of one-tap attendance / billing buttons).
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
  async rewrites() {
    const gotrue = process.env.DEV_GOTRUE_URL
    return gotrue ? [{ source: '/auth/v1/:path*', destination: `${gotrue}/:path*` }] : []
  },
}

export default nextConfig
