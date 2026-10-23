import type { ErrorRequestHandler, RequestHandler } from 'express'
import type { ApiErrorBody, ApiErrorCode } from '../../shared/orders.ts'

/** An error that is safe to show to the API client. */
export class AppError extends Error {
  status: number
  code: ApiErrorCode
  fields?: Record<string, string>

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const validationError = (fields: Record<string, string>) =>
  new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', fields)

export const notFound = (what = 'Resource') =>
  new AppError(404, 'NOT_FOUND', `${what} not found`)

function body(error: ApiErrorBody['error']): ApiErrorBody {
  return { error }
}

/** Unknown /api routes get a JSON 404 instead of Express's HTML page. */
export const apiNotFound: RequestHandler = (_req, _res, next) => {
  next(notFound('Route'))
}

/** Turns any thrown error into the standard { error: { code, message, fields? } } body. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json(body({ code: err.code, message: err.message, fields: err.fields }))
    return
  }

  // Errors raised by body-parser, which carry a status and a `type`.
  const type = (err as { type?: string }).type
  if (type === 'entity.parse.failed') {
    res.status(400).json(
      body({
        code: 'VALIDATION_ERROR',
        message: 'Request body is not valid JSON',
      }),
    )
    return
  }
  if (type === 'entity.too.large') {
    res.status(413).json(
      body({
        code: 'VALIDATION_ERROR',
        message: 'Request body is too large',
      }),
    )
    return
  }

  console.error('Unhandled error:', err)
  res
    .status(500)
    .json(body({ code: 'INTERNAL_ERROR', message: 'Something went wrong' }))
}
