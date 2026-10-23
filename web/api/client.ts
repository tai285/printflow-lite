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

/** Typed fetch wrapper: sends/receives JSON and turns error bodies into ApiError. */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers:
        options.body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
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
