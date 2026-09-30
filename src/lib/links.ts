import 'server-only'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Base URL for links. Emailed links MUST use the configured APP_URL: the request Host header is
 * attacker-controlled, and a forged Host would put a real one-time token behind someone else's domain.
 * The request origin is only used for links shown on screen to a signed-in admin, or in local dev.
 */
export async function baseUrl(forEmail = false) {
  const configured = process.env.APP_URL?.replace(/\/+$/, '')
  if (configured) return configured
  if (forEmail && process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL must be set to send emails in production.')
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** One-time link that signs the user in and sends them to set a password. Throws if the user doesn't exist. */
export async function passwordLink(email: string, forEmail = false) {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? 'Could not create link')
  return `${await baseUrl(forEmail)}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/set-password`
}
