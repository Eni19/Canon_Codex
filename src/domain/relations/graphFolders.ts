import { z } from 'zod'
import { CARD_HEIGHT, CARD_WIDTH, type Point } from './graphGeometry'
import type { Relation } from './relation'

export const FolderNameSchema = z.string().trim().min(1).max(80)
export const folderNameKey = (name: string) => name.trim().toLocaleLowerCase('pt-BR')

export const GraphFoldersSchema = z.array(z.object({
  id: z.uuid(),
  name: FolderNameSchema,
  collapsed: z.boolean(),
  members: z.array(z.uuid()),
}).strict()).superRefine((folders, context) => {
  const ids = new Set<string>()
  const names = new Set<string>()
  const members = new Set<string>()
  folders.forEach((folder, index) => {
    const name = folderNameKey(folder.name)
    if (ids.has(folder.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Pasta repetida.' })
    if (names.has(name)) context.addIssue({ code: 'custom', path: [index, 'name'], message: 'Nome de pasta repetido.' })
    ids.add(folder.id)
    names.add(name)
    folder.members.forEach((id, memberIndex) => {
      if (members.has(id)) context.addIssue({ code: 'custom', path: [index, 'members', memberIndex], message: 'O registro já está em uma pasta.' })
      members.add(id)
    })
  })
})

export type GraphFolder = z.infer<typeof GraphFoldersSchema>[number]
export class InvalidFolderMemberError extends Error {}

export function indexGraphFolders(folders: GraphFolder[]) {
  return new Map(folders.flatMap((folder) => folder.members.map((id) => [id, folder] as const)))
}

export function moveFolderMembers(folders: GraphFolder[], ids: readonly string[], destination: string) {
  if (destination && !folders.some((folder) => folder.id === destination)) return folders
  const moving = new Set(ids)
  return folders.map((folder) => {
    if (folder.id === destination) return { ...folder, members: [...new Set([...folder.members, ...moving])] }
    const members = folder.members.filter((id) => !moving.has(id))
    return members.length === folder.members.length ? folder : { ...folder, members }
  })
}

export function folderPositions(folders: GraphFolder[], positions: Record<string, Point>, activeIds: ReadonlySet<string>) {
  const points = new Map<string, Point>()
  if (!folders.length) return points
  const occupied = new Map<string, Point[]>()
  const width = CARD_WIDTH + 8, height = CARD_HEIGHT + 8
  const cell = (point: Point) => [Math.floor(point.x / width), Math.floor(point.y / height)]
  const reserve = (point: Point) => {
    const key = cell(point).join('/')
    const bucket = occupied.get(key)
    if (bucket) bucket.push(point)
    else occupied.set(key, [point])
  }
  const overlaps = (point: Point) => {
    const [x, y] = cell(point)
    for (let row = y - 1; row <= y + 1; row++) for (let col = x - 1; col <= x + 1; col++) {
      if (occupied.get(`${col}/${row}`)?.some((p) => Math.abs(p.x - point.x) < width && Math.abs(p.y - point.y) < height)) return true
    }
    return false
  }
  let top = 0
  for (const id of activeIds) {
    const point = positions[id]
    if (point) { reserve(point); top = Math.min(top, point.y) }
  }
  let empty = 0
  for (const folder of folders) {
    const anchor = folder.members.reduce<Point | undefined>((best, id) => {
      const point = positions[id]
      if (!point || !activeIds.has(id)) return best
      return !best || point.y < best.y || (point.y === best.y && point.x < best.x) ? point : best
    }, undefined)
    const point = anchor
      ? { x: anchor.x, y: anchor.y - CARD_HEIGHT - 10 }
      : { x: (empty++ * (CARD_WIDTH + 40)), y: top - 2 * CARD_HEIGHT - 28 }
    while (overlaps(point)) point.y -= height
    points.set(folder.id, point)
    reserve(point)
  }
  return points
}

export function externalFolderLinks(relations: Relation[], membership: ReadonlyMap<string, GraphFolder>) {
  const links = new Map<string, Relation[]>()
  for (const relation of relations) {
    const source = membership.get(relation.sourceId)?.id
    const target = membership.get(relation.targetId)?.id
    if (source === target) continue
    if (source) {
      const list = links.get(source) ?? []
      list.push(relation)
      links.set(source, list)
    }
    if (target) {
      const list = links.get(target) ?? []
      list.push(relation)
      links.set(target, list)
    }
  }
  return links
}
