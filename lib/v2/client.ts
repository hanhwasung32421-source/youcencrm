'use client'

import { authedFetchJson, type AuthedJsonResult } from '@/lib/session/authed-fetch'

// 공용 authed-fetch에는 POST만 있어서 V2에서 쓰는 PATCH/DELETE 래퍼를 둔다.
export function authedPatchJson<T = any>(path: string, body: unknown): Promise<AuthedJsonResult<T>> {
  return authedFetchJson<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function authedDeleteJson<T = any>(path: string): Promise<AuthedJsonResult<T>> {
  return authedFetchJson<T>(path, { method: 'DELETE' })
}
