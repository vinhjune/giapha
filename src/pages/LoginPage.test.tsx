import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  it('shows and handles "Chỉ xem" button when available', () => {
    const onPublicMode = vi.fn()
    render(
      <LoginPage publicModeAvailable onPublicMode={onPublicMode} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chỉ xem' }))
    expect(onPublicMode).toHaveBeenCalledTimes(1)
  })
})
