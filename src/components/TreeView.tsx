import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonCard from './PersonCard'
import type { Person } from '../types/giapha'
import { sapXepAnhChiEm } from '../utils/familyTree'

const NODE_W = 120
const NODE_H = 64
const COUPLE_GAP = 24    // gap: person's right edge → start of first spouse zone
const SPOUSE_SEP = 24    // gap between consecutive spouse zones
const H_GAP = 20         // gap between siblings within the same marriage
const V_GAP = 130        // vertical gap between generations (enlarged to fit spouse row)
const SPOUSE_DROP = 8    // gap between person card bottom and spouse card top
const FOREST_GAP = 80    // horizontal gap between disconnected family trees
const KEYBOARD_PAN_STEP = 60

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * One spouse + their children from this marriage.
 * descentX: x of the vertical drop line (spouse card center, or group center if no spouse)
 */
interface Marriage {
  spouse: Person | null
  spouseX: number       // left edge of spouse card; -1 if no spouse
  descentX: number      // where the vertical descent line drops
  childNodes: TreeNode[]
}

interface TreeNode {
  person: Person
  x: number             // left edge of person card
  y: number             // top of card row
  subtreeWidth: number  // guaranteed to contain ALL descendant cards
  marriages: Marriage[]
}

interface RenderCard {
  person: Person
  x: number
  y: number
  isSpouse: boolean
}

interface SvgLine {
  x1: number; y1: number
  x2: number; y2: number
  isCouple: boolean
}

function taoChiMucCon(persons: Record<string, Person>): Record<string, string[]> {
  const index: Record<string, string[]> = {}
  const daThem: Record<string, Set<string>> = {}

  const themCon = (parentId: string, childId: string) => {
    if (!persons[parentId] || !persons[childId]) return
    if (!index[parentId]) {
      index[parentId] = []
      daThem[parentId] = new Set<string>()
    }
    if (daThem[parentId].has(childId)) return
    daThem[parentId].add(childId)
    index[parentId].push(childId)
  }

  for (const person of Object.values(persons)) {
    for (const childId of person.conCaiIds) themCon(person.id, childId)
  }

  for (const person of Object.values(persons)) {
    if (person.boId) themCon(person.boId, person.id)
    if (person.meId) themCon(person.meId, person.id)
  }

  return index
}

// ─── Build tree ───────────────────────────────────────────────────────────────

function buildTree(
  personId: string,
  persons: Record<string, Person>,
  childrenIndex: Record<string, string[]>,
  visited: Set<string>
): TreeNode | null {
  if (visited.has(personId)) return null
  visited.add(personId)

  const person = persons[personId]
  if (!person) return null

  // Pre-mark all spouses so they don't appear as separate tree roots
  for (const h of person.honNhan) visited.add(h.voChongId)

  const marriages: Marriage[] = []
  const matchedChildIds = new Set<string>()
  const orderedChildIds = sapXepAnhChiEm(
    (childrenIndex[person.id] ?? []).map(id => persons[id]).filter(Boolean) as Person[]
  ).map(child => child.id)

  for (const h of person.honNhan) {
    const spouse = persons[h.voChongId] ?? null
    const sId = h.voChongId

    const childIds = orderedChildIds.filter(cId => {
      const c = persons[cId]
      if (!c) return false
      return person.gioiTinh === 'nam'
        ? c.boId === person.id && c.meId === sId
        : c.meId === person.id && c.boId === sId
    })
    childIds.forEach(id => matchedChildIds.add(id))

    marriages.push({
      spouse,
      spouseX: 0,
      descentX: 0,
      childNodes: childIds
        .map(id => buildTree(id, persons, childrenIndex, visited))
        .filter(Boolean) as TreeNode[],
    })
  }

  // Children not linked to any marriage (boId/meId missing)
  const unmatched = orderedChildIds
    .filter(id => !matchedChildIds.has(id))
    .map(id => buildTree(id, persons, childrenIndex, visited))
    .filter(Boolean) as TreeNode[]
  if (unmatched.length > 0) {
    marriages.push({ spouse: null, spouseX: -1, descentX: 0, childNodes: unmatched })
  }

  return { person, x: 0, y: 0, subtreeWidth: 0, marriages }
}

