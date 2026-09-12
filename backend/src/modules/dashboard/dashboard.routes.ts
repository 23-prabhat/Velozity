import { Priority, Role, TaskStatus } from '@prisma/client'
import { Router } from 'express'
import { prisma } from '../../db/prisma.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { projectWhere, taskWhere } from '../../policies/scopes.js'
import { onlineUserCount } from '../../realtime/presence.js'

export const dashboardRouter = Router()
dashboardRouter.get('/', asyncHandler(async (request, response) => {
  const actor = request.auth!
  const scope = taskWhere(actor)
  const [projectCount, taskCount, overdueCount, statuses, priorities, upcoming] = await Promise.all([
    actor.role === Role.DEVELOPER ? Promise.resolve(0) : prisma.project.count({ where: { AND: [projectWhere(actor), { archivedAt: null }] } }),
    prisma.task.count({ where: scope }),
    prisma.task.count({ where: { AND: [scope, { isOverdue: true }] } }),
    prisma.task.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], where: { AND: [scope, { status: { not: TaskStatus.DONE } }] }, _count: { _all: true } }),
    prisma.task.findMany({ where: { AND: [scope, { status: { not: TaskStatus.DONE }, dueAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } }] }, select: { id: true, number: true, title: true, dueAt: true, priority: true, status: true }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 20 }),
  ])
  const byStatus = Object.fromEntries(Object.values(TaskStatus).map((status) => [status, statuses.find((row) => row.status === status)?._count._all ?? 0]))
  const byPriority = Object.fromEntries(Object.values(Priority).map((priority) => [priority, priorities.find((row) => row.priority === priority)?._count._all ?? 0]))
  response.json({ data: { projectCount, taskCount, overdueCount, byStatus, byPriority, upcoming, ...(actor.role === Role.ADMIN ? { onlineUsers: onlineUserCount() } : {}) } })
}))
