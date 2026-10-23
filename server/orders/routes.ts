import { Router } from 'express'
import type { RequestHandler } from 'express'
import { isOrderStatus } from '../../shared/orderStatus.ts'
import {
  validateCreateOrder,
  validateTransition,
} from '../../shared/schemas.ts'
import type { Db } from '../db/client.ts'
import { validationError } from '../http/errors.ts'
import {
  createOrder,
  getOrder,
  listOrders,
  transitionOrder,
} from './service.ts'

/** First value of a query-string parameter, or undefined. */
function queryText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Express types route params as string | string[]; ours is always one string. */
function orderId(params: { id?: string | string[] }): string {
  const id = params.id
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
}

export function ordersRouter(db: Db, writeLimiter: RequestHandler): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const status = queryText(req.query.status)
    if (status !== undefined && status !== '' && !isOrderStatus(status)) {
      throw validationError({ status: 'Unknown status' })
    }
    const orders = await listOrders(db, {
      status: status && isOrderStatus(status) ? status : undefined,
      q: queryText(req.query.q),
    })
    res.json(orders)
  })

  router.post('/', writeLimiter, async (req, res) => {
    const result = validateCreateOrder(req.body)
    if (!result.ok) throw validationError(result.errors)
    const order = await createOrder(db, result.value)
    res.status(201).location(`/api/orders/${order.id}`).json(order)
  })

  router.get('/:id', async (req, res) => {
    res.json(await getOrder(db, orderId(req.params)))
  })

  router.post('/:id/transitions', writeLimiter, async (req, res) => {
    const result = validateTransition(req.body)
    if (!result.ok) throw validationError(result.errors)
    const { from, to } = result.value
    res.json(await transitionOrder(db, orderId(req.params), from, to))
  })

  return router
}
