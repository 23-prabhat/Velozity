import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { allowedOrigins, env } from '../../config/env.js'
import { prisma } from '../../db/prisma.js'
import { AppError } from '../../lib/app-error.js'
import { asyncHandler } from '../../lib/async-handler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { validate } from '../../middleware/validate.js'
import { csrfMatches, login, logout, rotate } from './auth.service.js'
import { changePasswordSchema, loginSchema } from './auth.schemas.js'
import { committedEvents } from '../../realtime/events.js'

export const authRouter = Router()
const refreshCookie = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, path: '/api/v1/auth', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 } as const
const requireApprovedOrigin = (origin?: string) => { if (origin && !allowedOrigins.has(origin)) throw new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.') }
const requireCsrf = (request: Parameters<Parameters<typeof authRouter.post>[1]>[0]) => {
  requireApprovedOrigin(request.header('origin'))
  if (!csrfMatches(request.header('x-csrf-token'), request.cookies.velozity_csrf)) throw new AppError(403, 'CSRF_REJECTED', 'CSRF validation failed.')
}

authRouter.get('/csrf', (_request, response) => {
  const token = randomBytes(24).toString('base64url')
  response.cookie('velozity_csrf', token, { httpOnly: false, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, path: '/api/v1/auth' })
  response.json({ data: { csrfToken: token } })
})

authRouter.post('/login', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }), validate(loginSchema), asyncHandler(async (request, response) => {
  requireApprovedOrigin(request.header('origin'))
  const result = await login(request.body.email, request.body.password)
  response.cookie(env.COOKIE_NAME, result.refreshToken, refreshCookie)
  response.json({ data: { accessToken: result.accessToken, user: result.user } })
}))

authRouter.post('/refresh', asyncHandler(async (request, response) => {
  requireCsrf(request)
  const token = request.cookies[env.COOKIE_NAME]
  if (!token) throw new AppError(401, 'REFRESH_REQUIRED', 'Refresh cookie is missing.')
  const result = await rotate(token)
  response.cookie(env.COOKIE_NAME, result.refreshToken, refreshCookie)
  response.json({ data: { accessToken: result.accessToken, user: result.user } })
}))

authRouter.post('/logout', asyncHandler(async (request, response) => {
  requireCsrf(request)
  const sessionId = await logout(request.cookies[env.COOKIE_NAME])
  if (sessionId) committedEvents.emit('session-revoked', { sessionId })
  response.clearCookie(env.COOKIE_NAME, refreshCookie)
  response.clearCookie('velozity_csrf', { path: '/api/v1/auth' })
  response.status(204).send()
}))

authRouter.get('/me', authenticate, asyncHandler(async (request, response) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: request.auth!.userId }, select: { id: true, name: true, email: true, role: true, mustChangePassword: true } })
  response.json({ data: user })
}))

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(async (request, response) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: request.auth!.userId } })
  if (!(await verifyPassword(user.passwordHash, request.body.currentPassword))) throw new AppError(400, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.')
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(request.body.newPassword), mustChangePassword: false } }),
    prisma.refreshSession.updateMany({ where: { userId: user.id, id: { not: request.auth!.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
  ])
  response.status(204).send()
}))
