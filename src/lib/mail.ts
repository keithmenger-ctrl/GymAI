import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transactional email over SMTP (any provider: Resend, Postmark, SES, Gmail...).
 * Configure SMTP_URL (e.g. smtps://user:pass@smtp.resend.com:465) and MAIL_FROM.
 * When unset, email is off and the UI falls back to copy-paste links.
 */
export const mailEnabled = () => Boolean(process.env.SMTP_URL && process.env.MAIL_FROM)

let transport: Transporter | null = null

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (!mailEnabled()) return false
  transport ??= nodemailer.createTransport(process.env.SMTP_URL!)
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html })
  return true
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Minimal, client-safe HTML email: heading, paragraph, one button, fallback link. */
export function emailHtml(heading: string, body: string, cta: string, url: string) {
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0b0f14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e7e5e4;border-radius:12px"><tr><td style="padding:28px">
<p style="margin:0 0 20px;font-weight:600">Academy<span style="background:#d6f24a;padding:0 4px;border-radius:4px">OS</span></p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(heading)}</h1>
<p style="margin:0 0 24px;line-height:1.5;color:#374151">${esc(body)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#0b0f14;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(cta)}</a>
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">Or paste this link into your browser: ${esc(url)}<br>The link works once.</p>
</td></tr></table></td></tr></table></body></html>`
}
