import { dangNhap } from '../services/googleAuth'
import { dangNhapZalo } from '../services/zaloAuth'

interface Props {
  publicModeAvailable: boolean
  onPublicMode: () => void | Promise<void>
  onDemo?: () => void
  zaloAppId?: string
}

export default function LoginPage({ publicModeAvailable, onPublicMode, onDemo, zaloAppId }: Props) {
  function handleGoogleLogin() {
    try {
      dangNhap()
    } catch (e: unknown) {
      alert('Lỗi đăng nhập: ' + (e as Error).message)
    }
  }

  async function handleZaloLogin() {
    if (!zaloAppId) return
    try {
      await dangNhapZalo(zaloAppId)
    } catch (e: unknown) {
      alert('Lỗi đăng nhập Zalo: ' + (e as Error).message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🏮</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gia Phả</h1>
        <p className="text-gray-500 text-sm mb-8">Quản lý cây gia phả dòng họ</p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span className="text-sm font-medium text-gray-700">Đăng nhập bằng Google</span>
        </button>

        {zaloAppId && (
          <button
            onClick={() => { void handleZaloLogin() }}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors mb-3"
          >
            <span className="text-lg leading-none font-bold text-blue-600">Z</span>
            <span className="text-sm font-medium text-blue-700">Đăng nhập bằng Zalo</span>
          </button>
        )}

        {publicModeAvailable && (
          <button onClick={onPublicMode} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
            Chỉ xem
          </button>
        )}

        {onDemo && (
          <button
            onClick={onDemo}
            className="w-full py-2 text-sm text-orange-500 hover:text-orange-700 border-t border-gray-100 mt-2 pt-4"
          >
            🧪 Dùng thử với dữ liệu mẫu (Demo)
          </button>
        )}
      </div>
    </div>
  )
}
