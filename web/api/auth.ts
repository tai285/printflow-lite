import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { MeResponse, SessionUser } from '../../shared/roles.ts'
import { ApiError, api } from './client.ts'

export const ME_KEY = ['me'] as const

/**
 * Forget the user and every cached order. Not queryClient.clear(): that would
 * detach the components watching the user, so they would never see the change.
 */
export function forgetSession(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] })
  queryClient.setQueryData(ME_KEY, null)
}

/**
 * The signed-in user: `undefined` while loading, `null` when signed out.
 * A 401 from /api/auth/me is the normal "not signed in" answer, not an error.
 */
export function useCurrentUser(): MeResponse | null | undefined {
  const { data } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<MeResponse>('/api/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 60_000,
  })
  return data
}

type Credentials = { email: string; password: string }

function useAuthMutation<T>(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => api<SessionUser>(path, { method: 'POST', body }),
    onSuccess: async () => {
      // Drop anything cached for a previous user, then load who we are now.
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== ME_KEY[0],
      })
      await queryClient.invalidateQueries({ queryKey: ME_KEY })
    },
  })
}

export const useLogin = () => useAuthMutation<Credentials>('/api/auth/login')
export const useRegister = () =>
  useAuthMutation<Credentials & { name: string }>('/api/auth/register')

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Whatever the server said, forget the user and their cached orders here.
      forgetSession(queryClient)
    },
  })
}
