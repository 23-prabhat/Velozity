const DEFAULT_API_URL = import.meta.env.PROD
  ? 'https://velozity-jspi.onrender.com/api/v1'
  : 'http://127.0.0.1:4000/api/v1'

const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, '')

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

export { API_URL }
