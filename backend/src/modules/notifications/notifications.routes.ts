import { NotificationType } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { committedEvents } from '../../realtime/events.js'

export const notificationsRouter = Router()
const visibleWhere = (userId: string) => ({ recipientId: userId, OR: [{ type: NotificationType.TASK_ASSIGNED, task: { assignedDeveloperId: userId } }, { type: NotificationType.TASK_IN_REVIEW, task: { project: { createdById: userId } } }] })

notificationsRouter.get('/', asyncHandler(async (request, response) => {
  const page = z.coerce.number().int().min(1).default(1).parse(request.query.page)
  const pageSize = z.coerce.number().int().min(1).max(100).default(20).parse(request.query.pageSize)
  const where = visibleWhere(request.auth!.userId)
  const [data, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({ where, include: { task: { select: { id: true, number: true, title: true } }, activityEvent: { select: { createdAt: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }), prisma.notification.count({ where: { AND: [where, { readAt: null }] } }),
  ])
  response.json({ data, meta: { page, pageSize, total, unreadCount } })
}))
notificationsRouter.patch('/:id/read', asyncHandler(async (request, response) => {
  const id = z.string().uuid().parse(request.params.id)
  const notification = await prisma.notification.findFirst({ where: { id, AND: [visibleWhere(request.auth!.userId)] } })
  if (!notification) throw notFound()
  const data = await prisma.notification.update({ where: { id }, data: { readAt: notification.readAt ?? new Date() } })
  committedEvents.emit('notification', { recipientId: request.auth!.userId })
  response.json({ data })
}))
notificationsRouter.post('/read-all', asyncHandler(async (request, response) => {
  const watermark = z.object({ through: z.coerce.date() }).strict().parse(request.body).through
  const result = await prisma.notification.updateMany({ where: { AND: [visibleWhere(request.auth!.userId), { readAt: null, createdAt: { lte: watermark } }] }, data: { readAt: new Date() } })
  committedEvents.emit('notification', { recipientId: request.auth!.userId })
  response.json({ data: { updated: result.count, through: watermark } })
}))
