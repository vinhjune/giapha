import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { persons, families, familyMembers, editorRequests } from '../db/schema'
import { buildMetadata, mapGenderToGioiTinh, toNgayThang } from '../lib/reshape'
import type { DB } from '../lib/reshape'
import type { HonoEnv } from '../types'

const treeRoutes = new Hono<HonoEnv>()

type FamilyRow = typeof families.$inferSelect
type MemberRow = typeof familyMembers.$inferSelect

treeRoutes.get('/tree', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB

  const [allPersons, allFamilies, allMembers, pendingRequests] = await Promise.all([
    db.select().from(persons).all(),
    db.select().from(families).all(),
    db.select().from(familyMembers).all(),
    db.select({ id: editorRequests.id, personId: editorRequests.personId })
      .from(editorRequests)
      .where(eq(editorRequests.status, 'pending'))
      .all(),
  ])
  const pendingRequestByPersonId = new Map(
    pendingRequests.filter(r => r.personId).map(r => [r.personId as string, r.id]),
  )

  // personId -> family_members row (this person as a child)
  const childOf = new Map<string, MemberRow>(allMembers.map(m => [m.personId, m]))
  // familyId -> children personIds
  const childrenOf = new Map<string, string[]>()
  for (const m of allMembers) {
    const arr = childrenOf.get(m.familyId) ?? []
    arr.push(m.personId)
    childrenOf.set(m.familyId, arr)
  }
  const familyById = new Map<string, FamilyRow>(allFamilies.map(f => [f.id, f]))
  // personId -> families where they are parent1 or parent2 (their marriages)
  const marriagesOf = new Map<string, FamilyRow[]>()
  for (const f of allFamilies) {
    if (f.parent1Id) (marriagesOf.get(f.parent1Id) ?? marriagesOf.set(f.parent1Id, []).get(f.parent1Id)!).push(f)
    if (f.parent2Id) (marriagesOf.get(f.parent2Id) ?? marriagesOf.set(f.parent2Id, []).get(f.parent2Id)!).push(f)
  }

  const outPersons: Record<string, unknown> = {}
  for (const p of allPersons) {
    const membership = childOf.get(p.id)
    const family = membership ? familyById.get(membership.familyId) : undefined
    const marriages = [...(marriagesOf.get(p.id) ?? [])].sort((a, b) => {
      const orderA = p.id === a.parent1Id ? a.orderP1 : a.orderP2
      const orderB = p.id === b.parent1Id ? b.orderP1 : b.orderP2
      return orderA - orderB
    })

    outPersons[p.id] = {
      id: p.id,
      hoTen: p.name,
      gioiTinh: mapGenderToGioiTinh(p.gender),
      email: p.email ?? undefined,
      soDienThoai: p.phone ?? undefined,
      namSinh: toNgayThang(p.birthYear, p.birthMonth, p.birthDay, p.birthIsLunar),
      namMat: p.isAlive ? undefined : toNgayThang(p.deathYear, p.deathMonth, p.deathDay, p.deathIsLunar),
      queQuan: p.address ?? undefined,
      tieuSu: p.bio ?? undefined,
      anhDaiDien: p.avatarKey ? `/api/avatars/${p.avatarKey}` : undefined,
      laThanhVienHo: !p.ngoaiToc,
      thuTuAnhChi: membership?.childOrder ?? undefined,
      thuTuDoi: p.thuTuDoi ?? undefined,
      boId: family?.parent1Id ?? undefined,
      meId: family?.parent2Id ?? undefined,
      honNhan: marriages
        .map(f => ({
          voChongId: (f.parent1Id === p.id ? f.parent2Id : f.parent1Id) ?? '',
          ghiChu: f.notes ?? undefined,
        }))
        .filter(h => h.voChongId),
      // A person can be a parent in multiple families (remarriage) — union children across all of them.
      conCaiIds: marriages.flatMap(f => childrenOf.get(f.id) ?? []),
      ghiChu: p.notes ?? undefined,
      pendingRequestId: pendingRequestByPersonId.get(p.id),
    }
  }

  return c.json({ metadata: await buildMetadata(db), persons: outPersons })
})

export default treeRoutes
