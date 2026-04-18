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
  selectedPersonId: number | null
  focusedPersonId: number | null
  isDirty: boolean
  isSaving: boolean
  conflictDetected: boolean

  // Actions
  setData: (data: GiaphaData) => void
  setFileId: (id: string) => void
  setUser: (email: string, role: Role | 'public') => void
  setViewMode: (mode: ViewMode) => void
  selectPerson: (id: number | null) => void
  focusPerson: (id: number | null) => void

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
  fileId: import.meta.env.VITE_GIAPHA_FILE_ID || localStorage.getItem('giaphaFileId') || null,
  currentUserEmail: null,
  currentRole: 'public',
  viewMode: 'tree',
  selectedPersonId: null,
  focusedPersonId: null,
  isDirty: false,
  isSaving: false,
  conflictDetected: false,

  setData: (data) => set({ data, isDirty: false }),
  setFileId: (id) => {
    localStorage.setItem('giaphaFileId', id)
    set({ fileId: id })
  },
  setUser: (email, role) => set({ currentUserEmail: email, currentRole: role }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectPerson: (id) => set({ selectedPersonId: id, focusedPersonId: id }),
  focusPerson: (id) => set({ focusedPersonId: id }),

  themNguoi: (personData) => {
    const id = taoId(get().data?.persons || {})
    const person: Person = { id, ...personData }
    set(state => {
      if (!state.data) return {}
      const persons: Record<number, Person> = { ...state.data.persons, [id]: person }
      // Sync spouse links (A -> B also means B -> A)
      person.honNhan.forEach(h => {
        const spouse = persons[h.voChongId]
        if (!spouse) return
        if (!spouse.honNhan.some(m => m.voChongId === id)) {
          persons[h.voChongId] = {
            ...spouse,
            honNhan: [...spouse.honNhan, { voChongId: id }],
          }
        }
      })
      // Sync conCaiIds for both parents
      if (personData.boId && persons[personData.boId]) {
        const bo = persons[personData.boId]
        persons[personData.boId] = {
          ...bo,
          conCaiIds: bo.conCaiIds.includes(id) ? bo.conCaiIds : [...bo.conCaiIds, id],
        }
      }
      if (personData.meId && persons[personData.meId]) {
        const me = persons[personData.meId]
        persons[personData.meId] = {
          ...me,
          conCaiIds: me.conCaiIds.includes(id) ? me.conCaiIds : [...me.conCaiIds, id],
        }
      }

      // Sync child->parent links when this new person is added as a parent of existing children
      personData.conCaiIds.forEach(childId => {
        const child = persons[childId]
        if (!child) return
        if (person.gioiTinh === 'nam' && child.boId !== id) {
          persons[childId] = { ...child, boId: id }
        }
        if (person.gioiTinh === 'nu' && child.meId !== id) {
          persons[childId] = { ...child, meId: id }
        }
      })
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
      const updated = { ...existing, ...updates }
      const persons: Record<number, Person> = { ...state.data.persons, [id]: updated }

      const oldSpouseIds = new Set(existing.honNhan.map(h => h.voChongId))
      const newSpouseIds = new Set(updated.honNhan.map(h => h.voChongId))
      const oldChildrenIds = new Set(existing.conCaiIds)
      const newChildrenIds = new Set(updated.conCaiIds)

      // Remove reverse spouse links that were removed from this person
      oldSpouseIds.forEach(spouseId => {
        if (newSpouseIds.has(spouseId)) return
        const spouse = persons[spouseId]
        if (!spouse) return
        persons[spouseId] = {
          ...spouse,
          honNhan: spouse.honNhan.filter(h => h.voChongId !== id),
        }
      })

      // Ensure reverse spouse links exist for current spouses
      newSpouseIds.forEach(spouseId => {
        const spouse = persons[spouseId]
        if (!spouse) return
        if (!spouse.honNhan.some(h => h.voChongId === id)) {
          persons[spouseId] = {
            ...spouse,
            honNhan: [...spouse.honNhan, { voChongId: id }],
          }
        }
      })

      // Sync this person's own parent links <-> parent.conCaiIds
      if (existing.boId && existing.boId !== updated.boId) {
        const oldBo = persons[existing.boId]
        if (oldBo) {
          persons[existing.boId] = {
            ...oldBo,
            conCaiIds: oldBo.conCaiIds.filter(childId => childId !== id),
          }
        }
      }
      if (existing.meId && existing.meId !== updated.meId) {
        const oldMe = persons[existing.meId]
        if (oldMe) {
          persons[existing.meId] = {
            ...oldMe,
            conCaiIds: oldMe.conCaiIds.filter(childId => childId !== id),
          }
        }
      }
      if (updated.boId) {
        const bo = persons[updated.boId]
        if (bo && !bo.conCaiIds.includes(id)) {
          persons[updated.boId] = {
            ...bo,
            conCaiIds: [...bo.conCaiIds, id],
          }
        }
      }
      if (updated.meId) {
        const me = persons[updated.meId]
        if (me && !me.conCaiIds.includes(id)) {
          persons[updated.meId] = {
            ...me,
            conCaiIds: [...me.conCaiIds, id],
          }
        }
      }

      // Sync this person's conCaiIds <-> child.boId/meId
      const oldParentKey = existing.gioiTinh === 'nam' ? 'boId' : existing.gioiTinh === 'nu' ? 'meId' : null
      const newParentKey = updated.gioiTinh === 'nam' ? 'boId' : updated.gioiTinh === 'nu' ? 'meId' : null

      oldChildrenIds.forEach(childId => {
        if (newChildrenIds.has(childId)) return
        if (!oldParentKey) return
        const child = persons[childId]
        if (!child || child[oldParentKey] !== id) return
        persons[childId] = { ...child, [oldParentKey]: undefined }
      })

      newChildrenIds.forEach(childId => {
        const child = persons[childId]
        if (!child || !newParentKey) return

        const nextChild: Person = { ...child, [newParentKey]: id }
        if (oldParentKey && oldParentKey !== newParentKey && nextChild[oldParentKey] === id) {
          nextChild[oldParentKey] = undefined
        }
        persons[childId] = nextChild
      })

      return {
        data: {
          ...state.data,
          persons,
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
      Object.values(persons).forEach(p => {
        const needsUpdate = p.boId === id || p.meId === id ||
          p.conCaiIds.includes(id) || p.honNhan.some(h => h.voChongId === id)
        if (needsUpdate) {
          persons[p.id] = {
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
