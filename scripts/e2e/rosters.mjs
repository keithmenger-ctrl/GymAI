// Upcoming session rosters follow level/status changes; past sessions and attendance are untouched.
import { launch, login, check, done, BASE } from './lib.mjs'
import pg from 'pg'

const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/academyos_dev' })
await db.connect()
const n = async (sql, p) => (await db.query(sql, p)).rows[0].n
const future = (level) => `select count(*)::int n from session_athletes sa join sessions s on s.id = sa.session_id
  join program_levels l on l.id = s.level_id where sa.athlete_id = $1 and s.starts_at > now() and l.name = '${level}'
  and s.program_id = (select current_program_id from athletes where id = $1)`
const past = `select count(*)::int n from session_athletes sa join sessions s on s.id = sa.session_id where sa.athlete_id = $1 and s.starts_at < now()`

const { browser, page, errors } = await launch()
await login(page, 'owner@vegaselite.test')

// 1. advance a Level 1 speed athlete
const [athlete] = (await db.query(`select a.id from athletes a join program_levels l on l.id = a.current_level_id
  join programs p on p.id = a.current_program_id
  where p.name = 'Youth Speed Development' and l.name = 'Level 1' and a.status = 'active'
    and exists (select 1 from session_athletes sa join sessions s on s.id = sa.session_id where sa.athlete_id = a.id and s.starts_at > now())
  order by a.first_name limit 1`)).rows
if (athlete) {
  const pastBefore = await n(past, [athlete.id])
  check('before: on upcoming Level 1 sessions', (await n(future('Level 1'), [athlete.id])) > 0)
  await page.goto(`${BASE}/athletes/${athlete.id}`)
  await page.click('button:has-text("Advance to Level 2")')
  await page.waitForSelector('text=Advanced to Level 2')
  check('after advance: off upcoming Level 1 sessions', (await n(future('Level 1'), [athlete.id])) === 0)
  check('after advance: on upcoming Level 2 sessions', (await n(future('Level 2'), [athlete.id])) > 0)
  check('past sessions untouched', (await n(past, [athlete.id])) === pastBefore)
} else check('a Level 1 speed athlete exists', false)

// 2. pause an athlete -> removed from all upcoming sessions
const [marcus] = (await db.query(`select id from athletes where first_name = 'Marcus'`)).rows
check('before pause: has upcoming sessions', (await n(`select count(*)::int n from session_athletes sa join sessions s on s.id = sa.session_id where sa.athlete_id = $1 and s.starts_at > now()`, [marcus.id])) > 0)
await page.goto(`${BASE}/athletes/${marcus.id}/edit`)
await page.selectOption('select[name=status]', 'paused')
await Promise.all([page.waitForURL(`**/athletes/${marcus.id}`), page.click('button[type=submit]')])
check('after pause: no upcoming sessions', (await n(`select count(*)::int n from session_athletes sa join sessions s on s.id = sa.session_id where sa.athlete_id = $1 and s.starts_at > now()`, [marcus.id])) === 0)
// back to active -> rejoins
await page.goto(`${BASE}/athletes/${marcus.id}/edit`)
await page.selectOption('select[name=status]', 'active')
await Promise.all([page.waitForURL(`**/athletes/${marcus.id}`), page.click('button[type=submit]')])
check('reactivated: back on upcoming sessions', (await n(`select count(*)::int n from session_athletes sa join sessions s on s.id = sa.session_id where sa.athlete_id = $1 and s.starts_at > now()`, [marcus.id])) > 0)

// 3. editing only notes does not reshuffle manual enrollments
const before3 = await n(`select count(*)::int n from session_athletes where athlete_id = $1`, [marcus.id])
await page.goto(`${BASE}/athletes/${marcus.id}/edit`)
await page.fill('textarea[name=notes]', `note ${Date.now()}`)
await Promise.all([page.waitForURL(`**/athletes/${marcus.id}`), page.click('button[type=submit]')])
check('non-level edit leaves rosters alone', (await n(`select count(*)::int n from session_athletes where athlete_id = $1`, [marcus.id])) === before3)

// 4. new athlete joins upcoming sessions of their level (capacity permitting)
await page.goto(`${BASE}/athletes/new`)
await page.fill('input[name=first_name]', `Roster${Date.now().toString().slice(-5)}`)
await page.fill('input[name=last_name]', 'Test')
await page.selectOption('select[name=program_id]', { label: 'General Athletic Development' })
await page.selectOption('select[name=level_id]', { label: 'Level 1' })
await Promise.all([page.waitForURL(/athletes\/[0-9a-f-]{36}$/), page.click('button[type=submit]')])
const newId = page.url().split('/').pop()
check('new athlete: on upcoming Level 1 sessions', (await n(future('Level 1'), [newId])) > 0)
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
await db.end()
done()
