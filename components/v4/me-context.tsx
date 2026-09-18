'use client'

import { createContext, useContext } from 'react'
import { isAdminRole } from '@/lib/v4/menu'

export type V4Me = {
  crmUserId: string
  name: string
  roleType: string
  roleName: string
}

const V4MeContext = createContext<V4Me | null>(null)

export const V4MeProvider = V4MeContext.Provider

export function useV4Me() {
  const me = useContext(V4MeContext)
  return { me, isAdmin: isAdminRole(me?.roleType) }
}
