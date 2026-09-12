import { Router } from 'express'
import { prisma } from '../../db/prisma.js'
import { asyncHandler } from '../../lib/async-handler.js'

export const lookupsRouter = Router()
lookupsRouter.get('/developers', asyncHandler(async (_request, response) => response.json({ data: await prisma.user.findMany({ where: { role: 'DEVELOPER', isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }) })))
lookupsRouter.get('/clients', asyncHandler(async (_request, response) => response.json({ data: await prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) })))
