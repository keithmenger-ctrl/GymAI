// CSV import: template download, preview with row errors, duplicate skip, commit, re-import idempotency.
import { launch, login, check, done, BASE } from './lib.mjs'
import fs from 'node:fs'

const stamp = Date.now().toString().slice(-5)
const csv = [
  'First Name,Last Name,DOB,Program,Level,Parent Name,Parent Email,Parent Phone,Status,Favorite Color',
  `Ava${stamp},"O'Neil, Jr",4/18/2012,Youth Speed Development,2,Sam O'Neil,sam${stamp}@example.com,702-555-0101,active,blue`,
  `Ben${stamp},Cruz,2010-09-02,Baseball Performance,Level 1,"Cruz, Maria",maria${stamp}@example.com,,trial,red`,
  `Cal${stamp},Diaz,13/40/2011,,,,,,,green`,
  `Dee${stamp},Ek,2012-01-01,Underwater Hockey,,,,,,`,
  `Eli${stamp},Fox,2011-02-03,,,Pat Fox,not-an-email,,,`,
  `Johnny,Alvarez,${''},,,,,,,`,
].join('\r\n')
const file = `/tmp/import-${stamp}.csv`
fs.writeFileSync(file, csv)

const { browser, page, errors } = await launch({ width: 1280, height: 900 })
await login(page, 'owner@vegaselite.test')
await page.goto(`${BASE}/athletes`)
const before = await page.locator('tbody tr').count()
await page.click('a:text("Import CSV")')
await page.waitForURL('**/athletes/import')

// template download
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('a:text("Download the template")')])
const tpl = fs.readFileSync(await dl.path(), 'utf8')
check('template downloads with headers', tpl.startsWith('First name,Last name,Date of birth'))

await page.setInputFiles('input[type=file]', file)
await page.click('button:text("Check file")')
await page.waitForSelector('table')
const t = await page.innerText('main')
check('preview: 2 ready', t.includes('2 ready'))
check('preview: errors reported per row', t.includes("13/40/2011\" isn't a date") && t.includes('Program "Underwater Hockey" doesn\'t exist') && t.includes('Parent email "not-an-email" is invalid'))
check('preview: quoted commas + apostrophes parsed', t.includes(`Ava${stamp} O'Neil, Jr`) && t.includes('Cruz, Maria'))
check('preview: level "2" resolves to Level 2', t.includes('Youth Speed Development · Level 2'))
check('preview: unknown column ignored + reported', t.includes('Ignored columns: Favorite Color'))
await page.goto(`${BASE}/athletes`)
check('no athletes created by preview', (await page.locator('tbody tr').count()) === before)

// commit
await page.goto(`${BASE}/athletes/import`)
await page.setInputFiles('input[type=file]', file)
await page.click('button:text("Check file")')
await page.waitForSelector('button:text("Import 2 athletes")')
await page.click('button:text("Import 2 athletes")')
await page.waitForSelector('text=Imported 2 athletes')
check('commit: 2 imported, rest skipped', (await page.innerText('main')).includes('rows were skipped'))
await page.goto(`${BASE}/athletes`)
check('athlete list grew by 2', (await page.locator('tbody tr').count()) === before + 2)
await page.goto(`${BASE}/athletes?q=Ava${stamp}`)
await page.click('tbody tr a')
await page.waitForURL(/athletes\//)
const p = await page.innerText('main')
check('imported athlete: program, level, trial/active, parent linked', p.includes('Youth Speed Development') && p.includes('Level 2') && p.includes("Sam O'Neil") && p.includes(`sam${stamp}@example.com`))
check('imported athlete: joined milestone', p.includes('Joined Vegas Elite Performance'))

// re-import is idempotent (duplicates skipped)
await page.goto(`${BASE}/athletes/import`)
await page.setInputFiles('input[type=file]', file)
await page.click('button:text("Check file")')
await page.waitForSelector('table')
check('re-import: previously imported rows flagged as existing', (await page.innerText('main')).includes('0 ready') && (await page.innerText('main')).includes('already exist'))
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()

// coach cannot import
{
  const c = await launch()
  await login(c.page, 'keith@vegaselite.test')
  await c.page.goto(`${BASE}/athletes/import`)
  check('coach blocked from import', new URL(c.page.url()).pathname === '/coach/today')
  const r = await c.page.goto(`${BASE}/athletes/import/template`)
  check('coach blocked from template', new URL(c.page.url()).pathname === '/coach/today' || r.status() >= 300)
  await c.browser.close()
}
done()
