import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewToggle from './ViewToggle'
import { useGiaphaStore } from '../store/useGiaphaStore'

describe('ViewToggle', () => {
  beforeEach(() => {
    useGiaphaStore.setState({ viewMode: 'tree' })
  })

  it('marks the current view mode as the selected tab', () => {
    render(<ViewToggle />)
    expect(screen.getByRole('tab', { name: 'Cây gia phả' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches to list view when the "Danh sách" tab is clicked', async () => {
    const user = userEvent.setup()
    render(<ViewToggle />)
    await user.click(screen.getByRole('tab', { name: 'Danh sách' }))
    expect(useGiaphaStore.getState().viewMode).toBe('list')
  })

  it('switches back to tree view when the "Cây gia phả" tab is clicked', async () => {
    useGiaphaStore.setState({ viewMode: 'list' })
    const user = userEvent.setup()
    render(<ViewToggle />)
    await user.click(screen.getByRole('tab', { name: 'Cây gia phả' }))
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })
})
