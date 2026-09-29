// Billing (dev mode) + settings.
import { launch, login, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname
const stamp = Date.now().toString().slice(-5)

const { browser, page, errors } = await launch({ width: 1366, height: 900 })
page.on('dialog', (d) => d.accept())
await login(page, 'owner@vegaselite.test')
await page.goto(`${BASE}/billing`)
let txt = await page.innerText('main')
check('dev mode banner', txt.includes('Dev mode.'))
check('MRR + counts', /monthly recurring revenue/i.test(txt) && /\$[\d,]+/.test(txt))
check('memberships listed, past due first', (await page.locator('main .divide-y > div').first().innerText()).includes('Past due'))

// plans: add + edit + archive
await page.fill('form:has(button:text("Add plan")) input[name=name]', `Camp ${stamp}`)
await page.fill('form:has(button:text("Add plan")) input[name=price]', '99')
await page.click('button:text("Add plan")')
await page.waitForSelector(`text=Camp ${stamp} added`)
await page.reload()
check('plan added', (await page.innerText('main')).includes(`Camp ${stamp}`))

const selectPlan = async () => {
  const v = await page.locator('select[name=plan_id] option', { hasText: `Camp ${stamp}` }).getAttribute('value')
  await page.selectOption('select[name=plan_id]', v)
}
// assign membership (dev): active + first payment
const athleteOption = await page.locator('select[name=athlete_id] option').nth(3).innerText()
const athleteName = athleteOption.split(' · ')[0]
await page.selectOption('select[name=athlete_id]', { index: 3 })
await selectPlan()
await page.click('button:text("Start membership")')
await page.waitForSelector('text=Membership started')
await page.reload()
let row = page.locator(`main .divide-y > div:has-text("${athleteName}"):has-text("Camp ${stamp}")`)
check('assign: new active membership with paid first payment', (await row.innerText()).includes('Active') && (await row.innerText()).includes('$99 paid'))
// duplicate prevented
await page.selectOption('select[name=athlete_id]', { index: 3 })
await selectPlan()
await page.click('button:text("Start membership")')
await page.waitForSelector('form [role=alert]')
check('assign: duplicate rejected', (await page.innerText('form [role=alert]')).includes('already has'))

// simulate failed -> past due; paid -> active and next billing advances
await row.locator('button:text("Sim. failed")').click()
await page.waitForFunction((n) => [...document.querySelectorAll('main .divide-y > div')].some((d) => d.innerText.includes(n) && d.innerText.includes('Past due')), `Camp ${stamp}`)
check('simulate failed -> past due', true)
row = page.locator(`main .divide-y > div:has-text("Camp ${stamp}")`)
const nextBefore = await row.locator('p:below(:text("Next billing"))').first().innerText()
await row.locator('button:text("Sim. paid")').click()
await page.waitForFunction((n) => [...document.querySelectorAll('main .divide-y > div')].some((d) => d.innerText.includes(n) && d.innerText.includes('Active')), `Camp ${stamp}`)
const nextAfter = await row.locator('p:below(:text("Next billing"))').first().innerText()
check('simulate paid -> active + next billing advanced', nextBefore !== nextAfter, `${nextBefore} -> ${nextAfter}`)

// filter
await page.click('nav[aria-label="Filter memberships"] a:text("Past due")')
await page.waitForURL(/status=past_due/)
const rows = await page.locator('main .divide-y > div').allInnerTexts()
check('filter: only past due', rows.length > 0 && rows.every((r) => r.includes('Past due')))

// cancel
await page.goto(`${BASE}/billing`)
await page.locator(`main .divide-y > div:has-text("Camp ${stamp}") button:text("Cancel")`).click()
await page.waitForFunction((n) => [...document.querySelectorAll('main .divide-y > div')].some((d) => d.innerText.includes(n) && d.innerText.includes('Canceled')), `Camp ${stamp}`)
check('cancel -> canceled', true)
// archive plan
await page.locator(`summary:has-text("Camp ${stamp}")`).click()
await page.locator('details[open] button:text("Archive plan")').click()
await page.waitForSelector(`summary:has-text("Camp ${stamp}") >> text=Archived`)
check('plan archived + hidden from assign form', !(await page.locator('select[name=plan_id]').innerText()).includes(`Camp ${stamp}`))

// settings
await page.goto(`${BASE}/settings`)
await page.fill('form:has(button:text("Add location")) input[name=name]', `Turf ${stamp}`)
await page.click('button:text("Add location")')
await page.waitForSelector(`text=Turf ${stamp}`)
check('settings: location added', true)
check('settings: billing mode shown', (await page.innerText('main')).includes('Dev mode'))
await page.fill('input[name=name] >> nth=0', 'Vegas Elite Performance')
await page.click('button:text-is("Save")')
await page.waitForSelector('text=Saved')
check('settings: org saved', true)
check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()

// parent billing
{
  const p = await launch({ width: 390, height: 844 })
  await login(p.page, 'parent1@vegaselite.test')
  await p.page.goto(`${BASE}/parent/billing`)
  txt = await p.page.innerText('main')
  check('parent: membership card with price + next billing', /\$\d+ \/ month/.test(txt) && txt.includes('Next billing'))
  check('parent: recent payments', /recent payments/i.test(txt) && /\$\d+ · paid/.test(txt))
  check('parent: honest note, no fake pay button', txt.includes('Online payments are not enabled') && !txt.includes('Complete payment'))
  await p.browser.close()
}
// coach cannot see billing
{
  const c = await launch({ width: 390, height: 844 })
  await login(c.page, 'mike@vegaselite.test')
  await c.page.goto(`${BASE}/billing`)
  check('coach blocked from billing', path(c.page) === '/coach/today')
  await c.browser.close()
}
done()
