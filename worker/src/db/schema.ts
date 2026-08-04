// This worker owns and independently migrates its own D1 database schema
// (see worker/migrations/ — apply with `wrangler d1 execute`, never
// drizzle-kit push/migrate).
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull().default('viewer'),
  email:        text('email').notNull().unique(),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  personId:     text('person_id').unique().references(() => persons.id, { onDelete: 'set null' }),
  createdAt:    text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  token:     text('token').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Editor Requests ──────────────────────────────────────────────────────────
export const editorRequests = sqliteTable('editor_requests', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:         text('type', { enum: ['create', 'update', 'delete'] }).notNull(),
  personId:     text('person_id').references(() => persons.id, { onDelete: 'set null' }),
  payload:      text('payload'),
  status:       text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  submittedBy:  text('submitted_by').notNull().references(() => users.id),
  resolvedBy:   text('resolved_by').references(() => users.id),
  resolvedAt:   text('resolved_at'),
  createdAt:    text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('editor_requests_status_idx').on(t.status),
  index('editor_requests_pending_person_idx').on(t.personId, t.status),
])

// ─── Persons ──────────────────────────────────────────────────────────────────
export const persons = sqliteTable('persons', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:         text('name').notNull(),
  gender:       text('gender', { enum: ['male', 'female', 'other'] }),
  nickname:     text('nickname'),
  bio:          text('bio'),
  // Sensitive — hidden from guest role
  address:      text('address'),
  email:        text('email'),
  phone:        text('phone'),
  // Avatar stored in R2; field holds the R2 object key
  avatarKey:    text('avatar_key'),
  // Birth date (partial + lunar support)
  birthYear:    integer('birth_year'),
  birthMonth:   integer('birth_month'),
  birthDay:     integer('birth_day'),
  birthIsLunar: integer('birth_is_lunar', { mode: 'boolean' }).default(false),
  // Death date — sensitive
  deathYear:    integer('death_year'),
  deathMonth:   integer('death_month'),
  deathDay:     integer('death_day'),
  deathIsLunar: integer('death_is_lunar', { mode: 'boolean' }).default(false),
  isAlive:      integer('is_alive', { mode: 'boolean' }).notNull().default(true),
  notes:        text('notes'),
  // Lineage classification — ngoaiToc: married-in spouse or descendant through a
  // married-in parent (con dâu/con rể/cháu ngoại). thuTuDoi: generation number
  // counted from the branch's founding ancestor, resolved via parent OR spouse —
  // set for ngoại tộc members too (their spouse's/parent's đời), not just blood members.
  ngoaiToc:     integer('ngoai_toc', { mode: 'boolean' }).notNull().default(false),
  thuTuDoi:     integer('thu_tu_doi'),
  createdAt:    text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:    text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('persons_name_idx').on(t.name),
])

// ─── Families ─────────────────────────────────────────────────────────────────
// One family = one parental couple (or single parent) + their children.
// A person may be a parent in multiple families (one per marriage).
// orderP1/orderP2 = which marriage number this is for each parent (1 = first, 2 = second…)
export const families = sqliteTable('families', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  parent1Id: text('parent1_id').references(() => persons.id, { onDelete: 'set null' }),
  parent2Id: text('parent2_id').references(() => persons.id, { onDelete: 'set null' }),
  orderP1:   integer('order_p1').notNull().default(1),
  orderP2:   integer('order_p2').notNull().default(1),
  status:    text('status', { enum: ['active', 'divorced', 'widowed'] }).default('active'),
  notes:     text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Family Members ───────────────────────────────────────────────────────────
// Children in a family. UNIQUE(person_id) ensures a child belongs to exactly one family.
// childOrder: manual birth order (1=cả, 2=hai…); null = use birthYear for display sort.
export const familyMembers = sqliteTable('family_members', {
  familyId:   text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  personId:   text('person_id').notNull().unique().references(() => persons.id, { onDelete: 'cascade' }),
  childOrder: integer('child_order'),
}, (t) => [
  primaryKey({ columns: [t.familyId, t.personId] }),
])

// ─── Events (giỗ chạp, thanh minh, tảo mộ…) ─────────────────────────────────
export const events = sqliteTable('events', {
  id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title:       text('title').notNull(),
  description: text('description'),
  // Free-text date override (e.g. "Rằm tháng 7") — takes display precedence over structured fields
  dateText:    text('date_text'),
  year:        integer('year'),
  month:       integer('month'),
  day:         integer('day'),
  isLunar:     integer('is_lunar', { mode: 'boolean' }).default(false),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(true),
  createdAt:   text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:   text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Settings (landing page content) ─────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Relations ────────────────────────────────────────────────────────────────
export const personsRelations = relations(persons, ({ many }) => ({
  familiesAsParent1:  many(families, { relationName: 'parent1' }),
  familiesAsParent2:  many(families, { relationName: 'parent2' }),
  familyMemberships:  many(familyMembers),
}))

export const familiesRelations = relations(families, ({ one, many }) => ({
  parent1:  one(persons, { fields: [families.parent1Id], references: [persons.id], relationName: 'parent1' }),
  parent2:  one(persons, { fields: [families.parent2Id], references: [persons.id], relationName: 'parent2' }),
  children: many(familyMembers),
}))

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, { fields: [familyMembers.familyId], references: [families.id] }),
  person: one(persons,  { fields: [familyMembers.personId],  references: [persons.id] }),
}))
