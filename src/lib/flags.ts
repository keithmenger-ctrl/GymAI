import 'server-only'
import { notFound } from 'next/navigation'

// Optional features. Every flag is off unless its env var is "true", so the default build is the plain shell.
const on = (name: string) => process.env[name] === 'true'

export const flags = {
  billing: () => on('FEATURE_BILLING'),
  assistant: () => on('FEATURE_ASSISTANT'),
  pilotFeedback: () => on('FEATURE_PILOT_FEEDBACK'),
  demo: () => on('FEATURE_DEMO'),
}

/** For pages and server actions of a disabled feature: behaves as if the route does not exist. */
export function requireFlag(name: keyof typeof flags) {
  if (!flags[name]()) notFound()
}
