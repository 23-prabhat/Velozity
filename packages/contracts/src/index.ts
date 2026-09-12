export const roles = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'] as const
export const taskStatuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const
export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export type Role = (typeof roles)[number]
export type TaskStatus = (typeof taskStatuses)[number]
export type Priority = (typeof priorities)[number]

export type ApiErrorBody = {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string }
}

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
