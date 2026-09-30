// 404 pages, sparklines, test-due chips.
import { launch, login, check, done, BASE } from './lib.mjs'

const { browser, page } = await launch()
await login(page, 'owner@vegaselite.test')
// With loading skeletons the response streams (status already 200), so assert on what the user sees.
await page.goto(`${BASE}/athletes/00000000-0000-0000-0000-000000000000`)
await page.waitForSelector("text=We couldn't find that")
check('unknown athlete -> in-shell 404 with navigation', (await page.locator('aside nav a').count()) === 9)
const res = await page.goto(`${BASE}/this-page-does-not-exist`)
check('unknown route -> 404 status + friendly page', res.status() === 404 && (await page.innerText('body')).includes('Go to my home screen'))
await page.goto(`${BASE}/athletes?q=Johnny`); await page.click('tbody tr a'); await page.waitForURL(/athletes\//)
const sparks = page.locator('svg[role=img][aria-label*=" on "]')
await sparks.first().waitFor()
check('sparklines on profile, one per multi-result metric', (await sparks.count()) >= 4)
check('sparkline has an accessible summary', /sec on /.test(await sparks.first().getAttribute('aria-label')))
await browser.close()

// Ethan Brooks is seeded as overdue and is on Coach Keith's Speed Level 1 roster today.
const c = await launch({ width: 390, height: 844 })
await login(c.page, 'keith@vegaselite.test')
await c.page.locator('main a:has-text("Level 1 ·")').first().click()
await c.page.waitForURL(/coach\/sessions/)
await c.page.waitForSelector('[role=group][aria-label="Attendance for Ethan Brooks"]')
check('overdue athlete shows a "Test due" chip', (await c.page.locator('li:has([aria-label="Attendance for Ethan Brooks"]) >> text=Test due').count()) === 1)
check('up-to-date athlete has no chip', (await c.page.locator('li:has([aria-label="Attendance for Johnny Alvarez"]) >> text=Test due').count()) === 0)
await c.browser.close()
done()
