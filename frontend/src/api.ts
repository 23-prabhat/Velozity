const DEFAULT_API_URL = import.meta.env.PROD
  ? 'https://velozity-jspi.onrender.com/api/v1'
  : 'http://127.0.0.1:4000/api/v1'

const configuredApiUrl = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const API_URL = configuredApiUrl.endsWith('/api/v1') ? configuredApiUrl : `${configuredApiUrl}/api/v1`

type ErrorPayload = { error?: { message?: string; code?: string } }

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ErrorPayload
    throw new ApiError(payload.error?.message || `Request failed (${response.status})`, response.status, payload.error?.code)
  }
  if (response.status === 204) return undefined as T
  const payload = await response.json() as { data: T }
  return payload.data
}

export type SessionUser = { id: string; name: string; email: string; role: 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER'; mustChangePassword: boolean }
export type SessionResult = { accessToken: string; user: SessionUser }

async function csrfToken() {
  return (await apiRequest<{ csrfToken: string }>('/auth/csrf')).csrfToken
}

export async function refreshSession() {
  const csrf = await csrfToken()
  return apiRequest<SessionResult>('/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': csrf } })
}

export async function endSession() {
  const csrf = await csrfToken()
  await apiRequest('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrf } })
}

export const SOCKET_URL = new URL(API_URL).origin
export { API_URL }
