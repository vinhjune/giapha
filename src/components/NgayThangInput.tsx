import { useEffect, useRef, useState } from 'react'
import type { NgayThang } from '../types/giapha'

interface Props {
  value: NgayThang | undefined
  onChange: (value: NgayThang | undefined) => void
  testIdPrefix?: string
}

type SegIdx = 0 | 1 | 2 // ngay, thang, nam
type Segs = [string, string, string]

const SEG_LEN: [number, number, number] = [2, 2, 4]
// Caret offset where each segment starts in the rendered "dd/mm/yyyy" mask.
const SEG_START: [number, number, number] = [0, 3, 6]

function segDisplay(digits: string, len: number): string {
  return digits.padEnd(len, '_')
}

function buildDisplay(segs: Segs): string {
  return `${segDisplay(segs[0], 2)}/${segDisplay(segs[1], 2)}/${segDisplay(segs[2], 4)}`
}

function segmentAtCaret(caret: number): SegIdx {
  if (caret <= 2) return 0
  if (caret <= 5) return 1
  return 2
}

// A freshly-loaded/reset value has no "in progress" digits, so it's safe (and
// necessary for the fixed-width mask) to zero-pad it for display.
function valueToSegs(value: NgayThang | undefined): Segs {
  return [
    value?.ngay != null ? String(value.ngay).padStart(2, '0') : '',
    value?.thang != null ? String(value.thang).padStart(2, '0') : '',
    value?.nam != null ? String(value.nam).padStart(4, '0') : '',
  ]
}

function segsToValue(segs: Segs, amLich: boolean): NgayThang | undefined {
  if (!segs[0] && !segs[1] && !segs[2]) return undefined
  return {
    ngay: segs[0] ? Number(segs[0]) : undefined,
    thang: segs[1] ? Number(segs[1]) : undefined,
    nam: segs[2] ? Number(segs[2]) : undefined,
    amLich: amLich || undefined,
  }
}

export default function NgayThangInput({ value, onChange, testIdPrefix }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeSegment, setActiveSegment] = useState<SegIdx>(0)
  const [caretTarget, setCaretTarget] = useState<number | null>(null)

  // Local editing buffer is the source of truth for display. NgayThang stores plain
  // numbers, so round-tripping every keystroke through the `value` prop would drop
  // leading zeros ("03" -> 3 -> "3") and break the fixed-width mask mid-typing.
  // Only resync from `value` when it changes for a reason other than our own last
  // emit (initial load, parent reset/undo) — see the effect below.
  const [segs, setSegs] = useState<Segs>(() => valueToSegs(value))
  const [amLich, setAmLich] = useState(value?.amLich ?? false)
  const lastEmitted = useRef<NgayThang | undefined>(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setSegs(valueToSegs(value))
      setAmLich(value?.amLich ?? false)
      lastEmitted.current = value
    }
  }, [value])

  useEffect(() => {
    if (caretTarget != null && inputRef.current) {
      inputRef.current.setSelectionRange(caretTarget, caretTarget)
      setCaretTarget(null)
    }
  }, [caretTarget])

  function commit(nextSegs: Segs, nextAmLich: boolean) {
    setSegs(nextSegs)
    setAmLich(nextAmLich)
    const next = segsToValue(nextSegs, nextAmLich)
    lastEmitted.current = next
    onChange(next)
  }

  function handleFocusOrClick(e: React.SyntheticEvent<HTMLInputElement>) {
    const caret = e.currentTarget.selectionStart ?? 0
    setActiveSegment(segmentAtCaret(caret))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const segIdx = activeSegment
      const maxLen = SEG_LEN[segIdx]
      const nextVal = (segs[segIdx] + e.key).slice(0, maxLen)
      const nextSegs: Segs = [...segs]
      nextSegs[segIdx] = nextVal
      commit(nextSegs, amLich)

      let nextActive = segIdx
      let caret = SEG_START[segIdx] + nextVal.length
      if (nextVal.length === maxLen && segIdx < 2) {
        nextActive = (segIdx + 1) as SegIdx
        caret = SEG_START[nextActive]
      }
      setActiveSegment(nextActive)
      setCaretTarget(caret)
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      const segIdx = activeSegment
      if (segs[segIdx].length > 0) {
        const nextVal = segs[segIdx].slice(0, -1)
        const nextSegs: Segs = [...segs]
        nextSegs[segIdx] = nextVal
        commit(nextSegs, amLich)
        setCaretTarget(SEG_START[segIdx] + nextVal.length)
      } else if (segIdx > 0) {
        const prevIdx = (segIdx - 1) as SegIdx
        setActiveSegment(prevIdx)
        setCaretTarget(SEG_START[prevIdx] + segs[prevIdx].length)
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIdx = Math.max(0, activeSegment - 1) as SegIdx
      setActiveSegment(prevIdx)
      setCaretTarget(SEG_START[prevIdx] + segs[prevIdx].length)
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIdx = Math.min(2, activeSegment + 1) as SegIdx
      setActiveSegment(nextIdx)
      setCaretTarget(SEG_START[nextIdx] + segs[nextIdx].length)
      return
    }

    // Block any other printable character — digits only, everything else (paste,
    // letters, symbols) is out of scope for this field.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
    }
  }

  function handleAmLichChange(checked: boolean) {
    commit(segs, checked)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={buildDisplay(segs)}
        onChange={() => {}}
        onClick={handleFocusOrClick}
        onFocus={handleFocusOrClick}
        onKeyDown={handleKeyDown}
        data-testid={testIdPrefix ? `${testIdPrefix}-date` : undefined}
        className="w-32 px-2 py-1 text-base sm:text-sm text-center tracking-wide font-mono rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={amLich}
          onChange={e => handleAmLichChange(e.target.checked)}
          data-testid={testIdPrefix ? `${testIdPrefix}-amLich` : undefined}
          className="h-3.5 w-3.5"
        />
        ÂL
      </label>
    </div>
  )
}
