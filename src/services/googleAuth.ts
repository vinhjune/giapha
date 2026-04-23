// Google Identity Services (GIS) token flow
// Docs: https://developers.google.com/identity/oauth2/web/guides/use-token-model

declare const google: any

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'
export const SCOPE_DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly'

const TOKEN_SESSION_KEY = 'giaphaGoogleToken'
export const LOGIN_PREF_KEY = 'giaphaLoginPref'

export interface AuthToken {
  access_token: string
  expires_in: number
  expiresAt: number  // Date.now() + expires_in * 1000
}

let tokenClient: any = null
let currentToken: AuthToken | null = null

function luuTokenVaoSession(token: AuthToken) {
  try {
    sessionStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify(token))
  } catch { /* ignore */ }
}

function khoiPhucTokenTuSession(): AuthToken | null {
  try {
    const saved = sessionStorage.getItem(TOKEN_SESSION_KEY)
    if (!saved) return null
    const token = JSON.parse(saved) as AuthToken
    if (Date.now() >= token.expiresAt - 60_000) {
      sessionStorage.removeItem(TOKEN_SESSION_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

export function khoiTaoAuth(
  clientId: string,
  scope: string,
  callback: (token: AuthToken | null, error?: string) => void
) {
  // Restore token from sessionStorage immediately (survives page refresh)
  const restored = khoiPhucTokenTuSession()
  if (restored) {
    currentToken = restored
    // Fire callback asynchronously so caller can finish setup first
    setTimeout(() => callback(restored), 0)
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: (response: any) => {
      if (response.error) {
        callback(null, response.error_description ?? response.error)
        return
      }
      currentToken = {
        access_token: response.access_token,
        expires_in: response.expires_in,
        expiresAt: Date.now() + response.expires_in * 1000,
      }
      luuTokenVaoSession(currentToken)
      localStorage.setItem(LOGIN_PREF_KEY, 'google')
      callback(currentToken)
    },
  })
}

export function dangNhap() {
  if (!tokenClient) throw new Error('Auth chưa được khởi tạo')
  tokenClient.requestAccessToken({ prompt: '' })
}

export function dangNhapNgoai() {
  if (!tokenClient) throw new Error('Auth chưa được khởi tạo')
  tokenClient.requestAccessToken({ prompt: 'select_account' })
}

export function dangXuat() {
  if (currentToken) {
    try {
      google.accounts.oauth2.revoke(currentToken.access_token, () => {})
    } catch { /* ignore */ }
    currentToken = null
  }
  try {
    sessionStorage.removeItem(TOKEN_SESSION_KEY)
    if (localStorage.getItem(LOGIN_PREF_KEY) === 'google') {
      localStorage.removeItem(LOGIN_PREF_KEY)
    }
  } catch { /* ignore */ }
}

export function layToken(): AuthToken | null {
  return currentToken
}

export function tokenConHan(): boolean {
  if (!currentToken) return false
  return Date.now() < currentToken.expiresAt - 60_000  // 1 min buffer
}

export function layAccessToken(): string | null {
  if (!tokenConHan()) return null
  return currentToken!.access_token
}
