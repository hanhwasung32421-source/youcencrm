'use client'

import { useEffect, useState } from 'react'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import type { ChecklistPayload, ChecklistRow } from '@/lib/v2/types'

// 제작 아이템 하나의 체크리스트. 열릴 때 로드하고, 체크할 때마다 서버에 저장한다.
export function ItemChecklist({
  itemId,
  onProgress,
  onError
}: {
  itemId: string
  onProgress?: (done: number, total: number) => void
  onError?: (message: string) => void
}) {
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [templateName, setTemplateName] = useState<string | null>(null)
  const [sample, setSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busyIndex, setBusyIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { ok, data } = await authedFetchJson<ChecklistPayload>(`/api/v2/checklists?itemId=${encodeURIComponent(itemId)}`)
      if (cancelled) return
      setLoaded(true)
      if (!ok) {
        onError?.(data?.error || '체크리스트를 불러오지 못했습니다.')
        return
      }
      setRows(data.items || [])
      setTemplateName(data.templateName || null)
      setSample(Boolean(data.sample))
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  const toggle = async (row: ChecklistRow) => {
    const nextChecked = !row.checked
    setBusyIndex(row.item_index)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/v2/checklists', {
        productionItemId: itemId,
        itemIndex: row.item_index,
        checked: nextChecked
      })
      if (!ok) {
        onError?.(data?.error || '체크리스트 저장 실패')
        return
      }
      const next = rows.map((r) => (r.item_index === row.item_index ? { ...r, checked: nextChecked } : r))
      setRows(next)
      onProgress?.(next.filter((r) => r.checked).length, next.length)
    } finally {
      setBusyIndex(null)
    }
  }

  if (!loaded) return <div className="small muted">체크리스트 불러오는 중…</div>
  if (rows.length === 0) return <div className="small muted">적용된 체크리스트가 없습니다. 제작 표준에서 기본 템플릿을 만들어 주세요.</div>

  const done = rows.filter((r) => r.checked).length

  return (
    <div className="v2-checklist">
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="v2-section-title" style={{ margin: 0 }}>
          {templateName ? `${templateName} · ` : ''}
          {done}/{rows.length}
        </span>
        {sample ? <span className="v2-tag">샘플</span> : null}
      </div>
      {rows.map((row) => (
        <label key={row.item_index} className={`v2-check ${row.checked ? 'done' : ''}`}>
          <input type="checkbox" checked={row.checked} disabled={busyIndex === row.item_index} onChange={() => void toggle(row)} />
          <span>{row.label}</span>
        </label>
      ))}
    </div>
  )
}
