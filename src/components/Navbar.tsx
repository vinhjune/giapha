import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchBar from './SearchBar'
import CsvImportModal from './CsvImportModal'
import SettingsPanel from './SettingsPanel'
import { ghiFile } from '../services/googleDrive'

export default function Navbar() {
  const { data, fileId, isDirty, isSaving, currentRole, currentUserEmail, viewMode, setViewMode, setIsSaving, markSaved, setConflictDetected } = useGiaphaStore()
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function handleSave() {
    if (!data || !fileId) return
    setIsSaving(true)
    try {
      await ghiFile(fileId, data)
      markSaved()
    } catch (e: unknown) {
      const err = e as Error
      if (err.message.includes('412') || err.message.includes('conflict')) {
        setConflictDetected(true)
      } else {
        alert('Lưu thất bại: ' + err.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = currentRole === 'admin' || currentRole === 'editor'

  return (
    <>
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      <h1 className="text-lg font-bold text-red-700 mr-4">
        {data?.metadata.tenDongHo || 'Gia Phả'}
      </h1>

      <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
        <button
          onClick={() => setViewMode('tree')}
          className={`px-3 py-1 text-sm rounded ${viewMode === 'tree' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'}`}
        >
          Cây
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'}`}
        >
          Danh sách
        </button>
      </div>

      <SearchBar />

      <div className="ml-auto flex items-center gap-3">
        {currentRole === 'admin' && (
          <button
            onClick={() => setCsvModalOpen(true)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Nhập CSV
          </button>
        )}
        {canEdit && isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        )}
        {currentUserEmail && (
          <span className="text-sm text-gray-600">{currentUserEmail}</span>
        )}
        {currentRole === 'admin' && (
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
            title="Cài đặt"
          >
            ⚙️
          </button>
        )}
      </div>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </nav>

    {csvModalOpen && <CsvImportModal onClose={() => setCsvModalOpen(false)} />}
    </>
  )
}
