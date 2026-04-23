// Google Identity Services (GIS) token flow
// Docs: https://developers.google.com/identity/oauth2/web/guides/use-token-model

declare const google: any

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'
export const SCOPE_DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly'

export interface AuthToken {
  access_token: string
  expires_in: number
  expiresAt: number  // Date.now() + expires_in * 1000
}

let tokenClient: any = null
let currentToken: AuthToken | null = null

const STORAGE_KEY = 'giapha_auth_token'

function luuToken(token: AuthToken): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(token))
  } catch {}
}

function xoaTokenLuu(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000  // Treat token as expired 1 min early to avoid race conditions

/** Restore a previously saved token from localStorage.
 *  Returns the token if it is still valid, otherwise returns null and removes stale data. */
export function khoiPhucToken(): AuthToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const token = JSON.parse(raw) as AuthToken
    if (Date.now() >= token.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      xoaTokenLuu()
      return null
    }
    currentToken = token
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
      luuToken(currentToken)
      callback(currentToken)
    },
  })
}

export function dangNhap() {
  if (!tokenClient) throw new Error('Auth chưa được khởi tạo')
  tokenClient.requestAccessToken({ prompt: '' })
}

export function dangXuat() {
  if (currentToken) {
    google.accounts.oauth2.revoke(currentToken.access_token, () => {})
    currentToken = null
  }
  xoaTokenLuu()
}

export function layToken(): AuthToken | null {
  return currentToken
}

export function tokenConHan(): boolean {
  if (!currentToken) return false
  return Date.now() < currentToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS
}

export function layAccessToken(): string | null {
  if (!tokenConHan()) return null
  return currentToken!.access_token
}
