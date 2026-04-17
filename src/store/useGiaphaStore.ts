import { create } from 'zustand'
import type { GiaphaData, Person, Role } from '../types/giapha'
import { taoId } from '../utils/id'
import { taoSoftLock } from '../utils/conflict'

export type ViewMode = 'tree' | 'list'

interface GiaphaState {
  data: GiaphaData | null
  fileId: string | null
  currentUserEmail: string | null
  currentRole: Role | 'public'
  viewMode: ViewMode
  selectedPersonId: string | null
  isDirty: boolean
  isSaving: boolean
  conflictDetected: boolean

  // Actions
  setData: (data: GiaphaData) => void
  setFileId: (id: string) => void
  setUser: (email: string, role: Role | 'public') => void
  setViewMode: (mode: ViewMode) => void
  selectPerson: (id: string | null) => void

  themNguoi: (person: Omit<Person, 'id'>) => string
  suaNguoi: (id: string, updates: Partial<Person>) => void
  xoaNguoi: (id: string) => void

  setIsSaving: (v: boolean) => void
  setConflictDetected: (v: boolean) => void
  markSaved: () => void

  acquireSoftLock: () => void
  releaseSoftLock: () => void
}

export const useGiaphaStore = create<GiaphaState>((set, get) => ({
  data: null,
  fileId: import.meta.env.VITE_GIAPHA_FILE_ID || null,
  currentUserEmail: null,
  currentRole: 'public',
  viewMode: 'tree',
  selectedPersonId: null,
  isDirty: false,
  isSaving: false,
  conflictDetected: false,

  setData: (data) => set({ data, isDirty: false }),
  setFileId: (id) => set({ fileId: id }),
  setUser: (email, role) => set({ currentUserEmail: email, currentRole: role }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectPerson: (id) => set({ selectedPersonId: id }),

  themNguoi: (personData) => {
    const id = taoId()
    const person: Person = { id, ...personData }
    set(state => {
      if (!state.data) return {}
      return {
        data: {
          ...state.data,
          persons: { ...state.data.persons, [id]: person },
        },
        isDirty: true,
      }
    })
    return id
  },

  suaNguoi: (id, updates) => {
    set(state => {
      if (!state.data) return {}
      const existing = state.data.persons[id]
      if (!existing) return {}
      return {
        data: {
          ...state.data,
          persons: { ...state.data.persons, [id]: { ...existing, ...updates } },
        },
        isDirty: true,
      }
    })
  },

  xoaNguoi: (id) => {
    set(state => {
      if (!state.data) return {}
      const persons = { ...state.data.persons }
      delete persons[id]
      // Clean up references in all remaining persons
      Object.values(persons).forEach(p => {
        if (p.boId === id) p.boId = undefined
        if (p.meId === id) p.meId = undefined
        p.conCaiIds = p.conCaiIds.filter(c => c !== id)
        p.honNhan = p.honNhan.filter(h => h.voChongId !== id)
      })
      return { data: { ...state.data, persons }, isDirty: true }
    })
  },

  setIsSaving: (v) => set({ isSaving: v }),
  setConflictDetected: (v) => set({ conflictDetected: v }),
  markSaved: () => set(state => ({
    isDirty: false,
    data: state.data
      ? { ...state.data, metadata: { ...state.data.metadata, phienBan: state.data.metadata.phienBan + 1 } }
      : null,
  })),

  acquireSoftLock: () => {
    const { data, currentUserEmail } = get()
    if (!data || !currentUserEmail) return
    set(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, dangChinhSua: taoSoftLock(currentUserEmail, currentUserEmail) },
      } : null,
    }))
  },

  releaseSoftLock: () => {
    set(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, dangChinhSua: undefined },
      } : null,
    }))
  },
}))
