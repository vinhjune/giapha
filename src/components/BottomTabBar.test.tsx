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
    render(<BottomTabBar onAddClick={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Danh sách' }))
    expect(useGiaphaStore.getState().viewMode).toBe('list')
  })

  it('switches back to Cây when tapped', async () => {
    useGiaphaStore.setState({ viewMode: 'list' })
    const user = userEvent.setup()
    render(<BottomTabBar onAddClick={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cây' }))
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('calls onAddClick when "Thêm mới" is tapped, without changing viewMode', async () => {
    const user = userEvent.setup()
    const onAddClick = vi.fn()
    render(<BottomTabBar onAddClick={onAddClick} />)

    await user.click(screen.getByRole('button', { name: 'Thêm mới' }))
    expect(onAddClick).toHaveBeenCalledTimes(1)
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('marks Cây as current when active', () => {
    render(<BottomTabBar onAddClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cây' })).toHaveAttribute('aria-current', 'page')
  })

  it('highlights no tab while viewing Quản lý thành viên', () => {
    useGiaphaStore.setState({ viewMode: 'members' })
    render(<BottomTabBar onAddClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Cây' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Danh sách' })).not.toHaveAttribute('aria-current')
  })
})
