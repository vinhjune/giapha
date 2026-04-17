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
    // ── Đời 1: Ông Bà Tổ ──────────────────────────────────────────────────────
    p1: { id: 'p1', hoTen: 'Nguyễn Văn Tổ', gioiTinh: 'nam', laThanhVienHo: true,
          namSinh: { nam: 1920 }, namMat: { nam: 1990 }, queQuan: 'Hà Nội',
          honNhan: [{ voChongId: 'p2' }], conCaiIds: ['p3', 'p4', 'p15'] },
    p2: { id: 'p2', hoTen: 'Trần Thị Bà Tổ', gioiTinh: 'nu', laThanhVienHo: false,
          namSinh: { nam: 1925 }, namMat: { nam: 1998 },
          honNhan: [{ voChongId: 'p1' }], conCaiIds: ['p3', 'p4', 'p15'] },

    // ── Đời 2: Con cái của ông bà tổ ──────────────────────────────────────────
    // p3: Nam, 3 vợ
    p3: { id: 'p3', hoTen: 'Nguyễn Văn Con Cả', gioiTinh: 'nam', laThanhVienHo: true,
          namSinh: { nam: 1948 }, boId: 'p1', meId: 'p2', thuTuAnhChi: 1,
          honNhan: [{ voChongId: 'p5' }, { voChongId: 'p8' }, { voChongId: 'p10' }],
          conCaiIds: ['p6', 'p7', 'p9', 'p11'] },

    // p4: Nữ trong họ, lấy chồng, đẻ con
    p4: { id: 'p4', hoTen: 'Nguyễn Thị Con Hai', gioiTinh: 'nu', laThanhVienHo: true,
          namSinh: { nam: 1951 }, boId: 'p1', meId: 'p2', thuTuAnhChi: 2,
          honNhan: [{ voChongId: 'p12' }],
          conCaiIds: ['p13', 'p14'] },

    // p15: Nữ trong họ, 3 chồng
    p15: { id: 'p15', hoTen: 'Nguyễn Thị Con Ba', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1955 }, boId: 'p1', meId: 'p2', thuTuAnhChi: 3,
           honNhan: [{ voChongId: 'p16' }, { voChongId: 'p18' }, { voChongId: 'p21' }],
           conCaiIds: ['p17', 'p19', 'p20', 'p22'] },

    // ── Vợ của p3 ─────────────────────────────────────────────────────────────
    p5:  { id: 'p5',  hoTen: 'Lê Thị Dâu Cả', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1950 }, namMat: { nam: 1980 },
           honNhan: [{ voChongId: 'p3' }], conCaiIds: ['p6', 'p7'] },
    p8:  { id: 'p8',  hoTen: 'Phạm Thị Dâu Hai', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1958 },
           honNhan: [{ voChongId: 'p3' }], conCaiIds: ['p9'] },
    p10: { id: 'p10', hoTen: 'Hoàng Thị Dâu Ba', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1965 },
           honNhan: [{ voChongId: 'p3' }], conCaiIds: ['p11'] },

    // ── Con của p3 ────────────────────────────────────────────────────────────
    p6:  { id: 'p6',  hoTen: 'Nguyễn Văn Cháu Một', gioiTinh: 'nam', laThanhVienHo: true,
           namSinh: { nam: 1975 }, boId: 'p3', meId: 'p5', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    p7:  { id: 'p7',  hoTen: 'Nguyễn Thị Cháu Hai', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1978 }, boId: 'p3', meId: 'p5', thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },
    p9:  { id: 'p9',  hoTen: 'Nguyễn Văn Cháu Ba', gioiTinh: 'nam', laThanhVienHo: true,
           namSinh: { nam: 1985 }, boId: 'p3', meId: 'p8', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    p11: { id: 'p11', hoTen: 'Nguyễn Thị Cháu Tư', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1992 }, boId: 'p3', meId: 'p10', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },

    // ── Chồng của p4 & con ────────────────────────────────────────────────────
    p12: { id: 'p12', hoTen: 'Võ Văn Rể', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1949 },
           honNhan: [{ voChongId: 'p4' }], conCaiIds: ['p13', 'p14'] },
    p13: { id: 'p13', hoTen: 'Võ Thị Ngoại Một', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1976 }, boId: 'p12', meId: 'p4', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    p14: { id: 'p14', hoTen: 'Võ Văn Ngoại Hai', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1979 }, boId: 'p12', meId: 'p4', thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },

    // ── Chồng của p15 & con ───────────────────────────────────────────────────
    p16: { id: 'p16', hoTen: 'Đinh Văn Chồng Một', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1953 }, namMat: { nam: 1985 },
           honNhan: [{ voChongId: 'p15' }], conCaiIds: ['p17'] },
    p17: { id: 'p17', hoTen: 'Đinh Văn Con Một', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1978 }, boId: 'p16', meId: 'p15', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    p18: { id: 'p18', hoTen: 'Đỗ Văn Chồng Hai', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1957 }, namMat: { nam: 1995 },
           honNhan: [{ voChongId: 'p15' }], conCaiIds: ['p19', 'p20'] },
    p19: { id: 'p19', hoTen: 'Đỗ Thị Con Hai', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1982 }, boId: 'p18', meId: 'p15', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    p20: { id: 'p20', hoTen: 'Đỗ Văn Con Ba', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1985 }, boId: 'p18', meId: 'p15', thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },
    p21: { id: 'p21', hoTen: 'Bùi Văn Chồng Ba', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1960 },
           honNhan: [{ voChongId: 'p15' }], conCaiIds: ['p22'] },
    p22: { id: 'p22', hoTen: 'Bùi Thị Con Bốn', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1990 }, boId: 'p21', meId: 'p15', thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
  },
}

export default function AuthGate({ children }: Props) {
  const { data, fileId, setData, setUser, setFileId } = useGiaphaStore()
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
        if (!token) return

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
      })
      // khoiTaoAuth only initialises the token client; callback fires on login
      setLoading(false)
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
      setFileId('demo-file-id')
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
