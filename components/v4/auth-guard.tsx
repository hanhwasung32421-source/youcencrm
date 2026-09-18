'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/session/authed-fetch'
import { fetchMe } from '@/lib/session/me-client'
import { HOME_HREF, LOGIN_HREF, findMenuByPath, isAdminRole } from '@/lib/v4/menu'
import { V4MeProvider, type V4Me } from '@/components/v4/me-context'

// 역할(role_type)만으로 접근을 판단한다. 공용 백엔드의 메뉴 권한(allowedMenuKeys)은
// 옛 메뉴 키만 알고 있으므로 V4에서는 전혀 참조하지 않는다.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<V4Me | null>(null)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) {
          router.replace(LOGIN_HREF)
          return
        }
        let data: Awaited<ReturnType<typeof fetchMe>>
        try {
          data = await fetchMe(accessToken)
        } catch {
          router.replace(LOGIN_HREF)
          return
        }
        if (cancelled) return

        const menu = findMenuByPath(pathname)
        const admin = isAdminRole(data.roleType)
        if (menu && menu.audience === 'admin' && !admin) {
          router.replace(HOME_HREF)
          return
        }
        if (menu && menu.audience === 'staff' && admin) {
          router.replace(HOME_HREF)
          return
        }

        setMe({ crmUserId: data.crmUserId, name: data.name, roleType: data.roleType, roleName: data.roleName || data.roleType })
        setAllowed(true)
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

  if (!allowed || !me) {
    return null
  }

  return <V4MeProvider value={me}>{children}</V4MeProvider>
}