// ─── Bottom-up: subtree width ─────────────────────────────────────────────────
//
// Layout rule (Option B):
//   Person card always at the LEFT edge.
//   Each marriage is a "zone" to the right of the person:
//     zoneWidth = max(NODE_W, childrenTotalW)   ← at least wide enough for the spouse card
//   Zones are separated by SPOUSE_SEP.
//   Person and first zone are separated by COUPLE_GAP.
//
//   subtreeWidth = NODE_W + COUPLE_GAP + Σ(zoneWidth_k) + (N−1)×SPOUSE_SEP
//
// Special case — no marriages at all: subtreeWidth = NODE_W (leaf).
// Special case — single no-spouse group: symmetric centered layout.

function cW(childNodes: TreeNode[]): number {
  return childNodes.reduce((s, c, i) => s + c.subtreeWidth + (i > 0 ? H_GAP : 0), 0)
}

function calcSubtreeWidth(node: TreeNode): void {
  for (const m of node.marriages)
    for (const c of m.childNodes) calcSubtreeWidth(c)

  if (node.marriages.length === 0) {
    node.subtreeWidth = NODE_W
    return
  }

  // Single no-spouse group → symmetric (children centered under person)
  if (node.marriages.length === 1 && !node.marriages[0].spouse) {
    node.subtreeWidth = Math.max(NODE_W, cW(node.marriages[0].childNodes))
    return
  }

  // Normal: person-left + spouse zones
  let zonesW = 0
  for (let k = 0; k < node.marriages.length; k++) {
    const zoneW = Math.max(NODE_W, cW(node.marriages[k].childNodes))
    zonesW += zoneW + (k > 0 ? SPOUSE_SEP : 0)
  }
  node.subtreeWidth = NODE_W + COUPLE_GAP + zonesW
}

// ─── Top-down: assign positions ───────────────────────────────────────────────

function assignPositions(node: TreeNode, startX: number, depth: number): void {
  node.y = depth * (NODE_H + V_GAP)

  // Leaf
  if (node.marriages.length === 0) {
    node.x = startX
    return
  }

  // Single no-spouse group → symmetric centered layout
  if (node.marriages.length === 1 && !node.marriages[0].spouse) {
    const m = node.marriages[0]
    const childrenW = cW(m.childNodes)
    const midX = startX + node.subtreeWidth / 2
    node.x = midX - NODE_W / 2
    m.spouseX = -1
    m.descentX = midX
    if (m.childNodes.length > 0) {
      let cx = midX - childrenW / 2
      for (const child of m.childNodes) {
        assignPositions(child, cx, depth + 1)
        cx += child.subtreeWidth + H_GAP
      }
    }
    return
  }

  // Normal: person at left, spouse zones to the right
  node.x = startX
  let rightOff = NODE_W + COUPLE_GAP

  for (let k = 0; k < node.marriages.length; k++) {
    const m = node.marriages[k]
    if (k > 0) rightOff += SPOUSE_SEP

    const childrenW = cW(m.childNodes)
    const zoneW = Math.max(NODE_W, childrenW)

    if (m.spouse) {
      // Spouse card centered in zone; descent from spouse card center
      m.spouseX = startX + rightOff + (zoneW - NODE_W) / 2
      m.descentX = m.spouseX + NODE_W / 2
    } else {
      // No spouse in this group; descent from zone center
      m.spouseX = -1
      m.descentX = startX + rightOff + zoneW / 2
    }

    // Children centered under descentX
    if (m.childNodes.length > 0) {
      let cx = m.descentX - childrenW / 2
      for (const child of m.childNodes) {
        assignPositions(child, cx, depth + 1)
        cx += child.subtreeWidth + H_GAP
      }
    }

    rightOff += zoneW
  }
}

