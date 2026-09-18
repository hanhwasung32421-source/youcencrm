'use client'

import { authedFetchJson, type AuthedJsonResult } from '@/lib/session/authed-fetch'

// 공용 authedFetchJson/authedPostJson 위에 PATCH/PUT/DELETE 만 얇게 얹는다.
export function authedPatchJson<T = any>(path: string, body: unknown): Promise<AuthedJsonResult<T>> {
  return authedFetchJson<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function authedPutJson<T = any>(path: string, body: unknown): Promise<AuthedJsonResult<T>> {
  return authedFetchJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function authedDeleteJson<T = any>(path: string): Promise<AuthedJsonResult<T>> {
  return authedFetchJson<T>(path, { method: 'DELETE' })
}

export type ApiError = { error?: string }
