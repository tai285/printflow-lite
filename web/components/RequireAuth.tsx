import { Navigate, Outlet, useLocation } from 'react-router'
import { useCurrentUser } from '../api/auth.ts'
import { Spinner } from './ui.tsx'

/** Route wrapper: signed-out visitors go to /login and come back afterwards. */
export default function RequireAuth() {
  const user = useCurrentUser()
  const location = useLocation()

  if (user === undefined) return <Spinner label="Checking your session…" />
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