// ─── Collect render data ──────────────────────────────────────────────────────
//
// Option B layout:
//   Person card at node.y (generation row)
//   ↓ vertical drop from person bottom-center
//   ── horizontal trunk at spouseMidY (= node.y + NODE_H + SPOUSE_DROP + NODE_H/2)
//      Spouse cards sit ON this trunk (card top = node.y + NODE_H + SPOUSE_DROP)
//   ↓ vertical from each spouse bottom-center down to child connector
//   ── horizontal child connector
//   ↓ stems to each child

function collect(node: TreeNode, cards: RenderCard[], lines: SvgLine[]): void {
  cards.push({ person: node.person, x: node.x, y: node.y, isSpouse: false })

  // Y positions for spouse row (sits below the person card)
  const spouseTopY   = node.y + NODE_H + SPOUSE_DROP
  const spouseMidY   = spouseTopY + NODE_H / 2   // center of spouse card = trunk Y
  const spouseBotY   = spouseTopY + NODE_H

  const spouseMarriages = node.marriages.filter(m => m.spouse && m.spouseX >= 0)

  if (spouseMarriages.length > 0) {
    const personCenterX     = node.x + NODE_W / 2
    const lastSpouseCenterX = Math.max(...spouseMarriages.map(m => m.spouseX + NODE_W / 2))

    // Vertical: person bottom-center → trunk level
    lines.push({
      x1: personCenterX, y1: node.y + NODE_H,
      x2: personCenterX, y2: spouseMidY,
      isCouple: true,
    })
    // Horizontal trunk: person center → last spouse center (spouses sit on this)
    lines.push({
      x1: personCenterX,     y1: spouseMidY,
      x2: lastSpouseCenterX, y2: spouseMidY,
      isCouple: true,
    })
    // Spouse cards (rendered on top of trunk via z-index)
    for (const m of spouseMarriages) {
      cards.push({ person: m.spouse!, x: m.spouseX, y: spouseTopY, isSpouse: true })
    }
  }

  for (const m of node.marriages) {
    if (m.childNodes.length === 0) continue

    // Connector sits halfway between spouse/person bottom and children top
    const descentStartY = (m.spouse && m.spouseX >= 0) ? spouseBotY : node.y + NODE_H
    const childrenTopY  = m.childNodes[0].y
    const connY         = descentStartY + (childrenTopY - descentStartY) / 2

    // Vertical descent from descentX (spouse center or person center) to connector
    lines.push({
      x1: m.descentX, y1: descentStartY,
      x2: m.descentX, y2: connY,
      isCouple: false,
    })

    // Horizontal connector spanning all child stems + descentX
    const firstCX = m.childNodes[0].x + NODE_W / 2
    const lastCX  = m.childNodes[m.childNodes.length - 1].x + NODE_W / 2
    const connL   = Math.min(m.descentX, firstCX)
    const connR   = Math.max(m.descentX, lastCX)
    if (connL < connR) {
      lines.push({ x1: connL, y1: connY, x2: connR, y2: connY, isCouple: false })
    }

    // Vertical stems: connector → each child top
    for (const child of m.childNodes) {
      const cx = child.x + NODE_W / 2
      lines.push({ x1: cx, y1: connY, x2: cx, y2: child.y, isCouple: false })
      collect(child, cards, lines)
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TreeView() {
  const { data, selectedPersonId, focusedPersonId, selectPerson } = useGiaphaStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const highlightedPersonId = focusedPersonId ?? selectedPersonId

  const { cards, lines, width, height } = useMemo(() => {
    if (!data) return { cards: [], lines: [], width: 0, height: 0 }
    const persons = data.persons
    const childrenIndex = taoChiMucCon(persons)

    // Root = clan member with no known father
    const root =
      Object.values(persons).find(
        p => p.laThanhVienHo && (!p.boId || !persons[p.boId])
      ) ?? Object.values(persons).find(p => !p.boId || !persons[p.boId])

    const visited = new Set<string>()
    const trees: TreeNode[] = []

    if (root) {
      const primaryTree = buildTree(root.id, persons, childrenIndex, visited)
      if (primaryTree) trees.push(primaryTree)
    }

    const extraRoots = Object.values(persons).filter(
      p => !visited.has(p.id) && (!p.boId || !persons[p.boId])
    )
    for (const extraRoot of extraRoots) {
      const tree = buildTree(extraRoot.id, persons, childrenIndex, visited)
      if (tree) trees.push(tree)
    }

    const unvisitedPersons = Object.values(persons).filter(p => !visited.has(p.id))
    for (const person of unvisitedPersons) {
      const tree = buildTree(person.id, persons, childrenIndex, visited)
      if (tree) trees.push(tree)
    }

    if (trees.length === 0) return { cards: [], lines: [], width: 0, height: 0 }

    let startX = 20
    for (const tree of trees) {
      calcSubtreeWidth(tree)
      assignPositions(tree, startX, 0)
      startX += tree.subtreeWidth + FOREST_GAP
    }

    const cards: RenderCard[] = []
    const lines: SvgLine[] = []
    for (const tree of trees) collect(tree, cards, lines)

    const maxX = Math.max(...cards.map(c => c.x)) + NODE_W + 40
    const maxY = Math.max(...cards.map(c => c.y)) + NODE_H + 40

    return { cards, lines, width: maxX, height: maxY }
  }, [data])

  useEffect(() => {
    if (!highlightedPersonId || !containerRef.current) return
    const card = cards.find(c => c.person.id === highlightedPersonId)
    if (!card) return
    containerRef.current.scrollTo({
      left: card.x - containerRef.current.clientWidth / 2 + NODE_W / 2,
      top: card.y - containerRef.current.clientHeight / 2 + NODE_H / 2,
      behavior: 'smooth',
    })
  }, [highlightedPersonId, cards])

  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-400">Chưa có dữ liệu</div>

  const onMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !containerRef.current) return
    event.preventDefault()

    dragStateRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: containerRef.current.scrollLeft,
      startTop: containerRef.current.scrollTop,
    }
    setIsDragging(true)
  }, [])

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging || !containerRef.current) return
    event.preventDefault()

    const deltaX = event.clientX - dragStateRef.current.startX
    const deltaY = event.clientY - dragStateRef.current.startY

    containerRef.current.scrollLeft = dragStateRef.current.startLeft - deltaX
    containerRef.current.scrollTop = dragStateRef.current.startTop - deltaY
  }, [])

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      containerRef.current.scrollLeft -= KEYBOARD_PAN_STEP
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      containerRef.current.scrollLeft += KEYBOARD_PAN_STEP
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      containerRef.current.scrollTop -= KEYBOARD_PAN_STEP
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      containerRef.current.scrollTop += KEYBOARD_PAN_STEP
    }
  }, [])

  const stopDragging = useCallback(() => {
    if (!dragStateRef.current.dragging) return
    dragStateRef.current.dragging = false
    setIsDragging(false)
  }, [])

  useEffect(() => {
    window.addEventListener('mouseup', stopDragging)
    return () => window.removeEventListener('mouseup', stopDragging)
  }, [stopDragging])

  return (
    <div
      ref={containerRef}
      data-testid="tree-view-container"
      className={`flex-1 overflow-auto bg-gray-50 relative ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      tabIndex={0}
      aria-label="Cây gia phả"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      onKeyDown={onKeyDown}
    >
      <div style={{ width, height, position: 'relative' }}>
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none', zIndex: 0 }}
        >
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.isCouple ? '#F97316' : '#3B82F6'}
              strokeWidth={2}
            />
          ))}
        </svg>
        {cards.map((card, i) => (
          <div
            key={`${card.person.id}-${i}`}
            style={{
              position: 'absolute',
              left: card.x,
              top: card.y,
              width: NODE_W,
              zIndex: 1,
              opacity: card.isSpouse ? 0.85 : 1,
            }}
          >
            <PersonCard
              person={card.person}
              isSelected={card.person.id === highlightedPersonId}
              onClick={() => selectPerson(card.person.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
