import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Optional Claude drafting. Only used to turn structured facts into short, friendly prose.
 * Returns null (caller falls back to a deterministic template) when no key is set or anything fails.
 * Claude never gets write access to anything: it receives JSON facts and returns text.
 */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY)

const SYSTEM = `You write short updates for a youth sports-performance facility.
Use only the facts in the JSON you are given; never invent numbers, drills, or events.
Warm, specific, plain English for parents and coaches. No headings, no bullet points, no emojis.`

let client: Anthropic | null = null

export async function draftText(task: string, facts: unknown, maxWords = 120): Promise<string | null> {
  if (!aiEnabled()) return null
  client ??= new Anthropic()
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `${task} Keep it under ${maxWords} words.\n\nFacts (JSON):\n${JSON.stringify(facts)}`,
      }],
    })
    if (res.stop_reason === 'refusal') return null
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
    return text || null
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`Claude draft failed (${e.status}): ${e.message}`)
    else console.error('Claude draft failed', e)
    return null
  }
}
