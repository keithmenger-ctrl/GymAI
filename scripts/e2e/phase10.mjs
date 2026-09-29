// Owner dashboard.
import { launch, login, check, done } from './lib.mjs'

const { browser, page, errors } = await launch({ width: 1366, height: 900 })
await login(page, 'owner@vegaselite.test')
const txt = await page.innerText('main')
check('today stats', ['SESSIONS TODAY', 'ATHLETES SCHEDULED', 'ATTENDANCE TODAY', 'COACHES WORKING'].every((t) => txt.toUpperCase().includes(t)))
check('today: 3 coaches working', /COACHES WORKING\s*3/i.test(txt))
check("today's sessions list", txt.includes("Today's sessions") && txt.includes('Coach Keith'))
check('program capacity per level', txt.includes('Program capacity') && txt.includes('Youth Speed Development') && /\d+\/\d+/.test(txt))
check('athlete activity', txt.includes('Active') && txt.includes('New this month'))
check('disengaging athletes (14+ days) listed', /attended in 14\+ days \(\d+\)/.test(txt) && /\d+ days/.test(txt))
check('reassessment due', txt.includes('Due for reassessment'))
check('finance: MRR + past due', txt.includes('Monthly recurring revenue') && txt.includes('past due'))
check('MRR is a dollar amount', /\$[\d,]+/.test(txt))
await page.screenshot({ path: '/tmp/shot-dashboard.png', fullPage: true })

// links go somewhere real
await page.click('a:has-text("Schedule →")')
await page.waitForURL('**/schedule')
check('panel link to schedule works', true)
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300))
await browser.close()
done()
