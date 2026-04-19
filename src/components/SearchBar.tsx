import { useState, useCallback, useRef, useEffect } from 'react'
import { timKiemTheoTen } from '../utils/search'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchResults from './SearchResults'
import type { Person } from '../types/giapha'

export default function SearchBar() {
  const data = useGiaphaStore(s => s.data)
  const focusPerson = useGiaphaStore(s => s.focusPerson)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!data || !val.trim()) { setResults([]); setOpen(false); return }
    const found = timKiemTheoTen(val, data)
    setResults(found)
    if (found.length === 1) {
      focusPerson(found[0].id)
      setQuery('')
      setOpen(false)
    } else {
      setOpen(found.length > 0)
    }
  }, [data, focusPerson])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative w-64">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Tìm kiếm theo tên..."
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {open && <SearchResults results={results} onSelect={id => { focusPerson(id); setQuery(''); setOpen(false) }} />}
    </div>
  )
}
