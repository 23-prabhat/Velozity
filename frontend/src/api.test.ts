import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('sends bearer authentication and credentials to the versioned route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest<{ ok: boolean }>('/dashboard', {}, 'access-token')).resolves.toEqual({ ok: true })
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/dashboard$/)
    expect(options.credentials).toBe('include')
    expect(options.headers.authorization).toBe('Bearer access-token')
  })

  it('surfaces the backend structured error message and code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Your role cannot perform this operation.' } }), { status: 403 })))
    const error = await apiRequest('/projects', {}, 'token').catch((reason) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Your role cannot perform this operation.' })
  })
})
