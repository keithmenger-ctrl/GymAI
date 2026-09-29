// Tiny Playwright helpers for verifying the running app (dev server on :3000, local GoTrue + seeded Postgres).
import { chromium } from 'playwright-core'
import fs from 'node:fs'

export const BASE = process.env.BASE_URL || 'http://localhost:3000'
export const PASSWORD = 'academyos-demo'

const exe = () => {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  const dir = fs.readdirSync(root).find((d) => /^chromium-\d+$/.test(d))
  return `${root}/${dir}/chrome-linux/chrome`
}

export async function launch(viewport = { width: 1280, height: 800 }) {
  const browser = await chromium.launch({ executablePath: exe(), args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return { browser, ctx, page, errors }
}

export async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', PASSWORD)
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), page.click('button[type=submit]')])
}

let failures = 0
export function check(name, ok, extra = '') {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} - ${name}${!ok && extra ? ` (${extra})` : ''}`)
}
export const done = () => {
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
  process.exit(failures ? 1 : 0)
}
