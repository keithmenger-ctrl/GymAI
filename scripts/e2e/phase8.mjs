// Athlete progress actions + parent portal.
import { launch, login, check, done, isBlocked, BASE } from './lib.mjs'

const stamp = Date.now().toString().slice(-5)
let johnnyUrl, otherAthleteUrl

// ---------------- owner: milestone + advance level
{
  const { browser, page, errors } = await launch()
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/athletes?q=Johnny`)
  await page.click('tbody tr a')
  await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/)
  johnnyUrl = page.url()
  await page.fill('input[name=title]', `Milestone ${stamp}: first sub-1.8 sprint`)
  await page.click('button:text("Add milestone")')
  await page.waitForSelector(`text=Milestone ${stamp}`)
  check('milestone appears on timeline', true)
  check('staff timeline shows note text, not placeholder', !(await page.innerText('main')).includes('Coach note added'))

  // a different athlete (not parent1's) for the isolation check later
  await page.goto(`${BASE}/athletes?q=Marcus`)
  await page.click('tbody tr a')
  await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/)
  otherAthleteUrl = page.url()

  // advance Liam (Level 1) to next level, then check timeline
  await page.goto(`${BASE}/athletes?q=Liam`)
  await page.click('tbody tr a')
  await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/)
  const btn = page.locator('button:has-text("Advance to")')
  if (await btn.count()) {
    const label = (await btn.innerText()).replace('Advance to ', '')
    await btn.click()
    await page.waitForSelector(`text=Advanced to ${label}`)
    check('advance level: logged on timeline', (await page.innerText('main')).includes(`Advanced to ${label}`))
  } else {
    check('advance level: (already at top level, skipped)', true)
  }
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- coach can add milestone, cannot advance level
{
  const { browser, page } = await launch({ width: 390, height: 844 })
  await login(page, 'keith@vegaselite.test')
  await page.goto(johnnyUrl.replace('/athletes/', '/coach/athletes/'))
  check('coach: no advance button', (await page.locator('button:has-text("Advance to")').count()) === 0)
  check('coach: can add milestone', (await page.locator('button:text("Add milestone")').count()) === 1)
  await browser.close()
}

// ---------------- parent portal (parent1 = Johnny's guardian)
{
  const { browser, page, errors } = await launch({ width: 390, height: 844 })
  await login(page, 'parent1@vegaselite.test')
  let txt = await page.innerText('main')
  check('home: athlete card', txt.includes('Johnny Alvarez') && txt.includes('Youth Speed Development'))
  check('home: next session + attendance', /NEXT SESSION|Next session/i.test(txt) && /\d+ \/ \d+/.test(txt))
  check('home: membership status badge', /active|past due|trialing/i.test(txt))
  await page.screenshot({ path: '/tmp/shot-parent-home.png', fullPage: true })

  await page.goto(`${BASE}/parent/schedule`)
  txt = await page.innerText('main')
  check('schedule: upcoming sessions listed', txt.includes('Youth Speed Development'))

  await page.goto(`${BASE}/parent/progress`)
  await page.waitForURL(/\/parent\/progress\/[0-9a-f-]{36}$/)
  txt = await page.innerText('main')
  check('progress: single athlete redirects to profile', txt.includes('Johnny Alvarez'))
  check('progress: assessment progress visible', txt.includes('Assessment progress') && txt.includes('→'))
  check('progress: milestone visible to parent', txt.includes(`Milestone ${stamp}`))
  check('progress: no guardian/admin controls', !txt.includes('Parent / guardian') && !txt.includes('Edit athlete') && !txt.includes('Add milestone'))
  check('progress: no private "Coach note added" placeholders', !txt.includes('Coach note added'))
  check('progress: no internal athlete notes', !txt.includes('Wants to make varsity'))
  check('progress: no "Shared with parent" staff badge', !txt.includes('Shared with parent'))

  // isolation: another family's athlete
  const otherId = otherAthleteUrl.split('/').pop()
  await page.goto(`${BASE}/parent/progress/${otherId}`)
  check('isolation: other athlete blocked for parent, no data rendered', await isBlocked(page, ['Marcus', 'Assessment history']))
  check('no console errors (parent)', errors.filter((e) => !e.includes('404')).length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}
done()
