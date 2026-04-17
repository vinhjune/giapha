export function taoId(prefix = 'p'): string {
  return `${prefix}_${Date.now().toString(36)}_${(Math.random() + 1).toString(36).slice(2, 7)}`
}
