import type { Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { activityWhere, type Actor } from '../../policies/scopes.js'

export const serializeEvent = (event: { sequence: bigint; [key: string]: unknown }) => ({ ...event, sequence: event.sequence.toString() })

export async function listActivity(actor: Actor, input: { after?: string; before?: string; through?: string; projectId?: string; limit: number }) {
  const cursorWhere: Prisma.ActivityEventWhereInput = {
    ...(input.after ? { sequence: { gt: BigInt(input.after) } } : {}),
    ...(input.before ? { sequence: { lt: BigInt(input.before) } } : {}),
    ...(input.through ? { sequence: { lte: BigInt(input.through) } } : {}),
  }
  const rows = await prisma.activityEvent.findMany({
    where: { AND: [activityWhere(actor), cursorWhere, ...(input.projectId ? [{ projectId: input.projectId }] : [])] },
    orderBy: { sequence: 'desc' },
    take: input.limit,
    include: { actor: { select: { id: true, name: true } }, task: { select: { id: true, number: true, title: true } }, project: { select: { id: true, name: true } } },
  })
  return rows.map(serializeEvent)
}
