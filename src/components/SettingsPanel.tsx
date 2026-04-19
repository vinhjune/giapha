import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { chiaSeCong, xoaChiaSeCong, ghiFile, docFileCong } from '../services/googleDrive'
import PermissionManager from './PermissionManager'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { data, fileId, currentRole, setData } = useGiaphaStore()
  const [toggling, setToggling] = useState(false)
  const [togglingGenerationOrder, setTogglingGenerationOrder] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [inheritedWarning, setInheritedWarning] = useState(false)

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY

  if (currentRole !== 'admin' || !data || !fileId) return null

  const isPublic = data.metadata.cheDoCong
  const showGenerationOrder = Boolean(data.metadata.hienThiThuTuDoi)

  async function handleTogglePublic() {
    if (!data || !fileId) return
    setToggling(true)
    setVerifyError(null)
    setInheritedWarning(false)
    try {
      if (isPublic) {
        const inherited = await xoaChiaSeCong(fileId)
        if (inherited) setInheritedWarning(true)
      } else {
        await chiaSeCong(fileId)

        // Verify the API key can actually read the file now
        if (apiKey) {
          try {
            await docFileCong(fileId, apiKey)
          } catch (e: unknown) {
            const msg = (e as Error).message
            setVerifyError(
              `Đã chia sẻ Drive nhưng đọc bằng API key thất bại:\n${msg}\n\n` +
              `Kiểm tra: (1) Drive API đã được bật trong Google Cloud Console chưa? ` +
              `(2) API key có bị giới hạn HTTP referrer không?`
            )
            // Still save cheDoCong=true since Drive sharing worked
          }
        }
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

  async function handleToggleGenerationOrder() {
    if (!data || !fileId) return
    setTogglingGenerationOrder(true)
    try {
      const updated = {
        ...data,
        metadata: { ...data.metadata, hienThiThuTuDoi: !showGenerationOrder },
      }
      await ghiFile(fileId, updated)
      setData(updated)
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
    } finally {
      setTogglingGenerationOrder(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-12 pr-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-[26rem] max-h-[80vh] overflow-y-auto">
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
          {isPublic && !verifyError && !inheritedWarning && (
            <p className="mt-2 text-xs text-green-600">✓ Bất kỳ ai có link đều có thể xem</p>
          )}
          {inheritedWarning && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠️ Quyền công khai được thừa kế từ thư mục cha — không thể tắt qua API.
              Hãy vào <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="underline">Google Drive</a> và tắt chia sẻ cho thư mục <code>giapha</code> thủ công.
            </p>
          )}
          {verifyError && (
            <p className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{verifyError}</p>
          )}
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Hiển thị thứ tự đời</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Hiển thị tên theo dạng "Họ tên (#đời)"
              </p>
            </div>
            <button
              onClick={handleToggleGenerationOrder}
              disabled={togglingGenerationOrder}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                showGenerationOrder ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  showGenerationOrder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <PermissionManager />
      </div>
    </div>
  )
}
