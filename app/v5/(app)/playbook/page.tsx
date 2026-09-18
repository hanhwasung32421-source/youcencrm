'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { Badge, Drawer, SampleBanner, WidgetCard } from '@/components/v5/widget'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatDate } from '@/lib/v5/format'
import type { PlaybookEntry } from '@/lib/v5/types'

type VideoOption = { id: string; title: string | null; stock_name: string }

const EMPTY_FORM = { title: '', whenToUse: '', exampleVideoId: '', tags: '', effectNote: '' }

function PlaybookCard({ entry, rank, onUse, busy }: { entry: PlaybookEntry; rank?: number; onUse: () => void; busy: boolean }) {
  return (
    <WidgetCard
      icon={rank ? `#${rank}` : '▥'}
      title={entry.title}
      subtitle={entry.author_name ? `${entry.author_name} 작성` : undefined}
      footer={
        <>
          <span>사용 {entry.usage_count.toLocaleString('ko-KR')}회</span>
          <button className="button xs ghost" disabled={busy} onClick={onUse}>
            이 패턴 사용함
          </button>
        </>
      }
    >
      <div className="small" style={{ marginBottom: 6 }}>
        {entry.when_to_use}
      </div>
      {entry.example_video_title ? <div className="small muted">예시: {entry.example_video_title}</div> : null}
      {entry.effect_note ? <div className="small muted" style={{ marginTop: 4 }}>효과: {entry.effect_note}</div> : null}
      {entry.tags.length > 0 ? (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {entry.tags.map((t) => (
            <span className="v5-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </WidgetCard>
  )
}

export default function PlaybookPage() {
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<PlaybookEntry[]>([])
  const [top, setTop] = useState<PlaybookEntry[]>([])
  const [sample, setSample] = useState(false)
  const [loading, setLoading] = useState(true)
  const [videoOptions, setVideoOptions] = useState<VideoOption[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await authedFetchJson<{ sample: boolean; items: PlaybookEntry[]; top: PlaybookEntry[] }>('/api/v5/playbook')
    if (res.ok) {
      setItems(res.data.items || [])
      setTop(res.data.top || [])
      setSample(Boolean(res.data.sample))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const run = async () => {
      const res = await authedFetchJson<{ items: VideoOption[] }>('/api/v5/videos')
      if (res.ok) setVideoOptions(res.data.items || [])
    }
    void run()
  }, [])

  const onCreate = async () => {
    if (!form.title.trim()) return showError('패턴 이름을 입력해 주세요.')
    if (!form.whenToUse.trim()) return showError('언제 쓰는지 입력해 주세요.')

    setSaving(true)
    try {
      const res = await authedPostJson('/api/v5/playbook', {
        title: form.title.trim(),
        whenToUse: form.whenToUse.trim(),
        exampleVideoId: form.exampleVideoId || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        effectNote: form.effectNote.trim() || undefined
      })
      if (!res.ok) {
        showError((res.data as any)?.error || '패턴 등록에 실패했습니다.')
        return
      }
      showSuccess('플레이북에 패턴이 추가되었습니다.')
      setDrawerOpen(false)
      setForm({ ...EMPTY_FORM })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onUse = async (id: string) => {
    setBusyId(id)
    try {
      const res = await authedPostJson(`/api/v5/playbook/${id}/use`, {})
      if (!res.ok) {
        showError((res.data as any)?.error || '사용 기록에 실패했습니다.')
        return
      }
      showSuccess('사용 횟수가 1 늘었습니다.')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="발행 전략 플레이북"
        subtitle="성공 패턴을 코드화하고, 새 영상을 등록할 때 다시 꺼내 쓰세요."
        actions={
          <button className="button" onClick={() => setDrawerOpen(true)}>
            + 패턴 등록
          </button>
        }
      />

      <SampleBanner show={sample} />

      {top.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <div className="panel-title" style={{ marginBottom: 10 }}>
            가장 많이 쓰인 패턴 Top 3
          </div>
          <div className="grid grid-3">
            {top.map((entry, i) => (
              <PlaybookCard key={entry.id} entry={entry} rank={i + 1} onUse={() => onUse(entry.id)} busy={busyId === entry.id} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel-title" style={{ marginBottom: 10 }}>
        전체 패턴 <Badge tone="indigo">{items.length.toLocaleString('ko-KR')}</Badge>
      </div>
      {loading ? (
        <div className="empty-state">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">아직 등록된 패턴이 없습니다.</div>
      ) : (
        <div className="grid grid-3">
          {items.map((entry) => (
            <PlaybookCard key={entry.id} entry={entry} onUse={() => onUse(entry.id)} busy={busyId === entry.id} />
          ))}
        </div>
      )}

      {drawerOpen ? (
        <Drawer
          title="새 발행 전략 패턴"
          onClose={() => setDrawerOpen(false)}
          footer={
            <>
              <button className="button secondary" onClick={() => setDrawerOpen(false)}>
                취소
              </button>
              <button className="button" disabled={saving} onClick={onCreate}>
                {saving ? '저장 중...' : '패턴 등록'}
              </button>
            </>
          }
        >
          <div className="field">
            <label className="label">패턴 이름</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="예: 실적 발표 당일 숫자 먼저 훅" />
          </div>
          <div className="field">
            <label className="label">언제 쓰는지</label>
            <textarea className="textarea" value={form.whenToUse} onChange={(e) => setForm((f) => ({ ...f, whenToUse: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">예시 영상(선택)</label>
            <select className="select" value={form.exampleVideoId} onChange={(e) => setForm((f) => ({ ...f, exampleVideoId: e.target.value }))}>
              <option value="">선택 안 함</option>
              {videoOptions.slice(0, 100).map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.title || v.stock_name).slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">태그(쉼표로 구분)</label>
            <input className="input" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="예: 실적, 숏폼가능" />
          </div>
          <div className="field">
            <label className="label">효과 메모(선택)</label>
            <textarea className="textarea" value={form.effectNote} onChange={(e) => setForm((f) => ({ ...f, effectNote: e.target.value }))} />
          </div>
        </Drawer>
      ) : null}

      <Toast toast={toast} />
    </>
  )
}
