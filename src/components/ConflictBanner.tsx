import { useGiaphaStore } from '../store/useGiaphaStore'
import { kiemTraSoftLock } from '../utils/conflict'

export default function ConflictBanner() {
  const { data, currentUserEmail, conflictDetected, setConflictDetected } = useGiaphaStore()

  const softLock = data?.metadata.dangChinhSua
  const activeLock = currentUserEmail ? kiemTraSoftLock(softLock, currentUserEmail) : null

  if (!activeLock && !conflictDetected) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center justify-between">
      {conflictDetected ? (
        <span>⚠️ Dữ liệu đã bị thay đổi từ thiết bị khác. Vui lòng tải lại trang để lấy bản mới nhất.</span>
      ) : activeLock ? (
        <span>🔒 <strong>{activeLock.hoTen}</strong> đang chỉnh sửa (từ {new Date(activeLock.thoiGian).toLocaleTimeString('vi-VN')})</span>
      ) : null}
      {conflictDetected && (
        <button onClick={() => { setConflictDetected(false); window.location.reload() }}
          className="ml-4 px-3 py-1 bg-yellow-200 rounded hover:bg-yellow-300">Tải lại</button>
      )}
    </div>
  )
}
