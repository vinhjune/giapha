import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { chiaSeCong, xoaChiaSeCong, ghiFile } from '../services/googleDrive'
import PermissionManager from './PermissionManager'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { data, fileId, currentRole, setData } = useGiaphaStore()
  const [toggling, setToggling] = useState(false)

  if (currentRole !== 'admin' || !data || !fileId) return null

  const isPublic = data.metadata.cheDoCong

  async function handleTogglePublic() {
    if (!data || !fileId) return
    setToggling(true)
    try {
      if (isPublic) {
        await xoaChiaSeCong(fileId)
      } else {
        await chiaSeCong(fileId)
      }
      const updated = {
        ...data,
        metadata: { ...data.metadata, cheDoCong: !isPublic },
      }
      await ghiFile(fileId, updated)
      setData(updated)
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-12 pr-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-80 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Cài đặt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Chế độ công khai</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cho phép xem gia phả mà không cần đăng nhập
              </p>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                isPublic ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {isPublic && (
            <p className="mt-2 text-xs text-green-600">✓ Bất kỳ ai có link đều có thể xem</p>
          )}
        </div>

        <PermissionManager />
      </div>
    </div>
  )
}
