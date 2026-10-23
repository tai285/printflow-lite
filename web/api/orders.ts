import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { OrderStatus } from '../../shared/orderStatus.ts'
import type { Order, OrderDetail } from '../../shared/orders.ts'
import type { CreateOrderRequest } from '../../shared/schemas.ts'
import { ApiError, api } from './client.ts'

export type OrderFilters = { q: string; status: OrderStatus | '' }

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters.q, filters.status],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.status) params.set('status', filters.status)
      const query = params.toString()
      return api<Order[]>(`/api/orders${query ? `?${query}` : ''}`)
    },
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`),
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateOrderRequest) =>
      api<OrderDetail>('/api/orders', { method: 'POST', body: request }),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order)
      return queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useTransition(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (step: { from: OrderStatus; to: OrderStatus }) =>
      api<OrderDetail>(`/api/orders/${encodeURIComponent(id)}/transitions`, {
        method: 'POST',
        body: step,
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', id], order)
      return queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error) => {
      // Someone else changed the order: show the latest version.
      if (error instanceof ApiError && error.status === 409) {
        return queryClient.invalidateQueries({ queryKey: ['order', id] })
      }
    },
  })
}

export function useLoadSamples() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<{ count: number }>('/api/samples', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useRemoveSamples() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<{ count: number }>('/api/samples', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}
