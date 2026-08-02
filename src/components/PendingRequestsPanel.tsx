import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import * as api from '../services/api'
import type { EditorRequest } from '../types/giapha'

const TYPE_LABELS: Record<EditorRequest['type'], string> = {
  create: 'Thêm mới', update: 'Cập nhật', delete: 'Xóa',
}

function summarize(request: EditorRequest): string {
  if (request.type === 'delete') return `${TYPE_LABELS.delete} thành viên #${request.personId}`
  try {
    const payload = JSON.parse(request.payload ?? '{}') as { hoTen?: string }
    return `${TYPE_LABELS[request.type]}: ${payload.hoTen ?? '(không rõ tên)'}`
  } catch {
    return `${TYPE_LABELS[request.type]} thành viên`
  }
}

export default function PendingRequestsPanel() {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<EditorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { requests } = await api.listRequests()
      setRequests(requests)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleApprove(id: string) {
    await api.approveRequest(id)
    await refresh()
  }

  async function handleReject(id: string) {
    await api.rejectRequest(id)
    await refresh()
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-3">
        {isAdmin ? 'Yêu cầu chờ duyệt' : 'Yêu cầu của tôi'}
      </h2>
      {loading && <p className="text-sm text-gray-400">Đang tải…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && requests.length === 0 && <p className="text-sm text-gray-500">Không có yêu cầu nào.</p>}
      <ul className="space-y-2">
        {requests.map(request => (
          <li key={request.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-800">{summarize(request)}</p>
              <p className="text-xs text-gray-500">
                Trạng thái: {request.status === 'pending' ? 'Đang chờ' : request.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
              </p>
            </div>
            {isAdmin && request.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(request.id)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Duyệt
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Từ chối
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
