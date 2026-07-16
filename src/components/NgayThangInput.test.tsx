import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import NgayThangInput from './NgayThangInput'
import type { NgayThang } from '../types/giapha'

// Wraps NgayThangInput with real local state so interactions compose like a real
// parent (MemberManagementView/PersonForm) that feeds the emitted value back in as
// the next `value` prop. A bare onChange spy alone can't exercise multi-step flows
// since the component is fully controlled.
function Controlled({ initial, onChange }: { initial: NgayThang | undefined; onChange: (v: NgayThang | undefined) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <NgayThangInput
      value={value}
      onChange={v => { setValue(v); onChange(v) }}
      testIdPrefix="d"
    />
  )
}

function renderInput(value: NgayThang | undefined, onChange = vi.fn()) {
  render(<Controlled initial={value} onChange={onChange} />)
  return {
    onChange,
    date: screen.getByTestId('d-date') as HTMLInputElement,
    amLich: screen.getByTestId('d-amLich') as HTMLInputElement,
  }
}

function typeDigits(input: HTMLInputElement, digits: string) {
  for (const digit of digits) {
    fireEvent.keyDown(input, { key: digit })
  }
}

describe('NgayThangInput', () => {
  it('shows the __/__/____ mask when empty', () => {
    const { date } = renderInput(undefined)
    expect(date.value).toBe('__/__/____')
  })

  it('typing 2 digits fills the day segment and auto-advances to month', () => {
    const { date } = renderInput(undefined)
    typeDigits(date, '12')
    expect(date.value).toBe('12/__/____')
  })

  it('typing digits fills day, then month, then year in sequence', () => {
    const { date } = renderInput(undefined)
    typeDigits(date, '03071954')
    expect(date.value).toBe('03/07/1954')
  })

  it('backspace on an empty month segment moves back to the day segment without deleting it', () => {
    const { date } = renderInput(undefined)
    typeDigits(date, '12')
    fireEvent.keyDown(date, { key: 'Backspace' })
    expect(date.value).toBe('12/__/____')
    fireEvent.keyDown(date, { key: 'Backspace' })
    expect(date.value).toBe('1_/__/____')
  })

  it('ArrowRight jumps to the year segment, skipping day and month entirely', () => {
    const onChange = vi.fn()
    const { date } = renderInput(undefined, onChange)
    fireEvent.keyDown(date, { key: 'ArrowRight' })
    fireEvent.keyDown(date, { key: 'ArrowRight' })
    typeDigits(date, '1990')
    expect(date.value).toBe('__/__/1990')
    expect(onChange).toHaveBeenLastCalledWith({ ngay: undefined, thang: undefined, nam: 1990, amLich: undefined })
  })

  it('checking ÂL with no date parts filled does not emit a value', () => {
    const onChange = vi.fn()
    const { amLich } = renderInput(undefined, onChange)
    fireEvent.click(amLich)
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('checking ÂL after entering a year emits amLich: true', () => {
    const onChange = vi.fn()
    const { date, amLich } = renderInput(undefined, onChange)
    fireEvent.keyDown(date, { key: 'ArrowRight' })
    fireEvent.keyDown(date, { key: 'ArrowRight' })
    typeDigits(date, '1990')
    fireEvent.click(amLich)
    expect(onChange).toHaveBeenLastCalledWith({ ngay: undefined, thang: undefined, nam: 1990, amLich: true })
  })

  it('non-digit keys are ignored', () => {
    const { date } = renderInput(undefined)
    fireEvent.keyDown(date, { key: 'a' })
    expect(date.value).toBe('__/__/____')
  })

  it('pre-fills the mask and checkbox from an existing partial + lunar value', () => {
    const { date, amLich } = renderInput({ ngay: 3, thang: 7, nam: 1954, amLich: true })
    expect(date.value).toBe('03/07/1954')
    expect(amLich.checked).toBe(true)
  })

  it('pre-fills only the year on a year-only value', () => {
    const { date } = renderInput({ nam: 2001 })
    expect(date.value).toBe('__/__/2001')
  })
})
