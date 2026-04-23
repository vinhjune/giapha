// Zalo OAuth 2.0 với PKCE — không cần backend
// Docs: https://developers.zalo.me/docs/api/social-api/tai-lieu/xac-thuc-va-uy-quyen-tai-khoan-zalo

export const LOGIN_PREF_KEY_ZALO = 'giaphaLoginPref'  // same key, value 'zalo'

const ZALO_TOKEN_SESSION_KEY = 'giaphaZaloToken'
const ZALO_CODE_VERIFIER_KEY = 'giaphaZaloCodeVerifier'
const ZALO_AUTH_ENDPOINT = 'https://oauth.zaloapp.com/v4/permission'
const ZALO_TOKEN_ENDPOINT = 'https://oauth.zaloapp.com/v4/access_token'
const ZALO_PROFILE_ENDPOINT =
  'https://graph.zalo.me/v2.0/me?fields=id,name,picture'

export interface ZaloToken {
  access_token: string
  refresh_token?: string
  expires_in: number
  expiresAt: number
}

export interface ZaloUser {
  id: string
  name: string
  picture?: { data: { url: string } }
}

let currentZaloToken: ZaloToken | null = null
let currentZaloUser: ZaloUser | null = null

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function randomBase64url(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function sha256Base64url(plain: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// ─── Session persistence ─────────────────────────────────────────────────────

function luuZaloToken(token: ZaloToken) {
  try {
    sessionStorage.setItem(ZALO_TOKEN_SESSION_KEY, JSON.stringify(token))
  } catch { /* ignore */ }
}

function khoiPhucZaloToken(): ZaloToken | null {
  try {
    const saved = sessionStorage.getItem(ZALO_TOKEN_SESSION_KEY)
    if (!saved) return null
    const token = JSON.parse(saved) as ZaloToken
    if (Date.now() >= token.expiresAt - 60_000) {
      sessionStorage.removeItem(ZALO_TOKEN_SESSION_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Bắt đầu luồng đăng nhập Zalo — chuyển hướng sang Zalo OAuth. */
export async function dangNhapZalo(appId: string) {
  const codeVerifier = randomBase64url(64)
  const codeChallenge = await sha256Base64url(codeVerifier)

  try {
    sessionStorage.setItem(ZALO_CODE_VERIFIER_KEY, codeVerifier)
  } catch { /* ignore */ }

  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname)
  const url =
    `${ZALO_AUTH_ENDPOINT}?app_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${redirectUri}` +
    `&code_challenge=${codeChallenge}`

  window.location.href = url
}

/**
 * Xử lý callback sau khi Zalo chuyển hướng về (URL chứa ?code=...).
 * Trả về ZaloUser nếu thành công, null nếu không có code.
 */
export async function xuLyCallbackZalo(
  appId: string
): Promise<ZaloUser | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null

  // Clean up URL
  const cleanUrl = window.location.pathname
  window.history.replaceState({}, '', cleanUrl)

  const codeVerifier = (() => {
    try { return sessionStorage.getItem(ZALO_CODE_VERIFIER_KEY) ?? '' } catch { return '' }
  })()

  try {
    sessionStorage.removeItem(ZALO_CODE_VERIFIER_KEY)
  } catch { /* ignore */ }

  const redirectUri = window.location.origin + window.location.pathname

  const body = new URLSearchParams({
    app_id: appId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const res = await fetch(ZALO_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zalo token exchange failed: ${text}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    error?: string
    message?: string
  }

  if (data.error) {
    throw new Error(data.message ?? data.error)
  }

  const token: ZaloToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  currentZaloToken = token
  luuZaloToken(token)
  localStorage.setItem('giaphaLoginPref', 'zalo')

  const user = await layThongTinNguoiDungZalo(token.access_token)
  currentZaloUser = user
  return user
}

/** Lấy token Zalo hiện tại (có thể null). */
export function layZaloToken(): ZaloToken | null {
  if (currentZaloToken && Date.now() < currentZaloToken.expiresAt - 60_000) {
    return currentZaloToken
  }
  const restored = khoiPhucZaloToken()
  if (restored) {
    currentZaloToken = restored
    return restored
  }
  return null
}

/** Lấy thông tin người dùng Zalo đang đăng nhập. */
export function layNguoiDungZalo(): ZaloUser | null {
  return currentZaloUser
}

/** Khôi phục phiên Zalo từ sessionStorage (dùng khi tải trang). */
export async function khoiPhucPhienZalo(): Promise<ZaloUser | null> {
  const token = khoiPhucZaloToken()
  if (!token) return null
  currentZaloToken = token
  try {
    const user = await layThongTinNguoiDungZalo(token.access_token)
    currentZaloUser = user
    return user
  } catch {
    dangXuatZalo()
    return null
  }
}

async function layThongTinNguoiDungZalo(accessToken: string): Promise<ZaloUser> {
  const res = await fetch(ZALO_PROFILE_ENDPOINT, {
    headers: { access_token: accessToken },
  })
  if (!res.ok) throw new Error('Không thể lấy thông tin người dùng Zalo')
  return res.json() as Promise<ZaloUser>
}

/** Đăng xuất khỏi Zalo — xoá token và trạng thái. */
export function dangXuatZalo() {
  currentZaloToken = null
  currentZaloUser = null
  try {
    sessionStorage.removeItem(ZALO_TOKEN_SESSION_KEY)
    if (localStorage.getItem('giaphaLoginPref') === 'zalo') {
      localStorage.removeItem('giaphaLoginPref')
    }
  } catch { /* ignore */ }
}
