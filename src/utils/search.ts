import type { GiaphaData, Person } from '../types/giapha'

function chuanHoa(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
}

export function timKiemTheoTen(tuKhoa: string, data: GiaphaData): Person[] {
  if (!tuKhoa.trim()) return []
  const normalized = chuanHoa(tuKhoa)
  return Object.values(data.persons).filter(p =>
    chuanHoa(p.hoTen).includes(normalized)
  )
}
