import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import PersonDetail from '../components/PersonDetail'
import PersonForm from '../components/PersonForm'
import ConflictBanner from '../components/ConflictBanner'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

export default function HomePage() {
  const { viewMode, currentRole } = useGiaphaStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)

  const canEdit = currentRole === 'admin' || currentRole === 'editor'

  function openAdd() {
    if (!canEdit) return
    setEditPerson(null)
    setFormOpen(true)
  }

  function openEdit(person: Person) {
    if (!canEdit) return
    setEditPerson(person)
    setFormOpen(true)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <ConflictBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' ? <TreeView /> : <ListView />}
        <PersonDetail onEdit={openEdit} />
      </div>

      {canEdit && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-2xl flex items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {canEdit && formOpen && (
        <PersonForm editPerson={editPerson} onClose={() => setFormOpen(false)} />
      )}
    </div>
  )
}
