import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { khoiTaoAuth, layToken, SCOPE_DRIVE } from '../services/googleAuth'
import { docFile, docFileCong } from '../services/googleDrive'
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
    1: { id: 1, hoTen: 'Nguyễn Văn Tổ', gioiTinh: 'nam', laThanhVienHo: true,
          namSinh: { nam: 1920 }, namMat: { nam: 1990 }, queQuan: 'Hà Nội',
          honNhan: [{ voChongId: 2 }], conCaiIds: [3, 4, 15] },
    2: { id: 2, hoTen: 'Trần Thị Bà Tổ', gioiTinh: 'nu', laThanhVienHo: false,
          namSinh: { nam: 1925 }, namMat: { nam: 1998 },
          honNhan: [{ voChongId: 1 }], conCaiIds: [3, 4, 15] },

    // ── Đời 2: Con cái của ông bà tổ ──────────────────────────────────────────
    // 3: Nam, 3 vợ
    3: { id: 3, hoTen: 'Nguyễn Văn Con Cả', gioiTinh: 'nam', laThanhVienHo: true,
          namSinh: { nam: 1948 }, boId: 1, meId: 2, thuTuAnhChi: 1,
          honNhan: [{ voChongId: 5 }, { voChongId: 8 }, { voChongId: 10 }],
          conCaiIds: [6, 7, 9, 11] },

    // 4: Nữ trong họ, lấy chồng, đẻ con
    4: { id: 4, hoTen: 'Nguyễn Thị Con Hai', gioiTinh: 'nu', laThanhVienHo: true,
          namSinh: { nam: 1951 }, boId: 1, meId: 2, thuTuAnhChi: 2,
          honNhan: [{ voChongId: 12 }],
          conCaiIds: [13, 14] },

    // 15: Nữ trong họ, 3 chồng
    15: { id: 15, hoTen: 'Nguyễn Thị Con Ba', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1955 }, boId: 1, meId: 2, thuTuAnhChi: 3,
           honNhan: [{ voChongId: 16 }, { voChongId: 18 }, { voChongId: 21 }],
           conCaiIds: [17, 19, 20, 22] },

    // ── Vợ của p3 ─────────────────────────────────────────────────────────────
    5:  { id: 5,  hoTen: 'Lê Thị Dâu Cả', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1950 }, namMat: { nam: 1980 },
           honNhan: [{ voChongId: 3 }], conCaiIds: [6, 7] },
    8:  { id: 8,  hoTen: 'Phạm Thị Dâu Hai', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1958 },
           honNhan: [{ voChongId: 3 }], conCaiIds: [9] },
    10: { id: 10, hoTen: 'Hoàng Thị Dâu Ba', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1965 },
           honNhan: [{ voChongId: 3 }], conCaiIds: [11] },

    // ── Con của p3 ────────────────────────────────────────────────────────────
    6:  { id: 6,  hoTen: 'Nguyễn Văn Cháu Một', gioiTinh: 'nam', laThanhVienHo: true,
           namSinh: { nam: 1975 }, boId: 3, meId: 5, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    7:  { id: 7,  hoTen: 'Nguyễn Thị Cháu Hai', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1978 }, boId: 3, meId: 5, thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },
    9:  { id: 9,  hoTen: 'Nguyễn Văn Cháu Ba', gioiTinh: 'nam', laThanhVienHo: true,
           namSinh: { nam: 1985 }, boId: 3, meId: 8, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    11: { id: 11, hoTen: 'Nguyễn Thị Cháu Tư', gioiTinh: 'nu', laThanhVienHo: true,
           namSinh: { nam: 1992 }, boId: 3, meId: 10, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },

    // ── Chồng của p4 & con ────────────────────────────────────────────────────
    12: { id: 12, hoTen: 'Võ Văn Rể', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1949 },
           honNhan: [{ voChongId: 4 }], conCaiIds: [13, 14] },
    13: { id: 13, hoTen: 'Võ Thị Ngoại Một', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1976 }, boId: 12, meId: 4, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    14: { id: 14, hoTen: 'Võ Văn Ngoại Hai', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1979 }, boId: 12, meId: 4, thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },

    // ── Chồng của p15 & con ───────────────────────────────────────────────────
    16: { id: 16, hoTen: 'Đinh Văn Chồng Một', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1953 }, namMat: { nam: 1985 },
           honNhan: [{ voChongId: 15 }], conCaiIds: [17] },
    17: { id: 17, hoTen: 'Đinh Văn Con Một', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1978 }, boId: 16, meId: 15, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    18: { id: 18, hoTen: 'Đỗ Văn Chồng Hai', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1957 }, namMat: { nam: 1995 },
           honNhan: [{ voChongId: 15 }], conCaiIds: [19, 20] },
    19: { id: 19, hoTen: 'Đỗ Thị Con Hai', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1982 }, boId: 18, meId: 15, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
    20: { id: 20, hoTen: 'Đỗ Văn Con Ba', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1985 }, boId: 18, meId: 15, thuTuAnhChi: 2,
           honNhan: [], conCaiIds: [] },
    21: { id: 21, hoTen: 'Bùi Văn Chồng Ba', gioiTinh: 'nam', laThanhVienHo: false,
           namSinh: { nam: 1960 },
           honNhan: [{ voChongId: 15 }], conCaiIds: [22] },
    22: { id: 22, hoTen: 'Bùi Thị Con Bốn', gioiTinh: 'nu', laThanhVienHo: false,
           namSinh: { nam: 1990 }, boId: 21, meId: 15, thuTuAnhChi: 1,
           honNhan: [], conCaiIds: [] },
  },
}

export default function AuthGate({ children }: Props) {
  const { fileId, setData, setUser, setFileId } = useGiaphaStore()
  const [loading, setLoading] = useState(true)
  const [publicMode, setPublicMode] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY

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
          } else {
            // No file yet — mark user as admin so AdminSetup is shown
            setUser(email, 'admin')
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
    async function handlePublicMode() {
      if (!fileId) {
        alert('Chưa cấu hình file gia phả để xem công khai')
        return
      }
      if (!apiKey) {
        alert('Thiếu VITE_GOOGLE_API_KEY để vào chế độ chỉ xem')
        return
      }
      try {
        const d = await docFileCong(fileId, apiKey)
        setData(d)
        setUser('', 'public')
        setPublicMode(true)
      } catch (e: unknown) {
        alert('Không thể vào chế độ chỉ xem: ' + (e as Error).message)
      }
    }

    function handleDemo() {
      setData(DEMO_DATA)
      setUser('demo@example.com', 'admin')
      setFileId('demo-file-id')
      setPublicMode(true)
    }

    return (
      <LoginPage
        publicModeAvailable={true}
        onPublicMode={handlePublicMode}
        onDemo={!clientId ? handleDemo : undefined}
      />
    )
  }

  if (!fileId) {
    return <AdminSetup />
  }

  return <>{children}</>
}
