// "Start with demo data" at signup + the demo view switcher.
import { launch, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname
const email = `prospect${Date.now()}@example.com`
const { browser, page, errors } = await launch({ width: 1280, height: 900 })

await page.goto(`${BASE}/signup`)
check('demo data checkbox on by default', await page.isChecked('input[name=demo]'))
await page.fill('input[name=orgName]', 'Summit Speed Lab')
await page.fill('input[name=fullName]', 'Pat Prospect')
await page.fill('input[name=email]', email)
await page.fill('input[name=password]', 'a-long-password')
const t0 = Date.now()
await Promise.all([page.waitForURL('**/dashboard', { timeout: 90000 }), page.click('button[type=submit]')])
console.log(`   signup + demo provisioning took ${((Date.now() - t0) / 1000).toFixed(1)}s`)
let t = await page.innerText('body')
check('lands on dashboard with demo bar', t.includes('Demo academy') && t.includes('Summit Speed Lab'))
check('dashboard has sessions today + MRR', /SESSIONS TODAY\s*5/i.test(t) && /\$[\d,]+/.test(t))
await page.goto(`${BASE}/athletes`)
check('own copy: exactly 30 athletes (not the other demo org\'s)', (await page.locator('tbody tr').count()) === 30)
await page.goto(`${BASE}/athletes?q=Johnny`); await page.click('tbody tr a'); await page.waitForURL(/athletes\//)
check('timeline milestone uses this org name', (await page.innerText('main')).includes('Joined Summit Speed Lab'))

// switch to coach
await Promise.all([page.waitForURL('**/coach/today'), page.click('button:text-is("Coach")')])
t = await page.innerText('body')
check('coach view: own sessions today', t.includes('Coach Keith') && t.includes('Youth Speed Development'))
await page.goto(`${BASE}/dashboard`)
check('as coach, owner area is blocked (real role)', path(page) === '/coach/today')
// switch to parent
await Promise.all([page.waitForURL('**/parent'), page.click('button:text-is("Parent")')])
t = await page.innerText('main')
check('parent view: David Alvarez sees Johnny', t.includes('Johnny') && !t.includes('Marcus'))
// back to owner = the prospect's own account
await Promise.all([page.waitForURL('**/dashboard'), page.click('button:text-is("Owner")')])
check('back to owner (the prospect)', (await page.innerText('header')).includes('Pat Prospect'))
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
done()
