import { useState } from 'react'
import { khoiTaoFile } from '../services/googleDrive'
import { useGiaphaStore } from '../store/useGiaphaStore'

export default function AdminSetup() {
  const { currentUserEmail, setFileId, setData } = useGiaphaStore()
  const [tenDongHo, setTenDongHo] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!tenDongHo.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { id, data } = await khoiTaoFile(tenDongHo.trim(), currentUserEmail ?? '')
      setFileId(id)
      setData(data)
      setDone(true)
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
          Nhập tên dòng họ rồi nhấn Tạo — hệ thống sẽ tạo file <code>giapha.json</code> trên Google Drive của bạn.
        </p>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-medium text-sm">✅ Thiết lập hoàn tất! Đang chuyển vào ứng dụng...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Tên dòng họ *</label>
              <input
                autoFocus
                value={tenDongHo}
                onChange={e => setTenDongHo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Ví dụ: Họ Nguyễn Văn"
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <button onClick={handleCreate} disabled={loading || !tenDongHo.trim()}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Đang tạo...' : 'Tạo file gia phả trên Drive'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
