import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import MemberManagementView from '../components/MemberManagementView'
import PersonDetail from '../components/PersonDetail'
import PersonForm from '../components/PersonForm'
import CyclicRelationshipBanner from '../components/CyclicRelationshipBanner'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

export default function HomePage() {
  const { viewMode } = useGiaphaStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)

  function openAdd() {
    setEditPerson(null)
    setFormOpen(true)
  }

  function openEdit(person: Person) {
    setEditPerson(person)
    setFormOpen(true)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <CyclicRelationshipBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'list' && <ListView />}
        {viewMode === 'members' && <MemberManagementView />}
        {viewMode !== 'members' && <PersonDetail onEdit={openEdit} />}
      </div>

      {viewMode !== 'members' && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-2xl flex items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {formOpen && (
        <PersonForm editPerson={editPerson} onClose={() => setFormOpen(false)} />
      )}
    </div>
  )
}
