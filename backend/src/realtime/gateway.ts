import type { Server as HttpServer } from 'node:http'
import { Role } from '@prisma/client'
import { Server } from 'socket.io'
import { z } from 'zod'
import { allowedOrigins } from '../config/env.js'
import { prisma } from '../db/prisma.js'
import { verifyAccessToken } from '../lib/tokens.js'
import { activityWhere, projectWhere } from '../policies/scopes.js'
import { committedEvents } from './events.js'
import { userConnected, userDisconnected } from './presence.js'

export function createGateway(server: HttpServer) {
  const io = new Server(server, { transports: ['websocket'], allowUpgrades: false, cors: { origin: [...allowedOrigins], credentials: true } })

  io.use(async (socket, next) => {
    try {
      if (!socket.handshake.headers.origin || !allowedOrigins.has(socket.handshake.headers.origin)) throw new Error('Origin rejected')
      const claims = await verifyAccessToken(String(socket.handshake.auth.accessToken ?? ''))
      const session = await prisma.refreshSession.findUnique({ where: { id: claims.sessionId }, include: { user: true } })
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.mustChangePassword || session.userId !== claims.userId) throw new Error('Session inactive')
      socket.data.auth = { userId: session.userId, sessionId: session.id, role: session.user.role }
      socket.data.accessExpiresAt = claims.accessExpiresAt
      next()
    } catch { next(new Error('UNAUTHENTICATED')) }
  })

  io.on('connection', (socket) => {
    const actor = socket.data.auth as { userId: string; sessionId: string; role: Role }
    socket.join(`user:${actor.userId}`)
    socket.join(`session:${actor.sessionId}`)
    if (actor.role === Role.ADMIN) socket.join('admins')
    const count = userConnected(actor.userId, socket.id)
    io.to('admins').emit('presence.changed', { onlineUsers: count })

    socket.on('project.subscribe', async (projectId: string, acknowledge: (result: { ok: boolean; code?: string }) => void) => {
      const parsedId = z.string().uuid().safeParse(projectId)
      if (!parsedId.success) return acknowledge({ ok: false, code: 'INVALID_PROJECT_ID' })
      const project = await prisma.project.findFirst({ where: { id: parsedId.data, AND: [projectWhere(actor)] }, select: { id: true } })
      if (!project || actor.role === Role.DEVELOPER) return acknowledge({ ok: false, code: 'NOT_FOUND' })
      await socket.join(`project:${project.id}`); acknowledge({ ok: true })
    })
    socket.on('feed.watermark', async (acknowledge: (result: { sequence: string }) => void) => {
      const event = await prisma.activityEvent.findFirst({ where: activityWhere(actor), orderBy: { sequence: 'desc' }, select: { sequence: true } })
      acknowledge({ sequence: (event?.sequence ?? 0n).toString() })
    })
    const expiryTimer = setTimeout(() => { socket.emit('session.expired'); socket.disconnect(true) }, Math.max(0, Number(socket.data.accessExpiresAt) - Date.now()))
    socket.on('disconnect', () => { clearTimeout(expiryTimer); io.to('admins').emit('presence.changed', { onlineUsers: userDisconnected(actor.userId, socket.id) }) })
  })

  const onActivity = async (event: Record<string, unknown>) => {
    const taskId = typeof event.taskId === 'string' ? event.taskId : undefined
    const projectId = String(event.projectId)
    const task = taskId ? await prisma.task.findUnique({ where: { id: taskId }, select: { assignedDeveloperId: true, project: { select: { createdById: true } } } }) : null
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { createdById: true } })
    let recipients = io.to('admins').to(`project:${projectId}`)
    if (project) recipients = recipients.to(`user:${project.createdById}`)
    if (task) recipients = recipients.to(`user:${task.assignedDeveloperId}`)
    recipients.emit('activity.created', event)
  }
  const onNotification = ({ recipientId }: { recipientId: string }) => io.to(`user:${recipientId}`).emit('notifications.changed', { reason: 'created' })
  const onRevoked = ({ userId, taskId }: { userId: string; taskId: string }) => io.to(`user:${userId}`).emit('task.access-revoked', { taskId })
  const onSessionRevoked = ({ userId, sessionId }: { userId?: string; sessionId?: string }) => {
    const room = userId ? `user:${userId}` : `session:${sessionId}`
    io.to(room).emit('session.revoked'); io.in(room).disconnectSockets(true)
  }
  committedEvents.on('activity', onActivity)
  committedEvents.on('notification', onNotification)
  committedEvents.on('access-revoked', onRevoked)
  committedEvents.on('session-revoked', onSessionRevoked)
  io.engine.on('close', () => { committedEvents.off('activity', onActivity); committedEvents.off('notification', onNotification); committedEvents.off('access-revoked', onRevoked); committedEvents.off('session-revoked', onSessionRevoked) })
  return io
}
