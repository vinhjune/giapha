export function taoId(prefix = 'p'): string {
  const max5Base36 = 36 ** 5
  const rand = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % max5Base36
  return `${prefix}_${Date.now().toString(36)}_${rand.toString(36).padStart(5, '0')}`
}
