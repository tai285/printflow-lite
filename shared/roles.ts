export const USER_ROLES = ['admin', 'staff', 'customer'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** The signed-in user as the API reports it. */
export type SessionUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

/** GET /api/auth/me */
export type MeResponse = SessionUser & {
  /** True when the admin-only demo helpers (sample orders) exist. */
  demoEnabled: boolean
}

/** Admins and staff run the shop; customers only see their own orders. */
export const isStaffRole = (role: UserRole) =>
  role === 'admin' || role === 'staff'
