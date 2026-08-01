import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { settings } from '../db/schema'
import type * as schema from '../db/schema'

export type DB = DrizzleD1Database<typeof schema>

type DbGender = 'male' | 'female' | 'other' | null

/** DB gender enum -> giapha's Vietnamese gender enum. */
export function mapGenderToGioiTinh(gender: DbGender): 'nam' | 'nu' | 'khac' {
  if (gender === 'male') return 'nam'
  if (gender === 'female') return 'nu'
  return 'khac'
}

/** giapha's Vietnamese gender enum -> DB gender enum. */
export function mapGioiTinhToGender(gioiTinh: 'nam' | 'nu' | 'khac'): DbGender {
  if (gioiTinh === 'nam') return 'male'
  if (gioiTinh === 'nu') return 'female'
  return 'other'
}

export interface NgayThang {
  nam?: number
  thang?: number
  ngay?: number
  amLich?: boolean
}

/** DB year/month/day/isLunar columns -> giapha's NgayThang, or undefined if all parts are unset. */
export function toNgayThang(
  year: number | null,
  month: number | null,
  day: number | null,
  isLunar: boolean | null,
): NgayThang | undefined {
  if (year == null && month == null && day == null) return undefined
  return {
    nam: year ?? undefined,
    thang: month ?? undefined,
    ngay: day ?? undefined,
    amLich: isLunar ?? undefined,
  }
}

/** giapha's NgayThang -> DB year/month/day/isLunar columns. */
export function fromNgayThang(ngayThang: NgayThang | undefined) {
  return {
    year: ngayThang?.nam ?? null,
    month: ngayThang?.thang ?? null,
    day: ngayThang?.ngay ?? null,
    isLunar: ngayThang?.amLich ?? false,
  }
}

export interface Metadata {
  tenDongHo: string
  moTa?: string
}

/** Builds giapha's Metadata from giaphadongho's shared `settings` key/value table. */
export async function buildMetadata(db: DB): Promise<Metadata> {
  const rows = await db.select().from(settings).all()
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    tenDongHo: byKey.family_name ?? 'Gia phả họ Hoàng',
    moTa: byKey.family_description ?? undefined,
  }
}
