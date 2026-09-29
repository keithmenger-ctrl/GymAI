import { launch, login, check, done, BASE } from './lib.mjs'

const path = (p) => new URL(p.url()).pathname
const name = `Wrestling ${Date.now().toString().slice(-5)}`
const { browser, page, errors } = await launch()
page.on('dialog', (d) => d.accept())
await login(page, 'owner@vegaselite.test')

await page.goto(`${BASE}/programs`)
let txt = await page.innerText('main')
check('list: seeded programs', ['Youth Speed Development', 'Baseball Performance', 'General Athletic Development'].every((n) => txt.includes(n)))
check('list: shows level enrollment x / y', /\d+ \/ \d+/.test(txt))

// create program
await page.goto(`${BASE}/programs/new`)
await page.fill('input[name=name]', name)
await page.fill('textarea[name=description]', 'Takedowns and mat movement')
await Promise.all([page.waitForURL(/\/programs\/[0-9a-f-]{36}$/), page.click('button[type=submit]')])
const programUrl = page.url()
txt = await page.innerText('main')
check('create: program page with auto Level 1', txt.includes(name) && txt.includes('Level 1'))

// add level
await page.fill('input[placeholder="Level 2"]', 'Level 2')
await page.locator('form:has(input[placeholder="Level 2"]) input[name=capacity]').fill('10')
await page.locator('form:has(input[placeholder="Level 2"]) button[type=submit]').click()
await page.waitForSelector('h3:has-text("Level 2")')
check('level: added Level 2', true)
check('level: capacity shown', (await page.innerText('main')).includes('/ 10 athletes'))

// curriculum
await page.locator('a:has-text("Curriculum")').first().click()
await page.waitForURL(/\/levels\//)
const levelUrl = page.url()
check('curriculum: empty state', (await page.innerText('main')).includes('No curriculum yet'))
await page.fill('input[name=title]', 'Stance and Motion')
await page.fill('textarea[name=objectives]', 'Athlete holds a balanced stance')
await page.fill('textarea[name=drills]', '1. Warm-up\n- Level changes\nStance drill')
await page.fill('textarea[name=cues]', 'Hips low, head up')
await page.locator('form:has(input[name=title]) button[type=submit]').click()
await page.waitForSelector('h3:has-text("Stance and Motion")')
txt = await page.innerText('main')
check('curriculum: item saved', /week 1/i.test(txt) && txt.includes('Hips low, head up'))
check('curriculum: drills parsed into ordered list', (await page.locator('ol li').allInnerTexts()).join('|') === 'Warm-up|Level changes|Stance drill')
check('curriculum: next week defaults to 2', (await page.inputValue('form:has(button:text("Add week")) input[name=week_number]')) === '2')

// bad url validation
await page.fill('form:has(button:text("Add week")) input[name=title]', 'Bad video')
await page.evaluate(() => { const f = [...document.querySelectorAll('form')].find((x) => x.textContent.includes('Add week')); const i = f.querySelector('input[name=video_url]'); i.type = 'text'; i.value = 'nope' })
await page.click('button:text("Add week")')
await page.waitForSelector('form [role=alert]')
check('curriculum: invalid video URL rejected', (await page.locator('form [role=alert]').first().innerText()).toLowerCase().includes('url'))

// edit item
await page.locator('details summary:text("Edit")').first().click()
await page.locator('details[open] input[name=title]').fill('Stance & Motion II')
await page.locator('details[open] button[type=submit]').click()
await page.waitForSelector('[role=status]:has-text("Saved")')
await page.reload()
check('curriculum: edit persisted', (await page.innerText('main')).includes('Stance & Motion II'))

// delete item
await page.locator('button:text-is("Delete")').first().click()
await page.waitForSelector('text=No curriculum yet')
check('curriculum: item deleted', true)

// delete empty level 2
await page.goto(programUrl)
await page.locator('h3:has-text("Level 2") >> xpath=ancestor::div[contains(@class,"rounded-xl")]//a[text()="Curriculum"]').click()
await page.waitForURL(/\/levels\//)
await page.click('button:text("Delete level")')
await page.waitForURL(programUrl)
check('level: empty level deleted', !(await page.innerText('main')).includes('Level 2'))

// level with athletes cannot be deleted
await page.goto(`${BASE}/programs`)
await page.locator('a:has-text("Youth Speed Development")').click()
await page.locator('a:text("Curriculum")').first().click()
await page.waitForURL(/\/levels\//)
check('level: delete disabled while athletes enrolled', await page.locator('button:text("Delete level")').isDisabled())
check('seeded Speed L1 curriculum has 4 weeks + drills', (await page.locator('h3').count()) >= 4 && (await page.innerText('main')).includes('Falling starts'))

// program edit + archive
await page.goto(programUrl)
await page.locator('form:has(button:text("Save changes")) input[name=name]').fill(`${name} Renamed`)
await page.click('button:text("Save changes")')
await page.waitForSelector('[role=status]:has-text("Saved")')
await page.click('button:text("Archive")')
await page.waitForSelector('button:text("Restore")')
check('program: renamed + archived', (await page.innerText('main')).includes('Renamed'))
await page.goto(`${BASE}/athletes/new`)
check('archived program hidden from athlete form', !(await page.locator('select[name=program_id]').innerText()).includes('Renamed'))

// coach blocked
{
  const c = await launch({ width: 390, height: 844 })
  await login(c.page, 'keith@vegaselite.test')
  await c.page.goto(`${BASE}/programs`)
  check('coach cannot open programs', path(c.page) === '/coach/today', path(c.page))
  await c.browser.close()
}
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
done()
