import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiaphaData } from '../types/giapha'

vi.mock('../services/api', () => ({
  getTree: vi.fn(),
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  deletePerson: vi.fn(),
}))

import * as api from '../services/api'
import { useGiaphaStore } from './useGiaphaStore'

function taoDataMau(): GiaphaData {
  return {
    metadata: { tenDongHo: 'Dòng họ mẫu' },
    persons: {
      '1': { id: '1', hoTen: 'Người A', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Người B', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [], conCaiIds: [] },
    },
  }
}

describe('useGiaphaStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGiaphaStore.setState({
      data: null,
      loading: false,
      error: null,
      selectedPersonId: null,
      focusedPersonId: null,
      viewMode: 'tree',
      cyclicRelationshipWarnings: [],
    })
  })

  it('loadData fetches the tree and populates state', async () => {
    vi.mocked(api.getTree).mockResolvedValue(taoDataMau())

    await useGiaphaStore.getState().loadData()

    expect(api.getTree).toHaveBeenCalled()
    expect(useGiaphaStore.getState().data?.persons['1'].hoTen).toBe('Người A')
    expect(useGiaphaStore.getState().loading).toBe(false)
  })

  it('loadData sets an error message when the request fails', async () => {
    vi.mocked(api.getTree).mockRejectedValue(new Error('network down'))

    await useGiaphaStore.getState().loadData()

    expect(useGiaphaStore.getState().error).toBe('network down')
  })

  it('sets cyclic relationship warnings when loaded data has a cycle', async () => {
    const cyclicData = taoDataMau()
    cyclicData.persons['1'].conCaiIds = ['2']
    cyclicData.persons['2'].conCaiIds = ['1']
    vi.mocked(api.getTree).mockResolvedValue(cyclicData)

    await useGiaphaStore.getState().loadData()

    expect(useGiaphaStore.getState().cyclicRelationshipWarnings.length).toBeGreaterThan(0)
  })

  it('themNguoi creates a person via the API then refetches', async () => {
    vi.mocked(api.createPerson).mockResolvedValue({ id: 'new-1' })
    vi.mocked(api.getTree).mockResolvedValue(taoDataMau())

    const id = await useGiaphaStore.getState().themNguoi({
      hoTen: 'Người C', gioiTinh: 'khac', laThanhVienHo: true, honNhan: [], conCaiIds: [],
    })

    expect(id).toBe('new-1')
    expect(api.createPerson).toHaveBeenCalled()
    expect(api.getTree).toHaveBeenCalled()
  })

  it('suaNguoi updates a person via the API then refetches', async () => {
    vi.mocked(api.updatePerson).mockResolvedValue({ ok: true })
    vi.mocked(api.getTree).mockResolvedValue(taoDataMau())

    await useGiaphaStore.getState().suaNguoi('1', {
      hoTen: 'Người A', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [],
    })

    expect(api.updatePerson).toHaveBeenCalledWith('1', expect.objectContaining({ hoTen: 'Người A' }))
    expect(api.getTree).toHaveBeenCalled()
  })

  it('xoaNguoi deletes a person via the API then refetches', async () => {
    vi.mocked(api.deletePerson).mockResolvedValue({ ok: true })
    vi.mocked(api.getTree).mockResolvedValue(taoDataMau())

    await useGiaphaStore.getState().xoaNguoi('1')

    expect(api.deletePerson).toHaveBeenCalledWith('1')
    expect(api.getTree).toHaveBeenCalled()
  })

  it('toggleGenerationOrder flips the local display preference', () => {
    const before = useGiaphaStore.getState().hienThiThuTuDoi
    useGiaphaStore.getState().toggleGenerationOrder()
    expect(useGiaphaStore.getState().hienThiThuTuDoi).toBe(!before)
  })
})
