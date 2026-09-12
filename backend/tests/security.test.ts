import { beforeAll, describe, expect, it } from 'vitest'
import { Role } from '@prisma/client'
import { projectWhere, taskWhere } from '../src/policies/scopes.js'

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_ACCESS_SECRET = 'test-secret-with-more-than-thirty-two-characters'
})

describe('security primitives', () => {
  it('hashes passwords with Argon2id and rejects the wrong password', async () => {
    const { hashPassword, verifyPassword } = await import('../src/lib/password.js')
    const hash = await hashPassword('Correct-Horse-2026!')
    expect(hash).toContain('argon2id')
    expect(await verifyPassword(hash, 'Correct-Horse-2026!')).toBe(true)
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false)
  })

  it('signs a short-lived access token with a session id', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../src/lib/tokens.js')
    const token = await signAccessToken({ userId: '10000000-0000-4000-8000-000000000001', sessionId: '20000000-0000-4000-8000-000000000001' })
    await expect(verifyAccessToken(token)).resolves.toMatchObject({ userId: '10000000-0000-4000-8000-000000000001', sessionId: '20000000-0000-4000-8000-000000000001', accessExpiresAt: expect.any(Number) })
    await expect(verifyAccessToken(`${token}x`)).rejects.toThrow()
  })
})

describe('role-owned database scopes', () => {
  it('scopes PMs to projects they created', () => expect(projectWhere({ userId: 'pm-a', role: Role.PROJECT_MANAGER })).toEqual({ createdById: 'pm-a' }))
  it('scopes Developers to only their assigned tasks', () => expect(taskWhere({ userId: 'dev-a', role: Role.DEVELOPER })).toEqual({ assignedDeveloperId: 'dev-a' }))
  it('leaves Admin task scope global', () => expect(taskWhere({ userId: 'admin', role: Role.ADMIN })).toEqual({}))
})
