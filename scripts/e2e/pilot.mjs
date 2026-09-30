// Feedback button + usage events land in the database.
import { launch, login, check, done, BASE } from './lib.mjs'
import pg from 'pg'

const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/academyos_dev' })
await db.connect()
const since = new Date()
const count = async (sql, p = []) => (await db.query(sql, p)).rows[0].n

const { browser, page, errors } = await launch({ width: 390, height: 844 })
await login(page, 'keith@vegaselite.test')
check('login event recorded with role', (await count(`select count(*)::int n from usage_events where name='login' and role='coach' and created_at >= $1`, [since])) >= 1)

// feedback from the coach session page
await page.locator('main a:has-text("Level 1 ·")').first().click()
await page.waitForURL(/coach\/sessions/)
await page.click('button[aria-label="Send feedback"]')
const msg = `Would love a timer on this screen ${Date.now()}`
await page.fill('form textarea[name=body] >> nth=0', msg)
await page.click('button:text("Send feedback")')
await page.waitForSelector('text=Thanks! Your feedback was sent.')
const fb = (await db.query('select role, page from feedback where body = $1', [msg])).rows[0]
check('feedback stored with role + page', fb?.role === 'coach' && fb?.page.startsWith('/coach/sessions/'), JSON.stringify(fb))

// attendance -> event
const g = page.locator('[role=group][aria-label^="Attendance for"]').first()
const on = g.locator('button[aria-pressed=true]')
if (await on.count()) { await on.click(); await page.waitForTimeout(500) }
await g.locator('button[aria-label=Late]').click()
await page.waitForTimeout(1000)
check('attendance event recorded', (await count(`select count(*)::int n from usage_events where name='attendance_marked' and created_at >= $1`, [since])) >= 1)
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
await db.end()
done()
