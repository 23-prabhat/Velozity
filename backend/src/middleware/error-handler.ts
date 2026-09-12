import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../lib/app-error.js'

export const notFoundHandler: RequestHandler = (_request, _response, next) => next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'))

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', fieldErrors, requestId: response.locals.requestId } })
    return
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response.status(409).json({ error: { code: 'UNIQUE_CONFLICT', message: 'A record with this unique value already exists.', requestId: response.locals.requestId } })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.', requestId: response.locals.requestId } })
    return
  }
  const status = error instanceof AppError ? error.status : 500
  const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR'
  const message = error instanceof AppError ? error.message : 'An unexpected error occurred.'
  response.status(status).json({ error: { code, message, ...(error instanceof AppError && error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}), requestId: response.locals.requestId } })
}
