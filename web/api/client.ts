import type { ApiErrorBody } from '../../shared/orders.ts'

/** An error returned by the API (or a failure to reach it, status 0). */
export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

let onUnauthorized: (() => void) | undefined

/** Called when a non-auth request comes back 401 (session expired or ended elsewhere). */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler
}

/** Typed fetch wrapper: sends/receives JSON and turns error bodies into ApiError. */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(path, {
      method,
      // The session cookie is sent automatically (same origin). Every write
      // also carries a custom header, which the server requires (CSRF defence).
      credentials: 'same-origin',
      headers: {
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'X-Requested-With': 'printflow' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'Cannot reach the server. Check that it is running and try again.',
    )
  }

  const text = await response.text()
  let data: unknown
  try {
    data = text === '' ? undefined : JSON.parse(text)
  } catch {
    data = undefined
  }

  if (!response.ok) {
    // /api/auth/* answers 401 for bad credentials; the login form shows that itself.
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      onUnauthorized?.()
    }
    const error = (data as Partial<ApiErrorBody> | undefined)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed (${response.status})`,
      error?.fields,
    )
  }
  return data as T
}
