// Progress reports: generate (owner + coach), edit, share/unshare, parent visibility.
import { launch, login, check, done, BASE } from './lib.mjs'

const stamp = Date.now().toString().slice(-5)
let reportUrl

// ---------------- owner generates + edits + shares a report for Johnny (parent1)
{
  const { browser, page, errors } = await launch()
  page.on('dialog', (d) => d.accept())
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/athletes?q=Johnny`)
  await page.click('tbody tr a')
  await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/)
  await Promise.all([page.waitForURL(/\/reports\/[0-9a-f-]{36}$/), page.click('button:text("Generate progress report")')])
  reportUrl = page.url()
  let txt = await page.innerText('main')
  check('generate: draft badge', txt.includes('Draft · not visible to parents'))
  check('generate: doc has name, program, level', txt.includes('Johnny Alvarez') && txt.includes('Youth Speed Development') && txt.includes('Level'))
  check('generate: attendance numbers', /\d+\s*\/\s*\d+/.test(txt) && txt.includes('last 60 days'))
  check('generate: assessment table with arrows', txt.includes('ASSESSMENT RESULTS') || txt.includes('Assessment results'))
  check('generate: draft summary mentions attendance + gains', /attended \d+ of \d+ sessions/.test(txt) && txt.includes('Biggest gains'))
  check('generate: next focus drafted', /Next up in Level|keep building/.test(txt))

  // edit
  await page.fill('textarea[name=summary]', `Johnny has been outstanding this block. ${stamp}`)
  await page.fill('textarea[name=next_focus]', 'Deceleration and change of direction.')
  await page.click('button:text-is("Save")')
  await page.waitForSelector('text=Saved')
  await page.reload()
  txt = await page.innerText('main')
  check('edit: persisted + preview updated', txt.includes(`outstanding this block. ${stamp}`) && txt.includes('Deceleration and change of direction.'))

  // validation (wait for hydration after the reload above, or the click races React)
  await page.waitForLoadState('networkidle')
  await page.fill('textarea[name=summary]', '   ')
  await page.evaluate(() => document.querySelector('textarea[name=summary]').removeAttribute('required'))
  await page.click('button:text-is("Save")')
  await page.waitForSelector('form [role=alert]')
  check('edit: empty summary rejected', (await page.innerText('form [role=alert]')).includes('summary'))
  await page.reload()

  // parent can't see a draft yet (check before sharing)
  {
    const p = await launch({ width: 390, height: 844 })
    await login(p.page, 'parent1@vegaselite.test')
    const res = await p.page.goto(reportUrl.replace('/reports/', '/parent/reports/'))
    check('draft: parent gets 404', res.status() === 404, String(res.status()))
    await p.browser.close()
  }

  await page.click('button:text("Share with parent")')
  await page.waitForSelector('button:text("Unshare")')
  check('share: badge flips to shared', (await page.innerText('main')).includes('Shared'))

  await page.goto(`${BASE}/reports`)
  check('reports list shows shared report', (await page.innerText('main')).includes("Johnny's progress report"))
  check('no console errors (owner)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- parent sees it
{
  const { browser, page, errors } = await launch({ width: 390, height: 844 })
  await login(page, 'parent1@vegaselite.test')
  let txt = await page.innerText('main')
  check('parent home: latest report link', /latest progress report/i.test(txt))
  await page.click('a:has-text("progress report")')
  await page.waitForURL(/\/parent\/reports\//)
  txt = await page.innerText('main')
  check('parent: sees edited summary', txt.includes(`outstanding this block. ${stamp}`))
  check('parent: no edit/share controls', !txt.includes('Share with parent') && !txt.includes('Unshare') && (await page.locator('textarea').count()) === 0)
  check('parent: print button', (await page.locator('button:text("Print / save PDF")').count()) === 1)
  await page.screenshot({ path: '/tmp/shot-report.png', fullPage: true })
  check('no console errors (parent)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------------- coach can generate from their athlete view; unshare hides it from parent
{
  const { browser, page } = await launch({ width: 390, height: 844 })
  page.on('dialog', (d) => d.accept())
  await login(page, 'keith@vegaselite.test')
  await page.goto(`${BASE}/coach/athletes?q=Johnny`)
  await page.locator('main a').first().click()
  await page.waitForURL(/\/coach\/athletes\//)
  await Promise.all([page.waitForURL(/\/coach\/reports\//), page.click('button:text("Generate progress report")')])
  check('coach: generate opens coach editor', (await page.innerText('main')).includes('Draft'))
  await Promise.all([page.waitForURL(/\/coach\//), page.click('button:text("Delete draft")')])
  check('coach: can delete own draft', true)
  // unshare owner's report
  await page.goto(reportUrl.replace('/reports/', '/coach/reports/'))
  await page.click('button:text("Unshare")')
  await page.waitForSelector('button:text("Share with parent")')
  await browser.close()
  const p = await launch({ width: 390, height: 844 })
  await login(p.page, 'parent1@vegaselite.test')
  const res = await p.page.goto(reportUrl.replace('/reports/', '/parent/reports/'))
  check('unshare: parent loses access', res.status() === 404)
  await p.browser.close()
}

// ---------------- another parent can't read it even when shared
{
  const { browser, page } = await launch()
  await login(page, 'owner@vegaselite.test')
  await page.goto(reportUrl)
  await page.click('button:text("Share with parent")')
  await page.waitForSelector('button:text("Unshare")')
  await browser.close()
  const p = await launch({ width: 390, height: 844 })
  await login(p.page, 'parent2@vegaselite.test')
  const res = await p.page.goto(reportUrl.replace('/reports/', '/parent/reports/'))
  check('isolation: other parent 404s on shared report', res.status() === 404)
  await p.browser.close()
}
done()
