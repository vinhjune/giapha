const ITERATIONS = 100_000
const HASH_ALGO = 'SHA-256'
const KEY_LENGTH_BITS = 256

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BITS,
  )
}

/** Hashes a plaintext password into the storable format `pbkdf2:<iterations>:<saltHex>:<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await deriveHash(password, salt, ITERATIONS)
  return `pbkdf2:${ITERATIONS}:${toHex(salt.buffer)}:${toHex(derived)}`
}

/** Verifies a plaintext password against a stored `pbkdf2:...` hash. Returns false on any format mismatch. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromHex(parts[2])
  const expectedHex = parts[3]
  const derived = await deriveHash(password, salt, iterations)
  const actualHex = toHex(derived)
  if (actualHex.length !== expectedHex.length) return false
  // Constant-time comparison to avoid timing side-channels.
  let diff = 0
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  return diff === 0
}
