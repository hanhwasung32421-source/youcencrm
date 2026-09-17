// 로그인 직후 같은 화면에서 AuthGuard/AppShell/Topbar가 각자 /api/auth/me를
// 따로 호출하면서 로딩이 느려지는 문제가 있었다. 같은 토큰으로 들어온 요청은
// 진행 중인 요청을 공유하고, 짧은 시간 동안은 결과를 재사용한다.

export type Me = {
  crmUserId: string
  roleType: string
  roleCode: string
  roleName: string
  name: string
  employmentStatus: string
  allowedMenuKeys: string[]
}

const CACHE_TTL_MS = 15000

let inflight: { token: string; promise: Promise<Me> } | null = null
let cached: { token: string; value: Me; expiresAt: number } | null = null

export function fetchMe(token: string): Promise<Me> {
  const now = Date.now()
  if (cached && cached.token === token && cached.expiresAt > now) {
    return Promise.resolve(cached.value)
  }
  if (inflight && inflight.token === token) {
    return inflight.promise
  }

  const promise = fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '프로필 조회에 실패했습니다.')
      cached = { token, value: data as Me, expiresAt: Date.now() + CACHE_TTL_MS }
      return data as Me
    })
    .finally(() => {
      if (inflight?.token === token) inflight = null
    })

  inflight = { token, promise }
  return promise
}

export function clearMeCache() {
  cached = null
  inflight = null
}
