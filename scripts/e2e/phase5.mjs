// Sessions, enrollment, attendance, coach Today + session view.
import { launch, login, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname

// ---------------- coach on a phone
{
  const { browser, page, errors } = await launch({ width: 390, height: 844 })
  await login(page, 'keith@vegaselite.test')
  let txt = await page.innerText('main')
  check('today: lists Keith\'s sessions', txt.includes('Youth Speed Development') && txt.includes('Level 1 · Acceleration Mechanics') && txt.includes('Level 2 ·'))
  check('today: only own sessions', !txt.includes('Baseball Performance'))
  check('today: shows athlete counts', /\d+ athletes/.test(txt))
  await page.screenshot({ path: '/tmp/shot-today.png' })

  await page.locator('main a:has-text("Level 1 ·")').first().click()
  await page.waitForURL(/\/coach\/sessions\//)
  txt = await page.innerText('main')
  check('session: focus', txt.includes('Acceleration Mechanics'))
  check('session: numbered plan from curriculum', txt.includes('Wall drill') && txt.includes('Competitive sprint'))
  check('session: cues shown', txt.includes('Push the ground away'))
  const rows = await page.locator('[role=group][aria-label^="Attendance for"]').count()
  check('session: roster rendered', rows >= 5, String(rows))

  // tap-sized targets
  const box = await page.locator('[role=group] button').first().boundingBox()
  check('attendance buttons are >= 44px', box.width >= 44 && box.height >= 44, JSON.stringify(box))

  // mark first athlete present, second late, third absent
  const groups = page.locator('[role=group][aria-label^="Attendance for"]')
  // start from a clean slate (the test may have run earlier today)
  for (let i = 0; i < rows; i++) {
    const on = groups.nth(i).locator('button[aria-pressed=true]')
    if (await on.count()) { await on.click(); await page.waitForTimeout(300) }
  }
  await page.waitForTimeout(800)
  await page.reload()
  check('attendance: reset to unmarked', (await page.locator('[role=group] button[aria-pressed=true]').count()) === 0)
  await groups.nth(0).locator('button[aria-label=Present]').click()
  await groups.nth(1).locator('button[aria-label=Late]').click()
  await groups.nth(2).locator('button[aria-label=Absent]').click()
  await page.waitForTimeout(800)
  check('attendance: optimistic pressed state', (await groups.nth(0).locator('button[aria-label=Present]').getAttribute('aria-pressed')) === 'true')
  // tap again clears
  await groups.nth(2).locator('button[aria-label=Absent]').click()
  await page.waitForTimeout(800)
  await page.click('button:has-text("present")') // "Mark rest present"
  await page.waitForTimeout(1200)
  await page.reload()
  const pressed = await page.locator('[role=group] button[aria-pressed=true]').count()
  check('attendance: persisted after reload, everyone marked', pressed === rows, `${pressed}/${rows}`)
  check('attendance: late persisted', (await groups.nth(1).locator('button[aria-label=Late]').getAttribute('aria-pressed')) === 'true')
  check('attendance: cleared athlete then marked present by "rest"', (await groups.nth(2).locator('button[aria-label=Present]').getAttribute('aria-pressed')) === 'true')

  // athlete note (shareable)
  const athleteName = (await groups.nth(0).getAttribute('aria-label')).replace('Attendance for ', '')
  await page.locator('button[aria-label^="Add note for"]').first().click()
  await page.fill('li textarea[name=body]', 'Crushed the falling starts today')
  await page.check('li input[name=shareable]')
  await page.click('li button:has-text("Save note")')
  await page.waitForSelector('text=Note saved')
  // general note
  await page.fill('section textarea[name=body] >> nth=-1', 'Turf was wet, shortened sprints.')
  await page.click('button:has-text("Add session note")')
  await page.waitForSelector('text=Turf was wet')
  txt = await page.innerText('main')
  check('notes: athlete + general notes listed', txt.includes('Crushed the falling starts') && txt.includes('Turf was wet'))

  // back to today: attendance progress shows done
  await page.goto(`${BASE}/coach/today`)
  check('today: session shows attended count', /\d+\/\d+ attended/.test(await page.innerText('main')))

  // athlete profile reflects the note + attendance
  await page.goto(`${BASE}/coach/athletes?q=${encodeURIComponent(athleteName.split(' ')[0])}`)
  await page.locator('main a').first().click()
  await page.waitForURL(/\/coach\/athletes\//)
  txt = await page.innerText('main')
  check('profile: new note appears', txt.includes('Crushed the falling starts today'))
  check('profile: timeline shows note', txt.includes('Note'))

  // coach cannot reach owner schedule
  await page.goto(`${BASE}/schedule`)
  check('coach blocked from /schedule', path(page) === '/coach/today')
  check('no console errors (coach)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- owner
{
  const { browser, page, errors } = await launch()
  page.on('dialog', (d) => d.accept())
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/schedule`)
  let txt = await page.innerText('main')
  check('schedule: week view with Today badge', txt.includes('Today') && /\d+ sessions/.test(txt))
  check('schedule: shows coaches + capacity', txt.includes('Coach Keith') && /\d+\/\d+/.test(txt))
  await page.click('a[aria-label="Previous week"]')
  await page.waitForURL(/week=/)
  check('schedule: previous week has completed attendance', (await page.innerText('main')).includes('attended'))

  // create a session with curriculum -> plan/focus auto-filled, auto-enroll, repeat 2 weeks
  await page.goto(`${BASE}/schedule/new`)
  await page.selectOption('select[name=program_id]', { label: 'Youth Speed Development' })
  await page.selectOption('select[name=level_id]', { label: 'Level 2' })
  await page.selectOption('select[name=curriculum_item_id]', { index: 2 })
  await page.selectOption('select[name=coach_id]', { label: 'Coach Sarah' })
  await page.fill('input[name=start]', '07:00')
  await page.fill('input[name=end]', '08:00')
  await page.fill('input[name=max_athletes]', '5')
  await page.selectOption('select[name=repeat_weeks]', '2')
  await Promise.all([page.waitForURL(/\/schedule\/[0-9a-f-]{36}$/), page.click('button[type=submit]')])
  const newUrl = page.url()
  txt = await page.innerText('main')
  check('create: title + coach', txt.includes('Youth Speed Development · Level 2') && txt.includes('Coach Sarah') && txt.includes('7:00'))
  check('create: focus + plan from curriculum week 2', /Deceleration II/.test(txt) && txt.includes('Technique drill') && /curriculum week 2/i.test(txt))
  check('create: auto-enrolled up to max (5)', txt.includes('(5/5)'), txt.match(/\(\d+\/\d+\)/)?.[0])
  check('create: full session blocks enrolling', txt.includes('This session is full'))

  // end before start rejected
  await page.goto(`${BASE}/schedule/new`)
  await page.fill('input[name=start]', '10:00')
  await page.fill('input[name=end]', '09:00')
  await page.click('button[type=submit]')
  await page.waitForSelector('form [role=alert]')
  check('validation: end must be after start', (await page.innerText('form [role=alert]')).includes('End time'))

  // edit: raise capacity, then enroll someone from another level
  await page.goto(`${newUrl}/edit`)
  await page.fill('input[name=max_athletes]', '8')
  await Promise.all([page.waitForURL(newUrl), page.click('button[type=submit]')])
  await page.click('button:has-text("Enroll")')
  await page.waitForSelector('text=Enrolled')
  check('enroll: roster now 6', (await page.innerText('main')).includes('(6/8)'))
  // remove one
  await page.click('summary:has-text("Remove athletes")')
  await page.locator('details[open] form button').first().click()
  await page.waitForFunction(() => document.body.innerText.includes('(5/8)'))
  check('unenroll: roster back to 5', true)

  // owner can take attendance from the desktop session page too
  await page.locator('[role=group] button[aria-label=Present]').first().click()
  await page.waitForTimeout(700)
  await page.reload()
  check('owner: attendance saved', (await page.locator('[role=group] button[aria-pressed=true]').count()) === 1)

  // delete
  await page.click('button:has-text("Delete")')
  await page.waitForURL('**/schedule')
  check('delete: back on schedule', path(page) === '/schedule')

  // coaches page + coach invite
  await page.goto(`${BASE}/coaches`)
  txt = await page.innerText('main')
  check('coaches: lists seeded coaches with today counts', ['Coach Keith', 'Coach Mike', 'Coach Sarah'].every((n) => txt.includes(n)) && txt.includes('today'))
  const stamp = Date.now().toString().slice(-6)
  await page.fill('form:has(button:text("Add coach")) input[name=name]', `Coach Test${stamp}`)
  await page.fill('form:has(button:text("Add coach")) input[name=email]', `coach${stamp}@example.com`)
  await page.click('button:text("Add coach")')
  await page.waitForSelector(`text=Coach Test${stamp} added`)
  const card = page.locator(`div.rounded-xl:has(button:has-text("Give app access")):has-text("Coach Test${stamp}")`).first()
  await card.locator('button:has-text("Give app access")').click()
  const link = await card.locator('input[aria-label="Invite link"]').inputValue()
  const p2 = await (await browser.newContext()).newPage()
  await p2.goto(link)
  await p2.waitForURL('**/set-password')
  await p2.fill('input[name=password]', 'coach-secret-1')
  await Promise.all([p2.waitForURL('**/coach/today'), p2.click('button[type=submit]')])
  check('new coach signs in to coach Today', path(p2) === '/coach/today')
  check('new coach with no sessions sees empty state', (await p2.innerText('main')).includes('No sessions today'))
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}
done()
