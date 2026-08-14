import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import PersonForm from '../components/PersonForm'
import PersonDetailPanel from '../components/PersonDetailPanel'
import CyclicRelationshipBanner from '../components/CyclicRelationshipBanner'
import BottomTabBar from '../components/BottomTabBar'
import ViewToggle from '../components/ViewToggle'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import { useIsMobile } from '../utils/useIsMobile'
import '../styles/gia-pha-theme.css'

export default function HomePage() {
  const { viewMode, data, selectedPersonId, selectPerson } = useGiaphaStore()
  const { user } = useAuthStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const isMobile = useIsMobile()
  const canEdit = user !== null

  const selectedPerson = selectedPersonId && data ? data.persons[selectedPersonId] ?? null : null
  // Logged-in admin/editor: clicking a person opens the editable PersonForm directly.
  // Anonymous/viewer: clicking a person opens a read-only detail panel instead.
  const editPerson = canEdit && !isAddOpen ? selectedPerson : null
  const readOnlyPerson = !canEdit ? selectedPerson : null
  const formOpen = isAddOpen || !!editPerson

  function openAdd() {
    if (!canEdit) return
    setIsAddOpen(true)
  }

  function closeForm() {
    setIsAddOpen(false)
    if (selectedPersonId) selectPerson(null)
  }

  return (
    <div className="gp-shell h-dvh flex flex-col overflow-hidden">
      <Navbar />
      <CyclicRelationshipBanner />

      {!isMobile && (
        <div className="px-4 py-3">
          <ViewToggle />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'list' && <ListView />}
      </div>

      {isMobile && <BottomTabBar onAddClick={openAdd} canAdd={canEdit} />}

      {canEdit && (
        <button
          onClick={openAdd}
          className="hidden sm:flex fixed bottom-6 right-6 w-12 h-12 bg-[#e2b95e] text-[#4a2c24] rounded-full shadow-lg hover:bg-[#f0cb78] text-2xl items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {formOpen && (
        <PersonForm key={editPerson?.id ?? 'new'} editPerson={editPerson} onClose={closeForm} />
      )}

      {readOnlyPerson && (
        <PersonDetailPanel person={readOnlyPerson} onClose={closeForm} />
      )}
    </div>
  )
}
