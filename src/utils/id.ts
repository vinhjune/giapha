export function taoId(prefix = 'p'): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let suffix = ''
  while (suffix.length < 5) {
    const v = globalThis.crypto.getRandomValues(new Uint8Array(1))[0]
    if (v >= 252) continue // reject to avoid modulo bias
    suffix += chars[v % 36]
  }
  return `${prefix}_${Date.now().toString(36)}_${suffix}`
}
