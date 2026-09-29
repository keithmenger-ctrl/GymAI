import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Landing point of invite / password-reset links: exchanges the one-time token for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''
  if (tokenHash && type) {
    const supabase = await supabaseServer()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      redirectTo.pathname = safeNext
      return NextResponse.redirect(redirectTo)
    }
  }
  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'invalid_link')
  return NextResponse.redirect(redirectTo)
}
