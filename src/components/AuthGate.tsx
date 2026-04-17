import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { khoiTaoAuth, layToken, SCOPE_DRIVE } from '../services/googleAuth'
import { docFile } from '../services/googleDrive'
import LoginPage from '../pages/LoginPage'
import AdminSetup from './AdminSetup'
import type { AuthToken } from '../services/googleAuth'

interface Props {
  children: React.ReactNode
}

async function fetchUserEmail(token: AuthToken): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data.email || ''
}

export default function AuthGate({ children }: Props) {
  const { data, fileId, setData, setUser } = useGiaphaStore()
  const [loading, setLoading] = useState(true)
  const [publicMode, setPublicMode] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    // GIS script loads with async defer — wait for it before initializing
    if (!clientId) {
      setLoading(false)
      return
    }

    function initWhenReady() {
      if (typeof (window as any).google === 'undefined') {
        setTimeout(initWhenReady, 100)
        return
      }
      khoiTaoAuth(clientId, SCOPE_DRIVE, async (token) => {
        if (!token) { setLoading(false); return }

        try {
          const email = await fetchUserEmail(token)
          if (fileId) {
            const d = await docFile(fileId)
            setData(d)
            const user = d.metadata.danhSachNguoiDung.find(u => u.email === email)
            const role = user?.role || (d.metadata.nguoiTao === email ? 'admin' : 'viewer')
            setUser(email, role)
          }
        } catch {
          // ignore load errors — show login page
        }
        setLoading(false)
      })
    }

    initWhenReady()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Đang tải...</div>
      </div>
    )
  }

  if (!layToken() && !publicMode) {
    return (
      <LoginPage
        publicModeAvailable={data?.metadata.cheDoCong ?? false}
        onPublicMode={() => { setPublicMode(true); setUser('', 'public') }}
      />
    )
  }

  if (!fileId) {
    return <AdminSetup />
  }

  return <>{children}</>
}
