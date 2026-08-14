import type { AuthUser } from './lib/session'

export type Bindings = {
  giapha_db: D1Database
  giapha_avatars: R2Bucket
  /** Gmail address used as the SMTP sender for "forgot password" emails. */
  GMAIL_USER: string
  /** Gmail App Password (not the account password) for SMTP auth. */
  GMAIL_APP_PASSWORD: string
}

export type HonoEnv = {
  Bindings: Bindings
  Variables: {
    user: AuthUser | null
  }
}
