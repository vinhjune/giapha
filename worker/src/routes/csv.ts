import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { persons, families, familyMembers } from '../db/schema'
import { serializeToUnifiedCsv } from '../lib/csv-export'
import { parseUnifiedCsv, validateImportData, buildFamilyMemberships, coerceMemberRow, coerceFamilyRow } from '../lib/csv-import'
import { eq } from 'drizzle-orm'
import type { HonoEnv } from '../types'

const csvRoutes = new Hono<HonoEnv>()

csvRoutes.get('/export/csv', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const today = new Date().toISOString().slice(0, 10)

  const personRows = await db
    .select({
      id:           persons.id,
      name:         persons.name,
      gender:       persons.gender,
      nickname:     persons.nickname,
      bio:          persons.bio,
      address:      persons.address,
      email:        persons.email,
      phone:        persons.phone,
      birthYear:    persons.birthYear,
      birthMonth:   persons.birthMonth,
      birthDay:     persons.birthDay,
      birthIsLunar: persons.birthIsLunar,
      deathYear:    persons.deathYear,
      deathMonth:   persons.deathMonth,
      deathDay:     persons.deathDay,
      deathIsLunar: persons.deathIsLunar,
      isAlive:      persons.isAlive,
      notes:        persons.notes,
      ngoaiToc:     persons.ngoaiToc,
      thuTuDoi:     persons.thuTuDoi,
      fatherId:     families.parent1Id,
      motherId:     families.parent2Id,
      childOrder:   familyMembers.childOrder,
    })
    .from(persons)
    .leftJoin(familyMembers, eq(familyMembers.personId, persons.id))
    .leftJoin(families, eq(families.id, familyMembers.familyId))
    .all()

  const allFamilies = await db
    .select({
      id:       families.id,
      fatherId: families.parent1Id,
      motherId: families.parent2Id,
      orderP1:  families.orderP1,
      orderP2:  families.orderP2,
      status:   families.status,
      notes:    families.notes,
    })
    .from(families)
    .all()

  const csv = serializeToUnifiedCsv(personRows, allFamilies)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gia-pha-export-${today}.csv"`,
    },
  })
})

csvRoutes.post('/import/csv', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ errors: ['No file uploaded'] }, 400)

  const csvText = await file.text()
  const { members: memberRows, families: familyRows, errors: parseErrors } = parseUnifiedCsv(csvText)
  if (parseErrors.length) return c.json({ errors: parseErrors }, 400)

  const crossErrors = validateImportData(memberRows, familyRows)
  if (crossErrors.length) return c.json({ errors: crossErrors }, 400)

  const db = drizzle(c.env.giapha_db)

  const personValues = memberRows.map(coerceMemberRow)
  const familyValues = familyRows.map(coerceFamilyRow)

  const seenPersonIds = new Set<string>()
  const uniquePersonValues = personValues.filter(p => {
    if (seenPersonIds.has(p.id)) return false
    seenPersonIds.add(p.id)
    return true
  })
  const seenFamilyIds = new Set<string>()
  const uniqueFamilyValues = familyValues.filter(f => {
    if (seenFamilyIds.has(f.id)) return false
    seenFamilyIds.add(f.id)
    return true
  })

  const rawMemberships = buildFamilyMemberships(memberRows, familyRows)
  const seenMemberPersonIds = new Set<string>()
  const memberships = rawMemberships.filter(m => {
    if (seenMemberPersonIds.has(m.personId)) return false
    seenMemberPersonIds.add(m.personId)
    return true
  })

  // D1 local SQLite enforces a per-statement limit of 100 bound parameters.
  // Multi-row INSERT chunks: persons 5×18=90, families 7×14=98, memberships 33×3=99.
  function chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
    return result
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runBatches(stmts: any[][]): Promise<void> {
    for (const batch of stmts) {
      if (batch.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.batch(batch as [any, ...any[]])
      }
    }
  }

  // Full replace: wipe existing data then insert fresh from CSV.
  await db.batch([
    db.delete(familyMembers),
    db.delete(families),
    db.delete(persons),
  ])

  await runBatches(chunk(uniquePersonValues, 5).map(rows => [db.insert(persons).values(rows)]))
  await runBatches(chunk(uniqueFamilyValues, 7).map(rows => [db.insert(families).values(rows)]))
  if (memberships.length > 0) {
    await runBatches(chunk(memberships, 33).map(rows => [db.insert(familyMembers).values(rows)]))
  }

  return c.json({ imported: { persons: uniquePersonValues.length, families: uniqueFamilyValues.length } })
})

export default csvRoutes
