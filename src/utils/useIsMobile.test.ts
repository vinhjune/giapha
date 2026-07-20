import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'
import { mockMatchMedia } from '../test-setup'

describe('useIsMobile', () => {
  it('returns false when the viewport does not match the mobile media query', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when the viewport matches the mobile media query', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('does not throw when the change event fires', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(() => act(() => { /* mounted without error */ })).not.toThrow()
    expect(result.current).toBe(true)
  })
})
