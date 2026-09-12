import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/prisma.js'
import { notFound } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { validate } from '../../middleware/validate.js'

export const clientsRouter = Router()
const bodySchema = z.object({ name: z.string().trim().min(2).max(160), contactName: z.string().trim().max(120).nullable().optional(), contactEmail: z.string().trim().toLowerCase().email().max(255).nullable().optional() }).strict()
const patchSchema = bodySchema.partial().extend({ archived: z.boolean().optional() }).refine((body) => Object.keys(body).length > 0)

clientsRouter.get('/', asyncHandler(async (_request, response) => response.json({ data: await prisma.client.findMany({ where: { archivedAt: null }, include: { _count: { select: { projects: true } } }, orderBy: { name: 'asc' } }) })))
clientsRouter.post('/', validate(bodySchema), asyncHandler(async (request, response) => {
  const client = await prisma.client.create({ data: { ...request.body, createdById: request.auth!.userId } })
  response.status(201).json({ data: client })
}))
clientsRouter.get('/:id', asyncHandler(async (request, response) => {
  const client = await prisma.client.findUnique({ where: { id: z.string().uuid().parse(request.params.id) }, include: { projects: { where: { archivedAt: null }, select: { id: true, name: true } } } })
  if (!client) throw notFound()
  response.json({ data: client })
}))
clientsRouter.patch('/:id', validate(patchSchema), asyncHandler(async (request, response) => {
  const { archived, ...data } = request.body
  try { response.json({ data: await prisma.client.update({ where: { id: z.string().uuid().parse(request.params.id) }, data: { ...data, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }) } }) }) } catch { throw notFound() }
}))
