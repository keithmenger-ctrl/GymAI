// Assessments: metrics admin, due list, coach recorder, profile/timeline updates.
import { launch, login, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname
const stamp = Date.now().toString().slice(-5)

// ---------------- owner: metrics + due list
{
  const { browser, page, errors } = await launch()
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/assessments`)
  let txt = await page.innerText('main')
  check('metrics listed', ['10 Yard Sprint', 'Vertical Jump', 'Broad Jump', 'Pro Agility', 'Push-ups'].every((m) => txt.includes(m)))
  check('due list includes overdue seeded athletes', /Due for reassessment/.test(txt) && /overdue|Never tested/.test(txt))
  check('recent results with direction arrows', txt.includes('▲'))

  // add metric
  await page.fill('form:has(button:text("Add metric")) input[name=name]', `Sit and Reach ${stamp}`)
  await page.fill('form:has(button:text("Add metric")) input[name=unit]', 'cm')
  await page.selectOption('form:has(button:text("Add metric")) select[name=direction]', 'higher')
  await page.fill('form:has(button:text("Add metric")) input[name=category]', 'Mobility')
  await page.click('button:text("Add metric")')
  await page.waitForSelector(`text=Sit and Reach ${stamp} added`)
  await page.reload()
  check('metric added', (await page.innerText('main')).includes(`Sit and Reach ${stamp}`))
  // delete (allowed: no results)
  page.on('dialog', (d) => d.accept())
  await page.locator(`summary:has-text("Sit and Reach ${stamp}")`).click()
  await page.locator(`details[open] button:text("Delete metric")`).click()
  await page.waitForFunction((n) => !document.body.innerText.includes(n), `Sit and Reach ${stamp}`)
  check('unused metric deleted', true)
  // metric with results has no delete
  await page.locator('summary:has-text("10 Yard Sprint")').click()
  check('metric with results cannot be deleted', (await page.locator('details[open] button:text("Delete metric")').count()) === 0)
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- coach: record from today's session
{
  const { browser, page, errors } = await launch({ width: 390, height: 844 })
  await login(page, 'keith@vegaselite.test')
  await page.locator('main a:has-text("Level 1 ·")').first().click()
  await page.waitForURL(/\/coach\/sessions\//)
  await page.click('a:has-text("Record assessments for this group")')
  await page.waitForURL(/\/coach\/assessments\?session=/)
  let txt = await page.innerText('main')
  check('recorder: group label + metric chips', txt.includes('Youth Speed Development · Level 1') && (await page.locator('[role=tab]').count()) >= 7)
  check('recorder: first metric selected, previous results shown', txt.includes('Last:'))
  // choose 10 Yard Sprint explicitly
  await page.click('[role=tab]:has-text("10 Yard Sprint")')
  await page.waitForURL(/metric=/)
  const inputs = page.locator('input[name^="v:"]')
  const n = await inputs.count()
  check('recorder: one field per roster athlete', n >= 5, String(n))
  check('recorder: decimal keypad on phones', (await inputs.first().getAttribute('inputmode')) === 'decimal')
  check('recorder: save disabled until something is entered', await page.locator('button[type=submit]').isDisabled())
  // enter a better time for athlete 0 and a worse for athlete 1
  const firstName = (await page.locator('main li p.font-medium').first().innerText()).trim()
  await inputs.nth(0).fill('0.50')
  await inputs.nth(1).fill('9.90')
  txt = await page.innerText('main')
  check('recorder: live delta shows improvement + regression', txt.includes('▲') && txt.includes('▼'))
  check('recorder: button counts entries', (await page.locator('button[type=submit]').innerText()).includes('Save 2 results'))
  await page.click('button[type=submit]')
  await page.waitForSelector('text=Saved 2 results')
  check('recorder: saved + cleared', (await inputs.nth(0).inputValue()) === '')
  txt = await page.innerText('main')
  check('recorder: "last" now shows the new value', txt.includes('Last: 0.5 sec'))

  // bad input
  await inputs.nth(2).fill('fast')
  await page.click('button[type=submit]')
  await page.waitForSelector('form [role=alert]')
  check('recorder: rejects non-numbers', (await page.innerText('form [role=alert]')).includes('not a valid number'))

  // profile shows new result in history + timeline
  await page.goto(`${BASE}/coach/athletes?q=${encodeURIComponent(firstName.split(' ')[0])}`)
  await page.locator('main a').first().click()
  await page.waitForURL(/\/coach\/athletes\//)
  txt = await page.innerText('main')
  check('profile: timeline has new assessment', txt.includes('10 Yard Sprint: 0.5'))
  check('profile: history has today\'s value', txt.includes('0.5 sec'))

  // group picker via tab
  await page.goto(`${BASE}/coach/assessments`)
  txt = await page.innerText('main')
  check('picker: today\'s sessions + levels', txt.includes("TODAY'S SESSIONS") || txt.includes("Today's sessions"))
  await page.click('a:has-text("Baseball Performance"):has-text("Level 2")')
  await page.waitForURL(/level=/)
  check('picker: level group loads athletes', (await page.locator('input[name^="v:"]').count()) > 0)
  check('no console errors (coach)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- parent cannot record
{
  const { browser, page } = await launch({ width: 390, height: 844 })
  await login(page, 'parent2@vegaselite.test')
  await page.goto(`${BASE}/coach/assessments`)
  check('parent blocked from recorder', path(page) === '/parent')
  await page.goto(`${BASE}/assessments`)
  check('parent blocked from owner assessments', path(page) === '/parent')
  await browser.close()
}
done()
