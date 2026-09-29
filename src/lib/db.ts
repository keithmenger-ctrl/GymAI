import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

// `date` columns stay as 'YYYY-MM-DD' strings (no timezone drift); counts (int8) become numbers.
types.setTypeParser(1082, (v) => v)
types.setTypeParser(20, (v) => parseInt(v, 10))

const globalForPg = globalThis as unknown as { pgPool?: Pool }

function pool() {
  if (!globalForPg.pgPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    globalForPg.pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  }
  return globalForPg.pgPool
}

export type Q = <T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>

async function run<T>(client: PoolClient, fn: (q: Q) => Promise<T>): Promise<T> {
  const q: Q = async (sql, params) => (await client.query(sql, params)).rows as never
  return fn(q)
}

/**
 * Runs `fn` in a transaction as the given user. The `authenticated` role + JWT claims are set
 * locally, so Postgres row level security applies to every query inside `fn`.
 * This is the ONLY way application code should read tenant data.
 */
export async function withUser<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('begin')
    await client.query(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', $2, true)`,
      [userId, JSON.stringify({ sub: userId, role: 'authenticated' })],
    )
    await client.query('set local role authenticated')
    const out = await run(client, fn)
    await client.query('commit')
    return out
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** Bypasses RLS. Server-only: invites, seeding, Stripe webhook. Never pass user-controlled org ids blindly. */
export async function withServiceRole<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    return await run(client, fn)
  } finally {
    client.release()
  }
}
