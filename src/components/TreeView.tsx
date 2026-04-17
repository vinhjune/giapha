import { useMemo, useRef, useEffect } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonCard from './PersonCard'
import type { Person } from '../types/giapha'

const NODE_W = 120
const NODE_H = 64
const H_GAP = 20
const V_GAP = 80

interface TreeNode {
  person: Person
  x: number
  y: number
  children: TreeNode[]
}

function buildTree(rootId: string, persons: Record<string, Person>, visited = new Set<string>()): TreeNode | null {
  if (visited.has(rootId)) return null
  visited.add(rootId)
  const person = persons[rootId]
  if (!person) return null
  const children = person.conCaiIds
    .map(id => buildTree(id, persons, visited))
    .filter(Boolean) as TreeNode[]
  return { person, x: 0, y: 0, children }
}

function layoutTree(node: TreeNode, depth: number, counter: { x: number }): void {
  if (node.children.length === 0) {
    node.x = counter.x * (NODE_W + H_GAP)
    node.y = depth * (NODE_H + V_GAP)
    counter.x++
    return
  }
  for (const child of node.children) {
    layoutTree(child, depth + 1, counter)
  }
  const first = node.children[0]
  const last = node.children[node.children.length - 1]
  node.x = (first.x + last.x) / 2
  node.y = depth * (NODE_H + V_GAP)
}

function collectNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node)
  for (const c of node.children) collectNodes(c, acc)
  return acc
}

function collectEdges(node: TreeNode, acc: { x1: number; y1: number; x2: number; y2: number }[] = []) {
  for (const child of node.children) {
    acc.push({
      x1: node.x + NODE_W / 2,
      y1: node.y + NODE_H,
      x2: child.x + NODE_W / 2,
      y2: child.y,
    })
    collectEdges(child, acc)
  }
  return acc
}

export default function TreeView() {
  const { data, selectedPersonId, selectPerson } = useGiaphaStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const { nodes, edges, width, height } = useMemo(() => {
    if (!data) return { nodes: [], edges: [], width: 0, height: 0 }
    const persons = data.persons
    const root = Object.values(persons).find(p => !p.boId || !persons[p.boId])
    if (!root) return { nodes: [], edges: [], width: 0, height: 0 }

    const tree = buildTree(root.id, persons)
    if (!tree) return { nodes: [], edges: [], width: 0, height: 0 }

    const counter = { x: 0 }
    layoutTree(tree, 0, counter)

    const allNodes = collectNodes(tree)
    const allEdges = collectEdges(tree)

    const maxX = Math.max(...allNodes.map(n => n.x)) + NODE_W + 40
    const maxY = Math.max(...allNodes.map(n => n.y)) + NODE_H + 40

    return { nodes: allNodes, edges: allEdges, width: maxX, height: maxY }
  }, [data])

  useEffect(() => {
    if (!selectedPersonId || !containerRef.current) return
    const node = nodes.find(n => n.person.id === selectedPersonId)
    if (!node) return
    containerRef.current.scrollTo({
      left: node.x - containerRef.current.clientWidth / 2 + NODE_W / 2,
      top: node.y - containerRef.current.clientHeight / 2 + NODE_H / 2,
      behavior: 'smooth',
    })
  }, [selectedPersonId, nodes])

  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-400">Chưa có dữ liệu</div>

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-gray-50 relative">
      <div style={{ width, height, position: 'relative' }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="#CBD5E1" strokeWidth={1.5} />
          ))}
        </svg>
        {nodes.map(node => (
          <div key={node.person.id} style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W }}>
            <PersonCard
              person={node.person}
              isSelected={node.person.id === selectedPersonId}
              onClick={() => selectPerson(node.person.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
