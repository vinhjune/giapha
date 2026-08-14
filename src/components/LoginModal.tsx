import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

interface Props {
  onClose: () => void
}

export default function LoginModal({ onClose }: Props) {
  const { setupNeeded, loading, error, forgotPasswordMessage, login, setupFirstAdmin, forgotPassword, clearError } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login')
  const [forgotEmail, setForgotEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (setupNeeded) {
      await setupFirstAdmin(username, password, email)
    } else {
      await login(username, password)
    }
    if (!useAuthStore.getState().error) onClose()
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    await forgotPassword(forgotEmail)
  }

  if (mode === 'forgot-password') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quên mật khẩu</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
          </div>

          {forgotPasswordMessage ? (
            <p className="text-sm text-gray-700">{forgotPasswordMessage}</p>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="forgot-password-email" className="block text-sm text-gray-600 mb-1">Email đã đăng ký</label>
                <input
                  id="forgot-password-email"
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Gửi mật khẩu mới
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-sm text-blue-600 hover:underline self-start"
          >
            &larr; Quay lại đăng nhập
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {setupNeeded ? 'Tạo tài khoản Admin đầu tiên' : 'Đăng nhập'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="login-username" className="block text-sm text-gray-600 mb-1">Tên đăng nhập</label>
            <input
              id="login-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {setupNeeded && (
            <div>
              <label htmlFor="login-email" className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div>
            <label htmlFor="login-password" className="block text-sm text-gray-600 mb-1">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {!setupNeeded && (
            <button
              type="button"
              onClick={() => { clearError(); setMode('forgot-password') }}
              className="text-sm text-blue-600 hover:underline self-start"
            >
              Quên mật khẩu?
            </button>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {setupNeeded ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
