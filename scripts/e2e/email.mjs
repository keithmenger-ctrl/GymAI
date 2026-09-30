// Forgot password + emailed invites, using the local SMTP sink (scripts/dev-smtp.mjs -> /tmp/academyos-mail).
import { launch, login, check, done, BASE } from './lib.mjs'
import fs from 'node:fs'

const DIR = process.env.MAIL_DIR || '/tmp/academyos-mail'
const mailbox = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).sort() : [])
async function waitMail(to, after, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    for (const f of mailbox().filter((x) => !after.includes(x))) {
      const m = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'))
      if (m.to?.includes(to)) return m
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}
const linkIn = (m) => m?.text?.match(/https?:\/\/\S+\/auth\/confirm\?\S+/)?.[0]
const path = (p) => new URL(p.url()).pathname

// ---------- forgot password (parent2)
{
  const { browser, page, errors } = await launch({ width: 390, height: 844 })
  await page.goto(`${BASE}/login`)
  await page.click('a:text("Forgot password?")')
  await page.waitForURL('**/forgot-password')
  const seen = mailbox()
  await page.fill('input[name=email]', 'parent5@vegaselite.test')
  await page.click('button[type=submit]')
  await page.waitForSelector('[role=status]')
  const generic = await page.innerText('[role=status]')
  check('generic confirmation shown', generic.includes('If that email has an AcademyOS account'))
  const mail = await waitMail('parent5@vegaselite.test', seen)
  check('reset email delivered', Boolean(mail) && mail.subject === 'Reset your AcademyOS password')
  const link = linkIn(mail)
  check('email link uses APP_URL + token_hash', Boolean(link) && link.startsWith('http://localhost:3000/auth/confirm?token_hash='))
  check('html version has a button', mail?.html?.includes('Choose a new password'))

  // unknown email: same message, no mail
  const seen2 = mailbox()
  await page.goto(`${BASE}/forgot-password`)
  await page.fill('input[name=email]', `nobody${Date.now()}@example.com`)
  await page.click('button[type=submit]')
  await page.waitForSelector('[role=status]')
  check('unknown email: identical response (no account enumeration)', (await page.innerText('[role=status]')) === generic)
  await page.waitForTimeout(1500)
  check('unknown email: nothing sent', mailbox().length === seen2.length)

  // follow the link, set a new password, sign in with it
  await page.goto(link)
  await page.waitForURL('**/set-password')
  await page.fill('input[name=password]', 'a-brand-new-pass')
  await Promise.all([page.waitForURL('**/parent'), page.click('button[type=submit]')])
  check('link signs in and new password is set', path(page) === '/parent')
  const p2 = await (await browser.newContext()).newPage()
  await p2.goto(link)
  await p2.waitForURL('**/login**')
  check('used link rejected with a friendly message', (await p2.innerText('main')).includes('expired or was already used'))
  await p2.goto(`${BASE}/login`)
  await p2.fill('input[name=email]', 'parent5@vegaselite.test')
  await p2.fill('input[name=password]', 'a-brand-new-pass')
  await Promise.all([p2.waitForURL('**/parent'), p2.click('button[type=submit]')])
  check('can sign in with the new password', path(p2) === '/parent')
  check('no console errors (reset)', errors.length === 0, errors.join(' | ').slice(0, 300))
  await browser.close()
}

// ---------- emailed coach invite
{
  const { browser, page } = await launch()
  await login(page, 'owner@vegaselite.test')
  await page.goto(`${BASE}/coaches`)
  const stamp = Date.now().toString().slice(-6)
  const email = `coach${stamp}@example.com`
  await page.fill('form:has(button:text("Add coach")) input[name=name]', `Coach Mail${stamp}`)
  await page.fill('form:has(button:text("Add coach")) input[name=email]', email)
  await page.click('button:text("Add coach")')
  await page.waitForSelector(`text=Coach Mail${stamp} added`)
  const seen = mailbox()
  const card = page.locator(`div.rounded-xl:has(button:has-text("Give app access")):has-text("Coach Mail${stamp}")`).first()
  await card.locator('button:has-text("Give app access")').click()
  await card.locator('text=Emailed to').waitFor()
  check('UI confirms the email was sent', true)
  const mail = await waitMail(email, seen)
  check('invite email delivered with org name', mail?.subject === "You're invited to Vegas Elite Performance on AcademyOS")
  const shown = await card.locator('input[aria-label="Invite link"]').inputValue()
  check('emailed link == link shown to owner (one token)', linkIn(mail) === shown)
  const p2 = await (await browser.newContext()).newPage()
  await p2.goto(linkIn(mail))
  await p2.waitForURL('**/set-password')
  await p2.fill('input[name=password]', 'coach-pass-123')
  await Promise.all([p2.waitForURL('**/coach/today'), p2.click('button[type=submit]')])
  check('invited coach lands in coach app', path(p2) === '/coach/today')
  await browser.close()
}
done()
