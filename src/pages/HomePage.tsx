import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import MemberManagementView from '../components/MemberManagementView'
import PersonForm from '../components/PersonForm'
import CyclicRelationshipBanner from '../components/CyclicRelationshipBanner'
import BottomTabBar from '../components/BottomTabBar'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useIsMobile } from '../utils/useIsMobile'

export default function HomePage() {
  const { viewMode, data, selectedPersonId, selectPerson } = useGiaphaStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const isMobile = useIsMobile()

  // Clicking a person card in Tree/List selects them; that alone opens the edit
  // modal directly, skipping the old view-only detail panel step.
  const editPerson = !isAddOpen && selectedPersonId && data ? data.persons[selectedPersonId] ?? null : null
  const formOpen = isAddOpen || !!editPerson

  function openAdd() {
    setIsAddOpen(true)
  }

  function closeForm() {
    setIsAddOpen(false)
    if (selectedPersonId) selectPerson(null)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Navbar />
      <CyclicRelationshipBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'list' && <ListView />}
        {viewMode === 'members' && <MemberManagementView />}
      </div>

      {isMobile && <BottomTabBar onAddClick={openAdd} />}

      {viewMode !== 'members' && (
        <button
          onClick={openAdd}
          className="hidden sm:flex fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-2xl items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {formOpen && (
        <PersonForm key={editPerson?.id ?? 'new'} editPerson={editPerson} onClose={closeForm} />
      )}
    </div>
  )
}
