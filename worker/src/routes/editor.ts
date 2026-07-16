import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, isNull, count } from 'drizzle-orm'
import { persons, families, familyMembers } from '../db/schema'
import { mapGioiTinhToGender, fromNgayThang, type NgayThang } from '../lib/reshape'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

const editorRoutes = new Hono<HonoEnv>()

// ─── Family sync helper (ported from giaphadongho's syncParents) ──────────────
// Sets a person's parents by finding/creating the matching family and moving
// the child. Deletes the old family if it becomes childless.
async function syncParents(
  db: DB,
  personId: string,
  fatherId: string | null,
  motherId: string | null,
  childOrder?: number | null,
) {
  const currentMembership = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.personId, personId))
    .get()

  if (currentMembership) {
    const currentFamily = await db
      .select({ id: families.id, parent1Id: families.parent1Id, parent2Id: families.parent2Id })
      .from(families)
      .where(eq(families.id, currentMembership.familyId))
      .get()

    if (currentFamily &&
        (currentFamily.parent1Id ?? null) === fatherId &&
        (currentFamily.parent2Id ?? null) === motherId) {
      if (childOrder !== undefined) {
        await db.update(familyMembers)
          .set({ childOrder: childOrder ?? null })
          .where(and(eq(familyMembers.personId, personId), eq(familyMembers.familyId, currentMembership.familyId)))
      }
      return
    }

    await db.delete(familyMembers)
      .where(and(eq(familyMembers.personId, personId), eq(familyMembers.familyId, currentMembership.familyId)))

    const [{ remaining }] = await db
      .select({ remaining: count() })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, currentMembership.familyId))
    if (remaining === 0) {
      await db.delete(families).where(eq(families.id, currentMembership.familyId))
    }
  }

  if (!fatherId && !motherId) return

  const p1Cond = fatherId ? eq(families.parent1Id, fatherId) : isNull(families.parent1Id)
  const p2Cond = motherId ? eq(families.parent2Id, motherId) : isNull(families.parent2Id)
  let targetFamily = await db.select({ id: families.id }).from(families).where(and(p1Cond, p2Cond)).get()

  if (!targetFamily) {
    const newFamilyId = crypto.randomUUID()
    await db.insert(families).values({ id: newFamilyId, parent1Id: fatherId, parent2Id: motherId, orderP1: 1, orderP2: 1 })
    targetFamily = { id: newFamilyId }
  }

  await db.insert(familyMembers).values({ familyId: targetFamily.id, personId, childOrder: childOrder ?? null })
}

class FamilyHasChildrenError extends Error {
  familyId: string
  constructor(familyId: string) {
    super(`Family ${familyId} still has children, cannot remove marriage`)
    this.familyId = familyId
  }
}

// Syncs a person's marriages (giapha's honNhan[]) against the families table.
// A person can be a parent (parent1/parent2) in multiple families (remarriage).
async function syncMarriages(
  db: DB,
  personId: string,
  gender: 'male' | 'female' | 'other' | null,
  honNhan: { voChongId: string; ghiChu?: string }[],
) {
  const [existingAsP1, existingAsP2] = await Promise.all([
    db.select().from(families).where(eq(families.parent1Id, personId)).all(),
    db.select().from(families).where(eq(families.parent2Id, personId)).all(),
  ])
  const existing = [
    ...existingAsP1.map(f => ({ ...f, spouseId: f.parent2Id })),
    ...existingAsP2.map(f => ({ ...f, spouseId: f.parent1Id })),
  ]

  const newSpouseIds = new Set(honNhan.map(h => h.voChongId).filter(Boolean))
  const notesBySpouse = new Map(honNhan.map(h => [h.voChongId, h.ghiChu]))
  const handledSpouseIds = new Set<string>()

  for (const fam of existing) {
    if (fam.spouseId && newSpouseIds.has(fam.spouseId)) {
      handledSpouseIds.add(fam.spouseId)
      const newNotes = notesBySpouse.get(fam.spouseId)
      if (newNotes !== undefined && newNotes !== fam.notes) {
        await db.update(families).set({ notes: newNotes ?? null }).where(eq(families.id, fam.id))
      }
      continue
    }
    // Marriage removed from honNhan — only safe to delete if the family has no children.
    const children = await db.select({ personId: familyMembers.personId }).from(familyMembers)
      .where(eq(familyMembers.familyId, fam.id)).all()
    if (children.length > 0) throw new FamilyHasChildrenError(fam.id)
    await db.delete(families).where(eq(families.id, fam.id))
  }

  for (const spouseId of newSpouseIds) {
    if (handledSpouseIds.has(spouseId)) continue
    // Convention (matches giaphadongho): parent1 = father, parent2 = mother.
    // 'other'/unknown gender defaults this person to parent1.
    const personIsParent1 = gender !== 'female'
    const parent1Id = personIsParent1 ? personId : spouseId
    const parent2Id = personIsParent1 ? spouseId : personId

    const found = await db.select({ id: families.id, notes: families.notes }).from(families)
      .where(and(eq(families.parent1Id, parent1Id), eq(families.parent2Id, parent2Id))).get()
    const notes = notesBySpouse.get(spouseId) ?? null
    if (!found) {
      await db.insert(families).values({ id: crypto.randomUUID(), parent1Id, parent2Id, orderP1: 1, orderP2: 1, notes })
    } else if (notes !== found.notes) {
      await db.update(families).set({ notes }).where(eq(families.id, found.id))
    }
  }
}

