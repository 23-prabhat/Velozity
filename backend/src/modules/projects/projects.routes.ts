import { ActivityType, Role } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { eventTransaction } from '../../lib/event-transaction.js'
import { notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { requireRole } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'
import { projectWhere } from '../../policies/scopes.js'
import { committedEvents } from '../../realtime/events.js'
import { prisma } from '../../db/prisma.js'
import { serializeEvent } from '../activity/activity.service.js'

export const projectsRouter = Router()
const createSchema = z.object({ clientId: z.string().uuid(), name: z.string().trim().min(2).max(180), description: z.string().trim().min(10).max(2000) }).strict()
const patchSchema = z.object({ clientId: z.string().uuid().optional(), name: z.string().trim().min(2).max(180).optional(), description: z.string().trim().min(10).max(2000).optional(), archived: z.boolean().optional() }).strict().refine((body) => Object.keys(body).length > 0)

projectsRouter.use(requireRole(Role.ADMIN, Role.PROJECT_MANAGER))
projectsRouter.get('/', asyncHandler(async (request, response) => {
  const includeArchived = request.query.archived === 'true'
  const data = await prisma.project.findMany({ where: { AND: [projectWhere(request.auth!), ...(includeArchived ? [] : [{ archivedAt: null }])] }, include: { client: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, _count: { select: { tasks: true } } }, orderBy: { createdAt: 'desc' } })
  response.json({ data })
}))
projectsRouter.post('/', validate(createSchema), asyncHandler(async (request, response) => {
  const client = await prisma.client.findFirst({ where: { id: request.body.clientId, archivedAt: null } })
  if (!client) throw notFound()
  const result = await eventTransaction(async (tx) => {
    const project = await tx.project.create({ data: { ...request.body, createdById: request.auth!.userId }, include: { client: { select: { id: true, name: true } } } })
    const event = await tx.activityEvent.create({ data: { projectId: project.id, actorId: request.auth!.userId, type: ActivityType.PROJECT_CREATED, metadata: { projectName: project.name } }, include: { actor: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, task: true } })
    return { project, event }
  })
  committedEvents.emit('activity', serializeEvent(result.event))
  response.status(201).json({ data: result.project })
}))
projectsRouter.get('/:id', asyncHandler(async (request, response) => {
  const project = await prisma.project.findFirst({ where: { id: z.string().uuid().parse(request.params.id), AND: [projectWhere(request.auth!)] }, include: { client: true, createdBy: { select: { id: true, name: true } }, _count: { select: { tasks: true } } } })
  if (!project) throw notFound()
  response.json({ data: project })
}))
projectsRouter.patch('/:id', validate(patchSchema), asyncHandler(async (request, response) => {
  const id = z.string().uuid().parse(request.params.id)
  const existing = await prisma.project.findFirst({ where: { id, AND: [projectWhere(request.auth!)] } })
  if (!existing) throw notFound()
  const { archived, ...data } = request.body
  const project = await prisma.project.update({ where: { id }, data: { ...data, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }) } })
  response.json({ data: project })
}))
