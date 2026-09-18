'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { fetchMe } from '@/lib/session/me-client'
import { getHomeHref, getMenuByPath, isAdminRole } from '@/lib/v3/menu'

export type V3Me = {
  crmUserId: string
  name: string
  roleType: string
  roleName: string
  isAdmin: boolean
}

const V3SessionContext = createContext<V3Me | null>(null)

export function useV3Me() {
  return useContext(V3SessionContext)
}

// 역할(roleType)만으로 접근을 판단한다. super_admin/admin = 관리자, 그 외 = 직원.
// 관리자 전용 메뉴에 직원이 들어오면 직원 홈(/v3/my-settlement)으로 돌려보낸다.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<V3Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) {
          router.replace('/v3/login')
          return
        }

        let profile: Awaited<ReturnType<typeof fetchMe>>
        try {
          profile = await fetchMe(accessToken)
        } catch {
          router.replace('/v3/login')
          return
        }
        if (cancelled) return

        const isAdmin = isAdminRole(profile.roleType)
        const menu = getMenuByPath(pathname)
        if (menu && menu.audience === 'admin' && !isAdmin) {
          router.replace(getHomeHref(profile.roleType))
          return
        }

        setMe({
          crmUserId: profile.crmUserId,
          name: profile.name,
          roleType: profile.roleType,
          roleName: profile.roleName || profile.roleType,
          isAdmin
        })
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '인증 확인 중 오류가 발생했습니다.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (error) {
    return <div className="message-error">{error}</div>
  }

  if (!me) {
    return null
  }

  return <V3SessionContext.Provider value={me}>{children}</V3SessionContext.Provider>
}
