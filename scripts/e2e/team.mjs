// Owner adds/removes admins; per-coach billing access; membership card visibility.
import { launch, login, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname
const stamp = Date.now().toString().slice(-6)
const adminEmail = `admin${stamp}@example.com`

// ---------- owner adds an admin
let link
{
  const { browser, page, errors } = await launch()
  page.on('dialog', (d) => d.accept())
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/settings`)
  await page.fill('form:has(button:text("Add admin")) input[name=name]', `Alex Admin${stamp}`)
  await page.fill('form:has(button:text("Add admin")) input[name=email]', adminEmail)
  await page.click('button:text("Add admin")')
  await page.waitForSelector('text=was added as an admin')
  link = await page.inputValue('input[aria-label="Admin invite link"]')
  check('admin added + link shown', link.includes('/auth/confirm?token_hash='))
  check('admin listed', (await page.innerText('main')).includes(`Alex Admin${stamp}`))
  // duplicate
  await page.fill('form:has(button:text("Add admin")) input[name=name]', 'Dup')
  await page.fill('form:has(button:text("Add admin")) input[name=email]', 'keith@vegaselite.test')
  await page.click('button:text("Add admin")')
  await page.waitForSelector('form [role=alert]')
  check('existing account rejected', (await page.innerText('form [role=alert]')).includes('already has an AcademyOS account'))
  // athlete profile shows membership to owner
  await page.goto(`${BASE}/athletes?q=Johnny`); await page.click('tbody tr a'); await page.waitForURL(/athletes\//)
  check('owner sees membership card', (await page.innerText('main')).includes('Speed Development Monthly'))
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------- the new admin signs in: full admin area, but no facility/admin management
{
  const { browser, page } = await launch()
  await page.goto(link)
  await page.waitForURL('**/set-password')
  await page.fill('input[name=password]', 'admin-pass-123')
  await Promise.all([page.waitForURL('**/dashboard'), page.click('button[type=submit]')])
  check('admin lands on dashboard', path(page) === '/dashboard')
  await page.goto(`${BASE}/billing`)
  check('admin can open billing', path(page) === '/billing')
  await page.goto(`${BASE}/settings`)
  const t = await page.innerText('main')
  check('admin cannot edit facility or add admins', t.includes('Only the owner can change these') && !t.includes('Add admin'))
  await browser.close()
}

// ---------- coach billing access toggle
{
  const { browser, page } = await launch()
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/coaches`)
  const sw = page.locator('button[aria-label="Coach Mike can see billing"]')
  if ((await sw.getAttribute('aria-checked')) === 'true') { await sw.click(); await page.waitForSelector('button[aria-label="Coach Mike can see billing"][aria-checked=false]') }
  // coach without access: no membership card
  const c = await launch({ width: 390, height: 844 })
  await login(c.page, 'mike@vegaselite.test')
  await c.page.goto(`${BASE}/coach/athletes?q=Johnny`); await c.page.locator('main a').first().click(); await c.page.waitForURL(/coach\/athletes\//)
  const profileUrl = c.page.url()
  check('coach without access: no membership card', !(await c.page.innerText('main')).includes('Speed Development Monthly'))
  // grant
  await sw.click()
  await page.waitForSelector('button[aria-label="Coach Mike can see billing"][aria-checked=true]')
  await c.page.goto(profileUrl)
  check('coach with access: sees membership card', (await c.page.innerText('main')).includes('Speed Development Monthly'))
  await c.page.goto(`${BASE}/billing`)
  check('coach with access still has no billing admin page', path(c.page) === '/coach/today')
  // revoke
  await page.locator('button[aria-label="Coach Mike can see billing"]').click()
  await page.waitForSelector('button[aria-label="Coach Mike can see billing"][aria-checked=false]')
  await c.page.goto(profileUrl)
  check('revoked: card gone again', !(await c.page.innerText('main')).includes('Speed Development Monthly'))
  await c.browser.close()

  // owner removes the admin
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}/settings`)
  await page.locator(`li:has-text("Alex Admin${stamp}") button:text("Remove")`).click()
  await page.waitForFunction((n) => !document.body.innerText.includes(n), `Alex Admin${stamp}`)
  check('admin removed', true)
  await browser.close()
  const a = await launch()
  await a.page.goto(`${BASE}/login`)
  await a.page.fill('input[name=email]', adminEmail); await a.page.fill('input[name=password]', 'admin-pass-123')
  await Promise.all([a.page.waitForURL((u) => !u.pathname.startsWith('/login')), a.page.click('button[type=submit]')])
  check('removed admin has no academy access (onboarding)', path(a.page) === '/onboarding', path(a.page))
  await a.browser.close()
}
done()
