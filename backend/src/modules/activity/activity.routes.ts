import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../lib/async-handler.js'
import { listActivity } from './activity.service.js'

export const activityRouter = Router()
const querySchema = z.object({ after: z.string().regex(/^\d+$/).optional(), before: z.string().regex(/^\d+$/).optional(), through: z.string().regex(/^\d+$/).optional(), projectId: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) })

activityRouter.get('/', asyncHandler(async (request, response) => {
  const query = querySchema.parse(request.query)
  const data = await listActivity(request.auth!, query)
  response.json({ data, meta: { limit: query.limit, hasMore: data.length === query.limit } })
}))
