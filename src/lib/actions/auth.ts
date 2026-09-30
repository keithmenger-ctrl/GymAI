'use server'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { withUser } from '@/lib/db'
import { getSession, homeFor } from '@/lib/auth'
import { provisionDemo } from '@/lib/demo'
import { track } from '@/lib/track'

export type FormState = { error?: string; message?: string } | undefined

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') })
  if (error) return { error: 'Incorrect email or password.' }
  const s = await getSession()
  if (s) await track(s, 'login')
  redirect(s ? homeFor(s.role) : '/onboarding')
}

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const orgName = str(fd, 'orgName')
  const fullName = str(fd, 'fullName')
  const email = str(fd, 'email')
  const password = str(fd, 'password')
  if (!orgName || !fullName || !email) return { error: 'Please fill in every field.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
  if (error) return { error: error.message }
  if (!data.session || !data.user) {
    // Email confirmation is enabled on this project: finish the org setup at first login (/onboarding).
    return { message: 'Check your email to confirm your account, then sign in to finish setting up your facility.' }
  }
  const [org] = await withUser(data.user.id, (q) =>
    q<{ id: string }>('select create_organization($1, $2) as id', [orgName, fullName]))
  if (fd.get('demo') === 'on') {
    try {
      await provisionDemo(org.id)
      const s = await getSession()
      if (s) await track(s, 'demo_created')
    } catch (e) {
      // The academy itself exists; only the sample data failed. Let the owner in rather than block signup.
      console.error('Demo data provisioning failed', e)
    }
  }
  redirect('/dashboard')
}

/** For a signed-in user who has no organization yet (e.g. confirmed email after signing up). */
export async function createOrganization(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  const orgName = str(fd, 'orgName')
  const fullName = str(fd, 'fullName')
  if (!orgName || !fullName) return { error: 'Please fill in every field.' }
  try {
    await withUser(data.user.id, (q) => q('select create_organization($1, $2)', [orgName, fullName]))
  } catch {
    return { error: 'Could not create your facility. You may already belong to one.' }
  }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = str(fd, 'password')
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/')
}
