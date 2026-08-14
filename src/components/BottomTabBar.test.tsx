import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomTabBar from './BottomTabBar'
import { useGiaphaStore } from '../store/useGiaphaStore'

describe('BottomTabBar', () => {
  beforeEach(() => {
    useGiaphaStore.setState({ viewMode: 'tree' })
  })

  it('switches to Danh sách when tapped', async () => {
    const user = userEvent.setup()
    render(<BottomTabBar onAddClick={() => {}} canAdd={true} />)

    await user.click(screen.getByRole('button', { name: 'Danh sách' }))
    expect(useGiaphaStore.getState().viewMode).toBe('list')
  })

  it('switches back to Cây when tapped', async () => {
    useGiaphaStore.setState({ viewMode: 'list' })
    const user = userEvent.setup()
    render(<BottomTabBar onAddClick={() => {}} canAdd={true} />)

    await user.click(screen.getByRole('button', { name: 'Cây' }))
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('calls onAddClick when "Thêm mới" is tapped, without changing viewMode', async () => {
    const user = userEvent.setup()
    const onAddClick = vi.fn()
    render(<BottomTabBar onAddClick={onAddClick} canAdd={true} />)

    await user.click(screen.getByRole('button', { name: 'Thêm mới' }))
    expect(onAddClick).toHaveBeenCalledTimes(1)
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('marks Cây as current when active', () => {
    render(<BottomTabBar onAddClick={() => {}} canAdd={true} />)
    expect(screen.getByRole('button', { name: 'Cây' })).toHaveAttribute('aria-current', 'page')
  })

  it('hides "Thêm mới" when canAdd is false, so it never renders as a dead button', () => {
    render(<BottomTabBar onAddClick={() => {}} canAdd={false} />)
    expect(screen.queryByRole('button', { name: 'Thêm mới' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cây' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Danh sách' })).toBeInTheDocument()
  })
})