interface PersonPayload {
  hoTen: string
  gioiTinh: 'nam' | 'nu' | 'khac'
  email?: string
  soDienThoai?: string
  namSinh?: NgayThang
  namMat?: NgayThang
  queQuan?: string
  tieuSu?: string
  laThanhVienHo: boolean
  thuTuAnhChi?: number
  thuTuDoi?: number
  boId?: string
  meId?: string
  honNhan: { voChongId: string; ghiChu?: string }[]
  ghiChu?: string
}

function toPersonRow(body: PersonPayload) {
  const gender = mapGioiTinhToGender(body.gioiTinh)
  const birth = fromNgayThang(body.namSinh)
  const death = fromNgayThang(body.namMat)
  return {
    name: body.hoTen.trim(),
    gender,
    email: body.email ?? null,
    phone: body.soDienThoai ?? null,
    address: body.queQuan ?? null,
    bio: body.tieuSu ?? null,
    notes: body.ghiChu ?? null,
    ngoaiToc: !body.laThanhVienHo,
    thuTuDoi: body.thuTuDoi ?? null,
    birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day, birthIsLunar: birth.isLunar,
    isAlive: !body.namMat,
    deathYear: death.year, deathMonth: death.month, deathDay: death.day, deathIsLunar: death.isLunar,
  }
}

editorRoutes.post('/persons', async (c) => {
  const body = await c.req.json<PersonPayload>()
  if (!body.hoTen?.trim()) return c.json({ error: 'hoTen is required' }, 400)

  const db = drizzle(c.env.giapha_db) as DB
  const id = crypto.randomUUID()
  try {
    await db.insert(persons).values({ id, ...toPersonRow(body) })
    await syncParents(db, id, body.boId ?? null, body.meId ?? null, body.thuTuAnhChi ?? null)
    await syncMarriages(db, id, mapGioiTinhToGender(body.gioiTinh), body.honNhan ?? [])
    return c.json({ id }, 201)
  } catch (err) {
    if (err instanceof FamilyHasChildrenError) return c.json({ error: err.message }, 409)
    throw err
  }
})

editorRoutes.put('/persons/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<PersonPayload>()
  if (!body.hoTen?.trim()) return c.json({ error: 'hoTen is required' }, 400)

  const db = drizzle(c.env.giapha_db) as DB
  try {
    await db.update(persons)
      .set({ ...toPersonRow(body), updatedAt: new Date().toISOString() })
      .where(eq(persons.id, id))
    await syncParents(db, id, body.boId ?? null, body.meId ?? null, body.thuTuAnhChi ?? null)
    await syncMarriages(db, id, mapGioiTinhToGender(body.gioiTinh), body.honNhan ?? [])
    return c.json({ ok: true })
  } catch (err) {
    if (err instanceof FamilyHasChildrenError) return c.json({ error: err.message }, 409)
    throw err
  }
})

editorRoutes.delete('/persons/:id', async (c) => {
  const personId = c.req.param('id')
  const db = drizzle(c.env.giapha_db) as DB

  const membership = await db.select({ familyId: familyMembers.familyId }).from(familyMembers)
    .where(eq(familyMembers.personId, personId)).get()
  const [parentFamilies1, parentFamilies2] = await Promise.all([
    db.select({ id: families.id }).from(families).where(eq(families.parent1Id, personId)).all(),
    db.select({ id: families.id }).from(families).where(eq(families.parent2Id, personId)).all(),
  ])
  const parentFamilyIds = [...parentFamilies1, ...parentFamilies2].map(f => f.id)

  await db.delete(persons).where(eq(persons.id, personId))

  if (membership) {
    const [{ remaining }] = await db.select({ remaining: count() }).from(familyMembers)
      .where(eq(familyMembers.familyId, membership.familyId))
    if (remaining === 0) await db.delete(families).where(eq(families.id, membership.familyId))
  }

  // ON DELETE SET NULL already cleared parent1Id/parent2Id — remove families left with no parent.
  for (const familyId of parentFamilyIds) {
    const family = await db.select({ p1: families.parent1Id, p2: families.parent2Id }).from(families)
      .where(eq(families.id, familyId)).get()
    if (family && family.p1 === null && family.p2 === null) {
      await db.delete(families).where(eq(families.id, familyId))
    }
  }

  return c.json({ ok: true })
})

editorRoutes.post('/persons/:id/avatar', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const personId = c.req.param('id')
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Missing file' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `avatars/${personId}.${ext}`
  await c.env.giapha_avatars.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })
  await db.update(persons).set({ avatarKey: key, updatedAt: new Date().toISOString() }).where(eq(persons.id, personId))
  return c.json({ avatarUrl: `/api/avatars/${key}` })
})

export default editorRoutes
