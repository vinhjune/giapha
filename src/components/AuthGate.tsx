import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { khoiTaoAuth, layToken, SCOPE_DRIVE } from '../services/googleAuth'
import { docFile } from '../services/googleDrive'
import LoginPage from '../pages/LoginPage'
import AdminSetup from './AdminSetup'
import type { AuthToken } from '../services/googleAuth'
import type { GiaphaData } from '../types/giapha'

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

const DEMO_DATA: GiaphaData = {
  metadata: {
    tenDongHo: 'Họ Nguyễn (Demo)',
    moTa: 'Dữ liệu mẫu để test giao diện',
    ngayTao: new Date().toISOString(),
    nguoiTao: 'demo@example.com',
    phienBan: 1,
    cheDoCong: true,
    danhSachNguoiDung: [{ email: 'demo@example.com', role: 'admin' }],
  },
  persons: {
    p1: { id: 'p1', hoTen: 'Nguyễn Văn Tổ', gioiTinh: 'nam', laThanhVienHo: true, namSinh: { nam: 1920 }, namMat: { nam: 1990 }, honNhan: [{ voChongId: 'p2' }], conCaiIds: ['p3', 'p4'], queQuan: 'Hà Nội' },
    p2: { id: 'p2', hoTen: 'Trần Thị Bà', gioiTinh: 'nu', laThanhVienHo: false, namSinh: { nam: 1925 }, namMat: { nam: 1995 }, honNhan: [{ voChongId: 'p1' }], conCaiIds: ['p3', 'p4'] },
    p3: { id: 'p3', hoTen: 'Nguyễn Văn Con Cả', gioiTinh: 'nam', laThanhVienHo: true, namSinh: { nam: 1950 }, boId: 'p1', meId: 'p2', honNhan: [{ voChongId: 'p5' }], conCaiIds: ['p6', 'p7'], thuTuAnhChi: 1 },
    p4: { id: 'p4', hoTen: 'Nguyễn Thị Con Hai', gioiTinh: 'nu', laThanhVienHo: true, namSinh: { nam: 1953 }, boId: 'p1', meId: 'p2', honNhan: [], conCaiIds: [], thuTuAnhChi: 2 },
    p5: { id: 'p5', hoTen: 'Lê Thị Dâu', gioiTinh: 'nu', laThanhVienHo: false, namSinh: { nam: 1952 }, honNhan: [{ voChongId: 'p3' }], conCaiIds: ['p6', 'p7'] },
    p6: { id: 'p6', hoTen: 'Nguyễn Văn Cháu', gioiTinh: 'nam', laThanhVienHo: true, namSinh: { nam: 1978 }, boId: 'p3', meId: 'p5', honNhan: [], conCaiIds: [], thuTuAnhChi: 1 },
    p7: { id: 'p7', hoTen: 'Nguyễn Thị Cháu', gioiTinh: 'nu', laThanhVienHo: true, namSinh: { nam: 1981 }, boId: 'p3', meId: 'p5', honNhan: [], conCaiIds: [], thuTuAnhChi: 2 },
  },
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
    function handleDemo() {
      setData(DEMO_DATA)
      setUser('demo@example.com', 'admin')
      setPublicMode(true)
    }

    return (
      <LoginPage
        publicModeAvailable={data?.metadata.cheDoCong ?? false}
        onPublicMode={() => { setPublicMode(true); setUser('', 'public') }}
        onDemo={!clientId ? handleDemo : undefined}
      />
    )
  }

  if (!fileId) {
    return <AdminSetup />
  }

  return <>{children}</>
}
