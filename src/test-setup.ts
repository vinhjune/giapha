import '@testing-library/jest-dom'
import { vi } from 'vitest'

function createMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Default every test to the desktop layout (no mobile media query match) so
// existing tests keep exercising the desktop UI unless a test explicitly
// opts into mobile via mockMatchMedia(true).
window.matchMedia = createMatchMedia(false) as unknown as typeof window.matchMedia

export function mockMatchMedia(matches: boolean) {
  window.matchMedia = createMatchMedia(matches) as unknown as typeof window.matchMedia
}
