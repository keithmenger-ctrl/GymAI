import { launch, login, check, done, BASE } from './lib.mjs'

const path = (page) => new URL(page.url()).pathname
const stamp = Date.now().toString().slice(-6)

const { browser, page, errors } = await launch()
await login(page, 'owner@vegaselite.test')

// list, search, filter
await page.goto(`${BASE}/athletes`)
const before = await page.locator('tbody tr').count()
check('list shows seeded athletes (>=30)', before >= 30, String(before))
await page.goto(`${BASE}/athletes?q=Johnny`)
check('search narrows to 1', (await page.locator('tbody tr').count()) === 1)
await page.goto(`${BASE}/athletes?status=trial`)
check('status filter (trial)', (await page.locator('tbody tr').count()) === 1)
await page.goto(`${BASE}/athletes?q=zzzzzz`)
check('empty state on no match', (await page.innerText('main')).includes('No athletes match'))

// profile
await page.goto(`${BASE}/athletes?q=Johnny`)
await page.click('tbody tr a')
await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/)

let txt = await page.innerText('main')
check('profile: name', txt.includes('Johnny Alvarez'))
check('profile: program + level', txt.includes('Youth Speed Development') && txt.includes('Level 1'))
check('profile: attendance x / y sessions', /\d+\s*\/\s*\d+ sessions/.test(txt))
check('profile: assessment progress arrows', txt.includes('→'))
check('profile: has timeline, notes, history', ['Progress timeline', 'Coach notes', 'Assessment history', 'Recent attendance'].every((t) => txt.includes(t)))
check('profile: timeline shows joined', txt.includes('Joined Vegas Elite Performance'))
await page.screenshot({ path: '/tmp/shot-profile.png', fullPage: true })

// create
await page.goto(`${BASE}/athletes/new`)
await page.fill('input[name=first_name]', `Test${stamp}`)
await page.fill('input[name=last_name]', 'Newkid')
await page.fill('input[name=date_of_birth]', '2012-05-04')
await page.selectOption('select[name=program_id]', { label: 'Baseball Performance' })
await page.selectOption('select[name=level_id]', { label: 'Level 1' })
await page.fill('input[name=guardian_name]', 'Pat Newkid')
await page.fill('input[name=guardian_email]', `pat${stamp}@example.com`)
await Promise.all([page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/), page.click('button[type=submit]')])
const newUrl = page.url()
txt = await page.innerText('main')
check('create: lands on new profile', txt.includes(`Test${stamp} Newkid`) && txt.includes('Baseball Performance'))
check('create: guardian saved', txt.includes('Pat Newkid'))
await page.goto(`${BASE}/athletes`)
check('create: list grew by one', (await page.locator('tbody tr').count()) === before + 1)

// validation
await page.goto(`${BASE}/athletes/new`)
await page.fill('input[name=first_name]', 'X')
await page.fill('input[name=last_name]', 'Y')
await page.fill('input[name=guardian_email]', 'not-an-email')
await page.evaluate(() => document.querySelector('input[name=guardian_email]').setAttribute('type', 'text'))
await page.click('button[type=submit]')
await page.waitForSelector('form [role=alert]')
check('validation error shown', (await page.innerText('form [role=alert]')).toLowerCase().includes('email'))

// edit -> level change lands on timeline via trigger
await page.goto(`${newUrl}/edit`)
await page.selectOption('select[name=level_id]', { label: 'Level 2' })
await Promise.all([page.waitForURL(newUrl), page.click('button[type=submit]')])
txt = await page.innerText('main')
check('edit: level updated', txt.includes('Level 2'))
check('edit: timeline logged level change', txt.includes('Advanced to Level 2'))

// invite parent
await page.getByRole('button', { name: 'Invite to parent portal' }).click()
const link = await page.locator('input[aria-label="Invite link"]').inputValue()
check('invite: link generated', link.includes('/auth/confirm?token_hash='))
{
  const p2 = await (await browser.newContext()).newPage()
  await p2.goto(link)
  await p2.waitForURL('**/set-password')
  check('invite: link opens set-password', path(p2) === '/set-password')
  await p2.fill('input[name=password]', 'parent-secret-1')
  await Promise.all([p2.waitForURL('**/parent'), p2.click('button[type=submit]')])
  check('invite: parent lands in portal', path(p2) === '/parent')
  await p2.goto(`${BASE}/athletes`)
  check('invite: parent cannot open owner area', path(p2) === '/parent', path(p2))
  const p4 = await (await browser.newContext()).newPage()
  await p4.goto(link)
  await p4.waitForURL('**/login**')
  check('invite: link is single-use (reuse rejected)', p4.url().includes('invalid_link'), p4.url())
  // sign in with new password
  const p3 = await (await browser.newContext()).newPage()
  await p3.goto(`${BASE}/login`)
  await p3.fill('input[name=email]', `pat${stamp}@example.com`)
  await p3.fill('input[name=password]', 'parent-secret-1')
  await Promise.all([p3.waitForURL('**/parent'), p3.click('button[type=submit]')])
  check('invite: parent can sign in with chosen password', path(p3) === '/parent')
}
// re-invite an existing email already used by an owner is refused
await page.goto(`${BASE}/athletes?q=Johnny`)
await page.click('tbody tr a')
// (Johnny's parent already has a login -> fresh link works)
await page.getByRole('button', { name: 'New sign-in link' }).click()
await page.waitForSelector('input[aria-label="Invite link"]')
check('invite: existing parent gets fresh link', (await page.locator('input[aria-label="Invite link"]').inputValue()).includes('token_hash='))

// coach view
{
  const c = await launch({ width: 390, height: 844 })
  await login(c.page, 'keith@vegaselite.test')
  await c.page.goto(`${BASE}/coach/athletes`)
  check('coach: sees athletes list', (await c.page.locator('main a').count()) >= 30)
  await c.page.goto(`${BASE}/coach/athletes?q=Johnny`)
  await c.page.click('main a')
  await c.page.waitForURL(/\/coach\/athletes\/[0-9a-f-]{36}$/)
  const ct = await c.page.innerText('main')
  check('coach: profile has no edit/invite controls', !ct.includes('Edit athlete') && !ct.includes('Invite to parent portal') && !ct.includes('New sign-in link'))
  await c.page.goto(`${BASE}/athletes/new`)
  check('coach: cannot open add-athlete', path(c.page) === '/coach/today', path(c.page))
  await c.browser.close()
}
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
done()
