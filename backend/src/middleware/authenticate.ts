import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { AppError } from '../lib/app-error.js'
import { asyncHandler } from '../lib/async-handler.js'
import { verifyAccessToken } from '../lib/tokens.js'

export const authenticate = asyncHandler(async (request, _response, next) => {
  const [scheme, token] = request.header('authorization')?.split(' ') ?? []
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.')
  let claims: Awaited<ReturnType<typeof verifyAccessToken>>
  try { claims = await verifyAccessToken(token) } catch { throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid or expired.') }
  const session = await prisma.refreshSession.findUnique({ where: { id: claims.sessionId }, include: { user: true } })
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.id !== claims.userId) throw new AppError(401, 'SESSION_REVOKED', 'This session is no longer active.')
  request.auth = { userId: session.user.id, sessionId: session.id, role: session.user.role, mustChangePassword: session.user.mustChangePassword }
  next()
})

export const requireRole = (...roles: Role[]): RequestHandler => (request, _response, next) => {
  if (!request.auth) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'))
  if (!roles.includes(request.auth.role)) return next(new AppError(403, 'FORBIDDEN', 'Your role cannot perform this operation.'))
  next()
}

export const requirePasswordChanged: RequestHandler = (request, _response, next) => {
  if (request.auth?.mustChangePassword) return next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before entering the workspace.'))
  next()
}
