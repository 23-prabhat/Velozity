import { Priority, TaskStatus } from '@prisma/client'
import { z } from 'zod'

export const taskCreateSchema = z.object({ assignedDeveloperId: z.string().uuid(), title: z.string().trim().min(2).max(240), description: z.string().trim().min(5).max(3000), priority: z.nativeEnum(Priority), dueAt: z.coerce.date() }).strict()
export const taskPatchSchema = z.object({ expectedVersion: z.number().int().positive(), assignedDeveloperId: z.string().uuid().optional(), title: z.string().trim().min(2).max(240).optional(), description: z.string().trim().min(5).max(3000).optional(), priority: z.nativeEnum(Priority).optional(), dueAt: z.coerce.date().optional() }).strict()
export const statusSchema = z.object({ status: z.nativeEnum(TaskStatus), expectedVersion: z.number().int().positive() }).strict()
export const taskQuerySchema = z.object({ status: z.nativeEnum(TaskStatus).optional(), priority: z.nativeEnum(Priority).optional(), dueFrom: z.string().date().optional(), dueTo: z.string().date().optional(), projectId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).refine((value) => !value.dueFrom || !value.dueTo || value.dueFrom <= value.dueTo, { message: 'dueFrom must not be after dueTo', path: ['dueTo'] })
