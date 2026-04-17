import { useState } from 'react'
import { khoiTaoFile } from '../services/googleDrive'
import { useGiaphaStore } from '../store/useGiaphaStore'

export default function AdminSetup() {
  const { setFileId } = useGiaphaStore()
  const [loading, setLoading] = useState(false)
  const [fileId, setFileIdLocal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const id = await khoiTaoFile()
      setFileIdLocal(id)
      setFileId(id)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Thiết lập gia phả lần đầu</h2>
        <p className="text-sm text-gray-500 mb-6">
          Nhấn nút bên dưới để tạo thư mục <code>giapha/</code> và file <code>giapha.json</code> trên Google Drive của bạn.
        </p>

        {fileId ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-medium text-sm mb-2">✅ Đã tạo thành công!</p>
            <p className="text-sm text-gray-600 mb-2">File ID:</p>
            <code className="block text-xs bg-gray-100 px-3 py-2 rounded break-all">{fileId}</code>
            <p className="text-xs text-gray-500 mt-3">
              Lưu File ID này vào GitHub Actions secret <code>VITE_GIAPHA_FILE_ID</code> rồi chạy lại workflow deploy.
            </p>
          </div>
        ) : (
          <button onClick={handleCreate} disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tạo...' : 'Tạo file gia phả trên Drive'}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
