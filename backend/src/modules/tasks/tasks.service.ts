import { ActivityType, NotificationType, Priority, Role, TaskStatus, type Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { AppError, notFound } from '../../lib/app-error.js'
import { eventTransaction } from '../../lib/event-transaction.js'
import { taskWhere, type Actor } from '../../policies/scopes.js'
import { committedEvents } from '../../realtime/events.js'
import { serializeEvent } from '../activity/activity.service.js'

const includeTask = { project: { select: { id: true, name: true, createdById: true } }, assignedDeveloper: { select: { id: true, name: true, email: true } } } as const
const publish = (event: Parameters<typeof serializeEvent>[0], recipientId?: string) => { const data = serializeEvent(event); committedEvents.emit('activity', data); if (recipientId) committedEvents.emit('notification', { recipientId, event: data }) }
const atKolkataStart = (date: string) => new Date(`${date}T00:00:00+05:30`)
const nextDay = (date: string) => { const value = atKolkataStart(date); value.setUTCDate(value.getUTCDate() + 1); return value }

export async function listTasks(actor: Actor, query: { status?: TaskStatus; priority?: Priority; dueFrom?: string; dueTo?: string; projectId?: string; page: number; pageSize: number }) {
  const where: Prisma.TaskWhereInput = { AND: [taskWhere(actor), ...(query.status ? [{ status: query.status }] : []), ...(query.priority ? [{ priority: query.priority }] : []), ...(query.projectId ? [{ projectId: query.projectId }] : []), ...((query.dueFrom || query.dueTo) ? [{ dueAt: { ...(query.dueFrom ? { gte: atKolkataStart(query.dueFrom) } : {}), ...(query.dueTo ? { lt: nextDay(query.dueTo) } : {}) } }] : [])] }
  const [data, total] = await prisma.$transaction([
    prisma.task.findMany({ where, include: includeTask, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.task.count({ where }),
  ])
  return { data, total }
}

export async function createTask(actor: Actor, projectId: string, input: { assignedDeveloperId: string; title: string; description: string; priority: Priority; dueAt: Date }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, archivedAt: null, AND: [actor.role === Role.ADMIN ? {} : { createdById: actor.userId }] } })
  if (!project) throw notFound()
  const developer = await prisma.user.findFirst({ where: { id: input.assignedDeveloperId, role: Role.DEVELOPER, isActive: true } })
  if (!developer) throw new AppError(400, 'INVALID_ASSIGNEE', 'The assignee must be an active Developer.')
  const result = await eventTransaction(async (tx) => {
    const task = await tx.task.create({ data: { ...input, projectId }, include: includeTask })
    const event = await tx.activityEvent.create({ data: { projectId, taskId: task.id, actorId: actor.userId, type: ActivityType.TASK_ASSIGNED, metadata: { assignedDeveloperId: developer.id, assignedDeveloperName: developer.name } }, include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, task: { select: { id: true, number: true, title: true } } } })
    const notification = await tx.notification.create({ data: { recipientId: developer.id, taskId: task.id, activityEventId: event.id, type: NotificationType.TASK_ASSIGNED } })
    return { task, event, notification }
  })
  publish(result.event, result.notification.recipientId)
  return result.task
}

export async function updateStatus(actor: Actor, id: string, input: { status: TaskStatus; expectedVersion: number }) {
  const current = await prisma.task.findFirst({ where: { id, AND: [taskWhere(actor)] }, include: { project: true } })
  if (!current) throw notFound()
  if (current.status === input.status) return current
  const result = await eventTransaction(async (tx) => {
    const changed = await tx.task.updateMany({ where: { id, version: input.expectedVersion }, data: { status: input.status, version: { increment: 1 }, ...(input.status === TaskStatus.DONE ? { isOverdue: false, overdueMarkedAt: null } : {}) } })
    if (changed.count !== 1) throw new AppError(409, 'VERSION_CONFLICT', 'This task changed since it was loaded. Refresh and try again.')
    const task = await tx.task.findUniqueOrThrow({ where: { id }, include: includeTask })
    const event = await tx.activityEvent.create({ data: { projectId: task.projectId, taskId: id, actorId: actor.userId, type: ActivityType.STATUS_CHANGED, fromStatus: current.status, toStatus: input.status }, include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, task: { select: { id: true, number: true, title: true } } } })
    const notification = input.status === TaskStatus.IN_REVIEW ? await tx.notification.create({ data: { recipientId: current.project.createdById, taskId: id, activityEventId: event.id, type: NotificationType.TASK_IN_REVIEW } }) : null
    return { task, event, notification }
  })
  publish(result.event, result.notification?.recipientId)
  return result.task
}

export async function updateTask(actor: Actor, id: string, input: { expectedVersion: number; assignedDeveloperId?: string; title?: string; description?: string; priority?: Priority; dueAt?: Date }) {
  const current = await prisma.task.findFirst({ where: { id, AND: [taskWhere(actor)] }, include: { project: true } })
  if (!current) throw notFound()
  if (input.assignedDeveloperId) {
    const developer = await prisma.user.findFirst({ where: { id: input.assignedDeveloperId, role: Role.DEVELOPER, isActive: true } })
    if (!developer) throw new AppError(400, 'INVALID_ASSIGNEE', 'The assignee must be an active Developer.')
  }
  const { expectedVersion, ...data } = input
  const result = await eventTransaction(async (tx) => {
    const changed = await tx.task.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 }, ...(data.dueAt && data.dueAt > new Date() ? { isOverdue: false, overdueMarkedAt: null } : {}) } })
    if (changed.count !== 1) throw new AppError(409, 'VERSION_CONFLICT', 'This task changed since it was loaded. Refresh and try again.')
    const task = await tx.task.findUniqueOrThrow({ where: { id }, include: includeTask })
    const reassigned = data.assignedDeveloperId && data.assignedDeveloperId !== current.assignedDeveloperId
    const event = await tx.activityEvent.create({ data: { projectId: task.projectId, taskId: id, actorId: actor.userId, type: reassigned ? ActivityType.TASK_ASSIGNED : ActivityType.TASK_UPDATED, metadata: { fields: Object.keys(data), ...(reassigned ? { fromDeveloperId: current.assignedDeveloperId, toDeveloperId: data.assignedDeveloperId } : {}) } }, include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, task: { select: { id: true, number: true, title: true } } } })
    const notification = reassigned ? await tx.notification.create({ data: { recipientId: data.assignedDeveloperId!, taskId: id, activityEventId: event.id, type: NotificationType.TASK_ASSIGNED } }) : null
    return { task, event, notification, formerAssigneeId: reassigned ? current.assignedDeveloperId : null }
  })
  publish(result.event, result.notification?.recipientId)
  if (result.formerAssigneeId) committedEvents.emit('access-revoked', { userId: result.formerAssigneeId, taskId: id })
  return result.task
}
