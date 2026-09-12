import { Role } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { requireRole } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'
import { taskWhere } from '../../policies/scopes.js'
import { taskCreateSchema, taskPatchSchema, statusSchema, taskQuerySchema } from './task.schemas.js'
import { createTask, listTasks, updateStatus, updateTask } from './tasks.service.js'

export const tasksRouter = Router()
export const projectTasksRouter = Router({ mergeParams: true })

tasksRouter.get('/', asyncHandler(async (request, response) => {
  const query = taskQuerySchema.parse(request.query)
  const result = await listTasks(request.auth!, query)
  response.json({ data: result.data, meta: { page: query.page, pageSize: query.pageSize, total: result.total } })
}))
tasksRouter.get('/:id', asyncHandler(async (request, response) => {
  const task = await prisma.task.findFirst({ where: { id: z.string().uuid().parse(request.params.id), AND: [taskWhere(request.auth!)] }, include: { project: { select: { id: true, name: true } }, assignedDeveloper: { select: { id: true, name: true, email: true } } } })
  if (!task) throw notFound()
  response.json({ data: task })
}))
tasksRouter.patch('/:id', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), validate(taskPatchSchema), asyncHandler(async (request, response) => response.json({ data: await updateTask(request.auth!, z.string().uuid().parse(request.params.id), request.body) })))
tasksRouter.patch('/:id/status', validate(statusSchema), asyncHandler(async (request, response) => response.json({ data: await updateStatus(request.auth!, z.string().uuid().parse(request.params.id), request.body) })))
tasksRouter.get('/:id/activity', asyncHandler(async (request, response) => {
  const id = z.string().uuid().parse(request.params.id)
  const visible = await prisma.task.findFirst({ where: { id, AND: [taskWhere(request.auth!)] }, select: { id: true } })
  if (!visible) throw notFound()
  const data = await prisma.activityEvent.findMany({ where: { taskId: id }, orderBy: { sequence: 'desc' }, take: 100, include: { actor: { select: { id: true, name: true } } } })
  response.json({ data: data.map((event) => ({ ...event, sequence: event.sequence.toString() })) })
}))

projectTasksRouter.get('/', asyncHandler(async (request, response) => {
  const query = taskQuerySchema.parse({ ...request.query, projectId: request.params.projectId })
  const result = await listTasks(request.auth!, query)
  response.json({ data: result.data, meta: { page: query.page, pageSize: query.pageSize, total: result.total } })
}))
projectTasksRouter.post('/', requireRole(Role.ADMIN, Role.PROJECT_MANAGER), validate(taskCreateSchema), asyncHandler(async (request, response) => {
  const task = await createTask(request.auth!, z.string().uuid().parse(request.params.projectId), request.body)
  response.status(201).json({ data: task })
}))
