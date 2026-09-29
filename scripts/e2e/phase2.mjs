import { launch, login, check, done, BASE } from './lib.mjs'

const path = (page) => new URL(page.url()).pathname

// signed out
{
  const { browser, page } = await launch()
  await page.goto(`${BASE}/dashboard`)
  check('signed-out /dashboard -> /login', path(page) === '/login', path(page))
  await page.goto(`${BASE}/login`)
  await page.fill('input[name=email]', 'owner@vegaselite.test')
  await page.fill('input[name=password]', 'wrong-password')
  await page.click('button[type=submit]')
  await page.waitForSelector('form [role=alert]')
  check('bad password shows error', (await page.textContent('form [role=alert]')).includes('Incorrect'))
  await browser.close()
}

// owner
{
  const { browser, page, errors } = await launch()
  await login(page, 'owner@vegaselite.test')
  check('owner lands on /dashboard', path(page) === '/dashboard', path(page))
  check('owner sidebar has 9 nav items', (await page.locator('aside nav a').count()) === 9)
  check('org name shown', (await page.textContent('aside')).includes('Vegas Elite Performance'))
  await page.goto(`${BASE}/coach/today`)
  check('owner may open coach view', path(page) === '/coach/today', path(page))
  await page.goto(`${BASE}/parent`)
  check('owner blocked from parent area', path(page) === '/dashboard', path(page))
  await page.screenshot({ path: '/tmp/shot-owner.png' })
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// coach (phone)
{
  const { browser, page } = await launch({ width: 390, height: 844 })
  await login(page, 'keith@vegaselite.test')
  check('coach lands on /coach/today', path(page) === '/coach/today', path(page))
  check('coach bottom tabs (3)', (await page.locator('nav[aria-label=Primary] a').count()) === 3)
  await page.goto(`${BASE}/dashboard`)
  check('coach blocked from owner area', path(page) === '/coach/today', path(page))
  await page.goto(`${BASE}/billing`)
  check('coach blocked from billing', path(page) === '/coach/today', path(page))
  await page.screenshot({ path: '/tmp/shot-coach.png' })
  await browser.close()
}

// parent (phone)
{
  const { browser, page } = await launch({ width: 390, height: 844 })
  await login(page, 'parent1@vegaselite.test')
  check('parent lands on /parent', path(page) === '/parent', path(page))
  check('parent bottom tabs (4)', (await page.locator('nav[aria-label=Primary] a').count()) === 4)
  await page.goto(`${BASE}/coach/today`)
  check('parent blocked from coach area', path(page) === '/parent', path(page))
  await page.goto(`${BASE}/athletes`)
  check('parent blocked from owner area', path(page) === '/parent', path(page))
  await page.click('button[aria-label="Sign out"]')
  await page.waitForURL('**/login')
  await page.goto(`${BASE}/parent`)
  check('after sign-out, /parent -> /login', path(page) === '/login', path(page))
  await browser.close()
}

// signup creates a fresh org, isolated from seeded data
{
  const { browser, page } = await launch()
  const email = `owner${Date.now()}@abcbaseball.test`
  await page.goto(`${BASE}/signup`)
  await page.fill('input[name=orgName]', 'ABC Baseball Academy')
  await page.fill('input[name=fullName]', 'Abe Coach')
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', 'a-long-password')
  await Promise.all([page.waitForURL('**/dashboard', { timeout: 20000 }), page.click('button[type=submit]')])
  check('signup lands on /dashboard', path(page) === '/dashboard', path(page))
  check('new org name shown, not the demo org', (await page.textContent('aside')).includes('ABC Baseball Academy') && !(await page.innerText('body')).includes('Vegas Elite'))
  await browser.close()
}
done()
