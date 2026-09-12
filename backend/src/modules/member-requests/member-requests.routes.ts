import { Router } from 'express'
import { MemberRequestStatus, Role } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { AppError, notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { hashPassword } from '../../lib/password.js'
import { requireRole } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'

export const memberRequestsRouter = Router()
const createSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(255), reason: z.string().trim().min(10).max(1000) }).strict()
const reviewSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal(MemberRequestStatus.REJECTED) }).strict(),
  z.object({ status: z.literal(MemberRequestStatus.APPROVED), temporaryPassword: z.string().min(8).max(200) }).strict(),
])

memberRequestsRouter.get('/', asyncHandler(async (request, response) => {
  const where = request.auth!.role === Role.ADMIN ? {} : { requestedById: request.auth!.userId }
  response.json({ data: await prisma.memberRequest.findMany({ where, include: { requestedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }) })
}))
memberRequestsRouter.post('/', requireRole(Role.PROJECT_MANAGER), validate(createSchema), asyncHandler(async (request, response) => {
  const existing = await prisma.user.findUnique({ where: { email: request.body.email } })
  if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'An account already uses this email.')
  const pending = await prisma.memberRequest.findFirst({ where: { email: request.body.email, status: 'PENDING' } })
  if (pending) throw new AppError(409, 'REQUEST_EXISTS', 'A pending request already exists for this email.')
  response.status(201).json({ data: await prisma.memberRequest.create({ data: { ...request.body, requestedById: request.auth!.userId }, include: { requestedBy: { select: { id: true, name: true } } } }) })
}))
memberRequestsRouter.patch('/:id', requireRole(Role.ADMIN), validate(reviewSchema), asyncHandler(async (request, response) => {
  const id = z.string().uuid().parse(request.params.id)
  const current = await prisma.memberRequest.findUnique({ where: { id } })
  if (!current) throw notFound()
  if (current.status !== 'PENDING') throw new AppError(409, 'REQUEST_REVIEWED', 'This request was already reviewed.')
  const data = await prisma.$transaction(async (tx) => {
    if (request.body.status === 'APPROVED') {
      const exists = await tx.user.findUnique({ where: { email: current.email } })
      if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'An account already uses this email.')
      await tx.user.create({ data: { name: current.name, email: current.email, passwordHash: await hashPassword(request.body.temporaryPassword), role: Role.DEVELOPER, mustChangePassword: true } })
    }
    return tx.memberRequest.update({ where: { id }, data: { status: request.body.status, reviewedById: request.auth!.userId, reviewedAt: new Date() } })
  })
  response.json({ data })
}))
