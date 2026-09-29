// Assistant: predefined read-only queries, NL routing, drafts saved only on explicit confirmation.
import { launch, login, check, done, BASE } from './lib.mjs'
import pg from 'pg'

const db = new pg.Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/academyos_dev' })
await db.connect()
const reportsBefore = (await db.query('select count(*)::int as n from progress_reports')).rows[0].n

const path = (p) => new URL(p.url()).pathname
const { browser, page, errors } = await launch({ width: 1280, height: 900 })
await login(page, 'owner@vegaselite.test')
await page.click('a:has-text("Ask the assistant")')
await page.waitForURL('**/assistant')
check('template mode disclosed', (await page.innerText('main')).includes('AI drafting is off'))

const askQ = async (q) => {
  await page.fill('input[name=question]', q)
  await page.click('button:text("Ask")')
  await page.waitForSelector('[aria-live=polite] h2')
  await page.waitForFunction(() => !document.querySelector('button[type=submit]')?.disabled)
  return page.innerText('[aria-live=polite]')
}

let t = await askQ("Show me athletes who haven't attended in 14 days")
check('inactive athletes table', t.includes("haven't attended in 14+ days") && /days ago|Never/.test(t))
t = await askQ('Who is due for reassessment?')
check('reassessment list', t.includes('Due for reassessment') && /overdue|Never tested/.test(t))
t = await askQ('Which programs are almost full?')
check('almost full', t.includes('almost full'))
t = await askQ('Which programs have open capacity?')
check('open capacity with spots', /\d+ open spots across \d+ levels/.test(t))
t = await askQ("Summarize Johnny's last 60 days")
check('60-day summary for Johnny', t.includes('Johnny Alvarez · last 60 days') && /attended \d+ of \d+ sessions/.test(t) && t.includes('Attendance'))
t = await askQ('what is the weather')
check('unknown question -> honest help', t.includes("can't answer that yet"))
t = await askQ('Draft a progress report')
check('draft without athlete asks which athlete', t.includes('Which athlete?'))

t = await askQ('Draft a progress report for Johnny')
check('draft shown for review', t.includes('Draft progress report · Johnny Alvarez') && t.includes('Save as draft report'))
const after = (await db.query('select count(*)::int as n from progress_reports')).rows[0].n
check('nothing written before confirmation', after === reportsBefore, `${reportsBefore} -> ${after}`)
await page.fill('textarea[name=summary]', 'Edited by a human before saving.')
await Promise.all([page.waitForURL(/\/reports\/[0-9a-f-]{36}$/), page.click('button:text("Save as draft report")')])
t = await page.innerText('main')
check('confirmed save creates a DRAFT (not shared)', t.includes('Draft · not visible to parents') && t.includes('Edited by a human before saving.'))

// suggestion chip
await page.goto(`${BASE}/assistant`)
await page.click('button:text("Which programs are almost full?")')
await page.waitForSelector('[aria-live=polite] h2')
check('suggestion chips run queries', (await page.innerText('[aria-live=polite]')).includes('almost full'))
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()

// coach can't use it
{
  const c = await launch({ width: 390, height: 844 })
  await login(c.page, 'keith@vegaselite.test')
  await c.page.goto(`${BASE}/assistant`)
  check('coach blocked from assistant', path(c.page) === '/coach/today')
  await c.browser.close()
}
await db.end()
done()
