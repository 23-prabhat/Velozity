import { Router } from 'express'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { AppError, notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { hashPassword } from '../../lib/password.js'
import { validate } from '../../middleware/validate.js'
import { committedEvents } from '../../realtime/events.js'

export const usersRouter = Router()
const createSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(8).max(200), role: z.enum([Role.PROJECT_MANAGER, Role.DEVELOPER]) }).strict()
const updateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.string().trim().toLowerCase().email().max(255).optional(), password: z.string().min(8).max(200).optional(), role: z.enum([Role.PROJECT_MANAGER, Role.DEVELOPER]).optional(), isActive: z.boolean().optional() }).strict().refine((body) => Object.keys(body).length > 0, 'Supply at least one field.')
const userSelect = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const

usersRouter.get('/', asyncHandler(async (_request, response) => {
  response.json({ data: await prisma.user.findMany({ select: userSelect, orderBy: [{ role: 'asc' }, { name: 'asc' }] }) })
}))

usersRouter.post('/', validate(createSchema), asyncHandler(async (request, response) => {
  const { password, ...input } = request.body
  const exists = await prisma.user.findUnique({ where: { email: input.email } })
  if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'An account already uses this email.')
  const user = await prisma.user.create({ data: { ...input, passwordHash: await hashPassword(password), mustChangePassword: true }, select: userSelect })
  response.status(201).json({ data: user })
}))

usersRouter.patch('/:id', validate(updateSchema), asyncHandler(async (request, response) => {
  const current = await prisma.user.findUnique({ where: { id: z.string().uuid().parse(request.params.id) }, include: { projectsCreated: { where: { archivedAt: null }, select: { id: true } }, assignedTasks: { where: { status: { not: 'DONE' } }, select: { id: true } } } })
  if (!current) throw notFound()
  if (current.role === 'ADMIN' && (request.body.isActive === false || request.body.role)) {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } })
    if (activeAdmins <= 1) throw new AppError(409, 'LAST_ADMIN', 'The final active Admin cannot be deactivated or reassigned.')
  }
  if ((request.body.isActive === false || request.body.role === Role.DEVELOPER) && current.projectsCreated.length) throw new AppError(409, 'ACTIVE_PROJECT_OWNERSHIP', 'Reassign or archive this user’s active projects first.')
  if ((request.body.isActive === false || request.body.role === Role.PROJECT_MANAGER) && current.assignedTasks.length) throw new AppError(409, 'ACTIVE_TASK_ASSIGNMENTS', 'Reassign this user’s active tasks first.')
  const { password, ...changes } = request.body
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: current.id }, data: { ...changes, ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {}) }, select: userSelect })
    if (password || changes.role || changes.isActive === false) await tx.refreshSession.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: new Date() } })
    return updated
  })
  if (password || changes.role || changes.isActive === false) committedEvents.emit('session-revoked', { userId: current.id })
  response.json({ data: user })
}))
