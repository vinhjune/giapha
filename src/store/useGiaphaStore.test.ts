import { beforeEach, describe, expect, it } from 'vitest'
import type { GiaphaData } from '../types/giapha'
import { useGiaphaStore } from './useGiaphaStore'

function taoDataMau(): GiaphaData {
  return {
    metadata: {
      tenDongHo: 'Dòng họ mẫu',
      ngayTao: '2026-01-01T00:00:00.000Z',
      nguoiTao: 'admin@example.com',
      phienBan: 1,
      cheDoCong: false,
      danhSachNguoiDung: [],
    },
    persons: {
      a: {
        id: 'a',
        hoTen: 'Người A',
        gioiTinh: 'nam',
        laThanhVienHo: true,
        honNhan: [],
        conCaiIds: [],
      },
      b: {
        id: 'b',
        hoTen: 'Người B',
        gioiTinh: 'nu',
        laThanhVienHo: false,
        honNhan: [],
        conCaiIds: [],
      },
    },
  }
}

describe('useGiaphaStore spouse sync', () => {
  beforeEach(() => {
    useGiaphaStore.setState({
      data: taoDataMau(),
      isDirty: false,
      selectedPersonId: null,
      fileId: null,
      currentUserEmail: null,
      currentRole: 'public',
      viewMode: 'tree',
      isSaving: false,
      conflictDetected: false,
    })
  })

  it('updates reverse spouse link when editing a person', () => {
    useGiaphaStore.getState().suaNguoi('a', {
      honNhan: [{ voChongId: 'b' }],
    })

    const b = useGiaphaStore.getState().data?.persons.b
    expect(b?.honNhan).toEqual([{ voChongId: 'a' }])
  })

  it('removes reverse spouse link when spouse is removed', () => {
    useGiaphaStore.getState().suaNguoi('a', {
      honNhan: [{ voChongId: 'b' }],
    })

    useGiaphaStore.getState().suaNguoi('a', { honNhan: [] })

    const b = useGiaphaStore.getState().data?.persons.b
    expect(b?.honNhan).toEqual([])
  })

  it('stores optional email and phone when adding a person', () => {
    const id = useGiaphaStore.getState().themNguoi({
      hoTen: 'Người C',
      gioiTinh: 'khac',
      email: 'c@example.com',
      soDienThoai: '0901234567',
      laThanhVienHo: true,
      honNhan: [],
      conCaiIds: [],
    })

    const c = useGiaphaStore.getState().data?.persons[id]
    expect(c?.email).toBe('c@example.com')
    expect(c?.soDienThoai).toBe('0901234567')
  })

  it('allows email and phone to be empty', () => {
    const id = useGiaphaStore.getState().themNguoi({
      hoTen: 'Người D',
      gioiTinh: 'nu',
      laThanhVienHo: false,
      honNhan: [],
      conCaiIds: [],
    })

    const d = useGiaphaStore.getState().data?.persons[id]
    expect(d?.email).toBeUndefined()
    expect(d?.soDienThoai).toBeUndefined()
  })
})
