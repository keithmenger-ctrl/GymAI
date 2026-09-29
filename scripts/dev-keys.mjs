// Prints anon + service_role JWTs signed with the local GoTrue secret (dev only).
import crypto from 'node:crypto'
const secret = process.env.GOTRUE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (role) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ role, iss: 'supabase-local', iat: 1700000000, exp: 2000000000 })
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${sign('anon')}`)
console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign('service_role')}`)
