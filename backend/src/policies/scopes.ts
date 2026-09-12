import type { Prisma, Role } from '@prisma/client'

export type Actor = { userId: string; role: Role }

export function projectWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (actor.role === 'ADMIN') return {}
  if (actor.role === 'PROJECT_MANAGER') return { createdById: actor.userId }
  return { tasks: { some: { assignedDeveloperId: actor.userId } } }
}

export function taskWhere(actor: Actor): Prisma.TaskWhereInput {
  if (actor.role === 'ADMIN') return {}
  if (actor.role === 'PROJECT_MANAGER') return { project: { createdById: actor.userId } }
  return { assignedDeveloperId: actor.userId }
}

export function activityWhere(actor: Actor): Prisma.ActivityEventWhereInput {
  if (actor.role === 'ADMIN') return {}
  if (actor.role === 'PROJECT_MANAGER') return { project: { createdById: actor.userId } }
  return { task: { assignedDeveloperId: actor.userId } }
}
