import { ActivityType, TaskStatus } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { eventTransaction } from '../lib/event-transaction.js'
import { committedEvents } from '../realtime/events.js'
import { serializeEvent } from '../modules/activity/activity.service.js'

export async function markOverdueTasks(now = new Date()) {
  const candidates = await prisma.task.findMany({ where: { dueAt: { lt: now }, status: { not: TaskStatus.DONE }, isOverdue: false, project: { archivedAt: null } }, select: { id: true }, take: 100 })
  let changed = 0
  for (const candidate of candidates) {
    const event = await eventTransaction(async (tx) => {
      const updated = await tx.task.updateMany({ where: { id: candidate.id, dueAt: { lt: now }, status: { not: TaskStatus.DONE }, isOverdue: false, project: { archivedAt: null } }, data: { isOverdue: true, overdueMarkedAt: now, version: { increment: 1 } } })
      if (!updated.count) return null
      const task = await tx.task.findUniqueOrThrow({ where: { id: candidate.id } })
      return tx.activityEvent.create({ data: { projectId: task.projectId, taskId: task.id, type: ActivityType.TASK_OVERDUE, metadata: { dueAt: task.dueAt.toISOString() } }, include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, task: { select: { id: true, number: true, title: true } } } })
    })
    if (event) { changed += 1; committedEvents.emit('activity', serializeEvent(event)) }
  }
  return changed
}
