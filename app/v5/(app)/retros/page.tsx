'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { SampleBanner, WidgetCard } from '@/components/v5/widget'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedPatchJson } from '@/lib/v5/client'
import { formatDateTime } from '@/lib/v5/format'
import type { RetroActionItem, WeeklyRetro } from '@/lib/v5/types'

function RetroCard({ retro, onToggle }: { retro: WeeklyRetro; onToggle: (idx: number) => void }) {
  const done = retro.action_items.filter((a) => a.done).length
  return (
    <WidgetCard
      icon="✎"
      title={`${retro.week_label} 회고`}
      subtitle={`${retro.author_name || '관리자'} · ${formatDateTime(retro.created_at)}`}
      footer={
        <>
          <span>
            총 조회수 {retro.kpi_snapshot.totalViews.toLocaleString('ko-KR')} · 영상 {retro.kpi_snapshot.totalVideos.toLocaleString('ko-KR')}편
          </span>
          <span>
            액션 {done}/{retro.action_items.length}
          </span>
        </>
      }
    >
      {retro.went_well ? (
        <div style={{ marginBottom: 8 }}>
          <div className="label">잘된 점</div>
          <div className="small">{retro.went_well}</div>
        </div>
      ) : null}
      {retro.to_improve ? (
        <div style={{ marginBottom: 8 }}>
          <div className="label">개선할 점</div>
          <div className="small">{retro.to_improve}</div>
        </div>
      ) : null}
      {retro.action_items.length > 0 ? (
        <div>
          <div className="label">다음 주 액션 아이템</div>
          <div className="v5-checklist" style={{ marginTop: 6 }}>
            {retro.action_items.map((item, idx) => (
              <button key={idx} type="button" className={`v5-checklist-item ${item.done ? 'on' : ''}`} onClick={() => onToggle(idx)}>
                {item.done ? '✓ ' : ''}
                {item.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </WidgetCard>
  )
}

export default function RetrosPage() {
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<WeeklyRetro[]>([])
  const [sample, setSample] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wentWell, setWentWell] = useState('')
  const [toImprove, setToImprove] = useState('')
  const [actionDraft, setActionDraft] = useState('')
  const [actionItems, setActionItems] = useState<RetroActionItem[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await authedFetchJson<{ sample: boolean; items: WeeklyRetro[] }>('/api/v5/retros')
    if (res.ok) {
      setItems(res.data.items || [])
      setSample(Boolean(res.data.sample))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const addActionItem = () => {
    if (!actionDraft.trim()) return
    setActionItems((prev) => [...prev, { text: actionDraft.trim(), done: false }])
    setActionDraft('')
  }

  const onCreate = async () => {
    setSaving(true)
    try {
      const res = await authedPostJson('/api/v5/retros', { wentWell: wentWell.trim() || undefined, toImprove: toImprove.trim() || undefined, actionItems })
      if (!res.ok) {
        showError((res.data as any)?.error || '회고 등록에 실패했습니다.')
        return
      }
      showSuccess('이번 주 성장 회고가 저장되었습니다.')
      setWentWell('')
      setToImprove('')
      setActionItems([])
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onToggle = async (retroId: string, idx: number) => {
    const target = items.find((r) => r.id === retroId)
    if (!target) return
    const nextItems = target.action_items.map((item, i) => (i === idx ? { ...item, done: !item.done } : item))
    setItems((prev) => prev.map((r) => (r.id === retroId ? { ...r, action_items: nextItems } : r)))
    const res = await authedPatchJson(`/api/v5/retros/${retroId}`, { actionItems: nextItems })
    if (!res.ok) {
      showError((res.data as any)?.error || '체크 저장에 실패했습니다.')
      await load()
    }
  }

  return (
    <>
      <PageHeader title="성장 회고 노트" subtitle="주간 단위로 잘된 점 · 개선할 점 · 다음 액션을 남기고, 그 주의 KPI 스냅샷을 함께 고정합니다." />

      <SampleBanner show={sample} />

      <WidgetCard icon="+" title="이번 주 회고 작성" subtitle="주차는 자동으로 계산되며, KPI는 저장 시점에 고정됩니다." className="span-2">
        <div className="v5-form-grid">
          <div className="field full">
            <label className="label">잘된 점</label>
            <textarea className="textarea" value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
          </div>
          <div className="field full">
            <label className="label">개선할 점</label>
            <textarea className="textarea" value={toImprove} onChange={(e) => setToImprove(e.target.value)} />
          </div>
          <div className="field full">
            <label className="label">다음 주 액션 아이템</label>
            <div className="row">
              <input
                className="input"
                value={actionDraft}
                onChange={(e) => setActionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addActionItem()
                  }
                }}
                placeholder="액션 아이템을 입력하고 Enter"
              />
              <button className="button secondary nowrap" type="button" onClick={addActionItem}>
                추가
              </button>
            </div>
            {actionItems.length > 0 ? (
              <div className="v5-checklist" style={{ marginTop: 8 }}>
                {actionItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="v5-checklist-item"
                    onClick={() => setActionItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    {item.text} ✕
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <button className="button" style={{ marginTop: 14 }} disabled={saving} onClick={onCreate}>
          {saving ? '저장 중...' : '이번 주 회고 저장'}
        </button>
      </WidgetCard>

      <div style={{ marginTop: 24 }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          지난 회고
        </div>
        {loading ? (
          <div className="empty-state">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">아직 작성된 회고가 없습니다.</div>
        ) : (
          <div className="grid grid-2">
            {items.map((retro) => (
              <RetroCard key={retro.id} retro={retro} onToggle={(idx) => onToggle(retro.id, idx)} />
            ))}
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </>
  )
}
