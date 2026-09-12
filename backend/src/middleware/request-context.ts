import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export const requestContext: RequestHandler = (request, response, next) => {
  const requestId = request.header('x-request-id') || randomUUID()
  response.locals.requestId = requestId
  response.setHeader('x-request-id', requestId)
  response.setHeader('cache-control', 'no-store')
  next()
}
