import { WorkerMailer } from 'worker-mailer'

export interface MailerEnv {
  GMAIL_USER: string
  GMAIL_APP_PASSWORD: string
}

/**
 * Sends a plain-text email via Gmail SMTP (using an App Password, not OAuth2) over the
 * Cloudflare Workers TCP socket API. Kept behind this small abstraction so the sending
 * mechanism (Gmail SMTP today, Resend or another provider once a custom domain exists) can be
 * swapped without touching call sites.
 */
export async function sendMail(env: MailerEnv, to: string, subject: string, text: string): Promise<void> {
  await WorkerMailer.send(
    {
      credentials: { username: env.GMAIL_USER, password: env.GMAIL_APP_PASSWORD },
      authType: 'plain',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    },
    {
      from: { name: 'Gia phả họ Hoàng', email: env.GMAIL_USER },
      to: { email: to },
      subject,
      text,
    },
  )
}
