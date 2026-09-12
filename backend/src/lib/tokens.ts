import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env.js'

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET)

export const createRefreshToken = () => randomBytes(48).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function signAccessToken(input: { userId: string; sessionId: string }) {
  return new SignJWT({ sid: input.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret)
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE })
  if (!payload.sub || typeof payload.sid !== 'string') throw new Error('Malformed token')
  return { userId: payload.sub, sessionId: payload.sid, accessExpiresAt: payload.exp ? payload.exp * 1000 : Date.now() }
}
