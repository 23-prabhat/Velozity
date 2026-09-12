import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { allowedOrigins } from './config/env.js'
import { checkDatabase } from './db/prisma.js'
import { authenticate, requirePasswordChanged, requireRole } from './middleware/authenticate.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { requestContext } from './middleware/request-context.js'
import { AppError } from './lib/app-error.js'
import { activityRouter } from './modules/activity/activity.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { clientsRouter } from './modules/clients/clients.routes.js'
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js'
import { lookupsRouter } from './modules/lookups/lookups.routes.js'
import { memberRequestsRouter } from './modules/member-requests/member-requests.routes.js'
import { notificationsRouter } from './modules/notifications/notifications.routes.js'
import { projectsRouter } from './modules/projects/projects.routes.js'
import { projectTasksRouter, tasksRouter } from './modules/tasks/tasks.routes.js'
import { usersRouter } from './modules/users/users.routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true, allowedHeaders: ['content-type', 'authorization', 'x-csrf-token', 'x-request-id'] }))
  app.use(requestContext)
  app.use(express.json({ limit: '128kb' }))
  app.use(cookieParser())
  app.use((request, _response, next) => {
    const origin = request.header('origin')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin && !allowedOrigins.has(origin)) return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.'))
    next()
  })

  app.get('/api/v1/health/live', (_request, response) => response.json({ data: { status: 'ok' } }))
  app.get('/api/v1/health/ready', async (_request, response, next) => { try { await checkDatabase(); response.json({ data: { status: 'ready' } }) } catch (error) { next(error) } })
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1', authenticate)
  app.use('/api/v1', requirePasswordChanged)
  app.use('/api/v1/users', requireRole('ADMIN'), usersRouter)
  app.use('/api/v1/clients', requireRole('ADMIN'), clientsRouter)
  app.use('/api/v1/lookups', requireRole('ADMIN', 'PROJECT_MANAGER'), lookupsRouter)
  app.use('/api/v1/projects/:projectId/tasks', projectTasksRouter)
  app.use('/api/v1/projects', projectsRouter)
  app.use('/api/v1/tasks', tasksRouter)
  app.use('/api/v1/activity', activityRouter)
  app.use('/api/v1/notifications', notificationsRouter)
  app.use('/api/v1/dashboard', dashboardRouter)
  app.use('/api/v1/member-requests', requireRole('ADMIN', 'PROJECT_MANAGER'), memberRequestsRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
