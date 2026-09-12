import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { z } from 'zod'

dotenv.config({ path: process.env.ENV_FILE ?? resolve(process.cwd(), '../.env') })

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().refine((value) => !value.includes('YOUR-NEON-HOST'), 'Paste the Neon pooled connection string into DATABASE_URL'),
  DIRECT_URL: z.string().url().refine((value) => !value.includes('YOUR-NEON-HOST'), 'Paste the Neon direct connection string into DIRECT_URL'),
  FRONTEND_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  FRONTEND_ORIGINS: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('velozity-api'),
  JWT_AUDIENCE: z.string().default('velozity-web'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_NAME: z.string().default('velozity_refresh'),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  OVERDUE_CRON: z.string().default('* * * * *'),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = result.data
export const allowedOrigins = new Set([
  env.FRONTEND_ORIGIN,
  ...(env.FRONTEND_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []),
])
