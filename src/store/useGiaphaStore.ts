import { create } from 'zustand'
import type { GiaphaData, Person, Role } from '../types/giapha'
import { nextId } from '../utils/id'
import { taoSoftLock } from '../utils/conflict'

export type ViewMode = 'tree' | 'list'

interface GiaphaState {
  data: GiaphaData | null
  fileId: string | null
  currentUserEmail: string | null
  currentRole: Role | 'public'
  viewMode: ViewMode
  selectedPersonId: number | null
  isDirty: boolean
  isSaving: boolean
  conflictDetected: boolean

  // Actions
  setData: (data: GiaphaData) => void
  importData: (data: GiaphaData) => void
  setFileId: (id: string) => void
  setUser: (email: string, role: Role | 'public') => void
  setViewMode: (mode: ViewMode) => void
  selectPerson: (id: number | null) => void

  themNguoi: (person: Omit<Person, 'id'>) => number
  suaNguoi: (id: number, updates: Partial<Person>) => void
  xoaNguoi: (id: number) => void

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
  importData: (data) => set({ data, isDirty: true }),
  setFileId: (id) => set({ fileId: id }),
  setUser: (email, role) => set({ currentUserEmail: email, currentRole: role }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectPerson: (id) => set({ selectedPersonId: id }),

  themNguoi: (personData) => {
    const id = nextId(get().data?.persons ?? {})
    const person: Person = { id, ...personData }
    set(state => {
      if (!state.data) return {}
      const persons: Record<string, Person> = { ...state.data.persons, [id]: person }
      // Sync conCaiIds for both parents
      if (personData.boId && persons[personData.boId]) {
        const bo = persons[personData.boId]
        persons[personData.boId] = { ...bo, conCaiIds: [...bo.conCaiIds, id] }
      }
      if (personData.meId && persons[personData.meId]) {
        const me = persons[personData.meId]
        persons[personData.meId] = { ...me, conCaiIds: [...me.conCaiIds, id] }
      }
      return {
        data: { ...state.data, persons },
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
      // Rebuild any person that references the deleted id
      Object.keys(persons).forEach(pid => {
        const p = persons[pid]
        const needsUpdate = p.boId === id || p.meId === id ||
          p.conCaiIds.includes(id) || p.honNhan.some(h => h.voChongId === id)
        if (needsUpdate) {
          persons[pid] = {
            ...p,
            boId: p.boId === id ? undefined : p.boId,
            meId: p.meId === id ? undefined : p.meId,
            conCaiIds: p.conCaiIds.filter(c => c !== id),
            honNhan: p.honNhan.filter(h => h.voChongId !== id),
          }
        }
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
    if (!get().data || !get().currentUserEmail) return
    set(state => {
      if (!state.data || !state.currentUserEmail) return {}
      return {
        data: {
          ...state.data,
          metadata: {
            ...state.data.metadata,
            dangChinhSua: taoSoftLock(state.currentUserEmail, state.currentUserEmail),
          },
        },
      }
    })
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
