import { z } from 'zod'

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255), password: z.string().min(8).max(200) }).strict()
export const changePasswordSchema = z.object({ currentPassword: z.string().min(8).max(200), newPassword: z.string().min(8).max(200) }).strict().refine((body) => body.currentPassword !== body.newPassword, { message: 'New password must be different.', path: ['newPassword'] })
