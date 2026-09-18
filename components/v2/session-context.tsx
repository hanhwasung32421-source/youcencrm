'use client'

import { createContext, useContext } from 'react'

// AuthGuard가 한 번 조회한 프로필을 셸/페이지가 다시 /api/auth/me를 부르지 않고 공유한다.
export type V2Me = {
  crmUserId: string
  name: string
  roleType: string
  roleName: string
  isAdmin: boolean
}

const FALLBACK_ME: V2Me = { crmUserId: '', name: '', roleType: 'staff', roleName: '', isAdmin: false }

const V2SessionContext = createContext<V2Me | null>(null)

export function V2SessionProvider({ me, children }: { me: V2Me; children: React.ReactNode }) {
  return <V2SessionContext.Provider value={me}>{children}</V2SessionContext.Provider>
}

export function useV2Me(): V2Me {
  return useContext(V2SessionContext) || FALLBACK_ME
}
