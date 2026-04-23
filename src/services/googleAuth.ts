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
