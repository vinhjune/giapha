import { create } from 'zustand'
import type { GiaphaData, Person } from '../types/giapha'
import * as api from '../services/api'
import { taoCanhBaoQuanHeVongLap } from '../utils/familyTree'

export type ViewMode = 'tree' | 'list' | 'members'

const HIEN_THI_THU_TU_DOI_KEY = 'giaphaHienThiThuTuDoi'

function docHienThiThuTuDoi(): boolean {
  try {
    const saved = localStorage.getItem(HIEN_THI_THU_TU_DOI_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

interface GiaphaState {
  data: GiaphaData | null
  loading: boolean
  error: string | null
  viewMode: ViewMode
  selectedPersonId: string | null
  focusedPersonId: string | null
  cyclicRelationshipWarnings: string[]
  hienThiThuTuDoi: boolean

  loadData: () => Promise<void>
  setViewMode: (mode: ViewMode) => void
  selectPerson: (id: string | null) => void
  focusPerson: (id: string | null) => void
  toggleGenerationOrder: () => void
  dismissCyclicRelationshipWarnings: () => void

  themNguoi: (person: Omit<Person, 'id'>) => Promise<string>
  suaNguoi: (id: string, updates: Omit<Person, 'id'>) => Promise<void>
  xoaNguoi: (id: string) => Promise<void>
}

export const useGiaphaStore = create<GiaphaState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  viewMode: 'list',
  selectedPersonId: null,
  focusedPersonId: null,
  cyclicRelationshipWarnings: [],
  hienThiThuTuDoi: docHienThiThuTuDoi(),

  loadData: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.getTree()
      set({ data, loading: false, cyclicRelationshipWarnings: taoCanhBaoQuanHeVongLap(data) })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  selectPerson: (id) => set({ selectedPersonId: id, focusedPersonId: id }),
  focusPerson: (id) => set({ focusedPersonId: id }),
  toggleGenerationOrder: () => set(state => {
    const next = !state.hienThiThuTuDoi
    try { localStorage.setItem(HIEN_THI_THU_TU_DOI_KEY, String(next)) } catch { /* ignore */ }
    return { hienThiThuTuDoi: next }
  }),
  dismissCyclicRelationshipWarnings: () => set({ cyclicRelationshipWarnings: [] }),

  themNguoi: async (person) => {
    const { id } = await api.createPerson(person)
    await get().loadData()
    return id
  },

  suaNguoi: async (id, updates) => {
    await api.updatePerson(id, updates)
    await get().loadData()
  },

  xoaNguoi: async (id) => {
    await api.deletePerson(id)
    await get().loadData()
  },
}))
