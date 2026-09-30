// Local SMTP sink for development/tests: accepts any mail on 127.0.0.1:2525 and stores it as JSON
// in /tmp/academyos-mail (newest file = latest message). Never delivers anything.
import { SMTPServer } from 'smtp-server'
import { simpleParser } from 'mailparser'
import fs from 'node:fs'

const DIR = process.env.MAIL_DIR || '/tmp/academyos-mail'
fs.mkdirSync(DIR, { recursive: true })
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, _session, cb) {
    simpleParser(stream).then((m) => {
      const msg = { to: m.to?.text, from: m.from?.text, subject: m.subject, text: m.text, html: m.html, at: new Date().toISOString() }
      fs.writeFileSync(`${DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`, JSON.stringify(msg, null, 2))
      cb()
    }, cb)
  },
})
server.listen(Number(process.env.SMTP_PORT || 2525), '127.0.0.1', () => console.log('dev SMTP sink on :2525 ->', DIR))
