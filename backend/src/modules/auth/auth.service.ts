import { randomUUID, timingSafeEqual } from 'node:crypto'
import { prisma } from '../../db/prisma.js'
import { AppError } from '../../lib/app-error.js'
import { verifyPassword } from '../../lib/password.js'
import { createRefreshToken, hashToken, signAccessToken } from '../../lib/tokens.js'
import { env } from '../../config/env.js'

const sessionExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000)
const safeUser = (user: { id: string; name: string; email: string; role: string; mustChangePassword: boolean }) => ({ id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword })

async function issueSession(userId: string, familyId = randomUUID()) {
  const refreshToken = createRefreshToken()
  const session = await prisma.refreshSession.create({ data: { userId, familyId, tokenHash: hashToken(refreshToken), expiresAt: sessionExpiry() } })
  return { refreshToken, accessToken: await signAccessToken({ userId, sessionId: session.id }), session }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, password))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
  const tokens = await issueSession(user.id)
  return { ...tokens, user: safeUser(user) }
}

export async function rotate(refreshToken: string) {
  const tokenHash = hashToken(refreshToken)
  const existing = await prisma.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } })
  if (!existing) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.')
  if (existing.usedAt || existing.revokedAt) {
    await prisma.refreshSession.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
    throw new AppError(401, 'REFRESH_REPLAY_DETECTED', 'Refresh token reuse detected; the session family was revoked.')
  }
  if (existing.expiresAt <= new Date() || !existing.user.isActive) throw new AppError(401, 'REFRESH_EXPIRED', 'Refresh session has expired.')
  const nextToken = createRefreshToken()
  const next = await prisma.$transaction(async (tx) => {
    const consumed = await tx.refreshSession.updateMany({ where: { id: existing.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date() } })
    if (consumed.count !== 1) throw new AppError(409, 'REFRESH_CONFLICT', 'This refresh token was already consumed.')
    const created = await tx.refreshSession.create({ data: { userId: existing.userId, familyId: existing.familyId, tokenHash: hashToken(nextToken), expiresAt: sessionExpiry() } })
    await tx.refreshSession.update({ where: { id: existing.id }, data: { replacedById: created.id } })
    return created
  })
  return { refreshToken: nextToken, accessToken: await signAccessToken({ userId: existing.userId, sessionId: next.id }), user: safeUser(existing.user) }
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return null
  const session = await prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(refreshToken) } })
  if (session) await prisma.refreshSession.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
  return session?.id ?? null
}

export function csrfMatches(header: string | undefined, cookie: string | undefined) {
  if (!header || !cookie) return false
  const a = Buffer.from(header); const b = Buffer.from(cookie)
  return a.length === b.length && timingSafeEqual(a, b)
}
