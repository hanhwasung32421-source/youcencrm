'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { Badge, Drawer, SampleBanner, Segment, WidgetCard } from '@/components/v5/widget'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedPatchJson } from '@/lib/v5/client'
import { formatDate } from '@/lib/v5/format'
import {
  EXPERIMENT_DIMENSIONS,
  EXPERIMENT_DIMENSION_LABEL,
  EXPERIMENT_STATUS_LABEL,
  EXPERIMENT_STATUS_ORDER,
  type ExperimentDimension,
  type ExperimentStatus,
  type GrowthExperiment
} from '@/lib/v5/types'

type VideoOption = { id: string; title: string | null; stock_name: string; content_type: string }

const STATUS_TONE: Record<ExperimentStatus, 'indigo' | 'green' | 'red' | 'amber'> = {
  running: 'indigo',
  won: 'green',
  lost: 'red',
  paused: 'amber'
}

const EMPTY_FORM = {
  dimensions: [] as ExperimentDimension[],
  videoIds: [] as string[],
  hypothesis: '',
  metricDefinition: '',
  startedOn: new Date().toISOString().slice(0, 10),
  endedOn: '',
  nextAction: ''
}

function ExperimentCard({
  exp,
  onMove,
  onDelete,
  busy
}: {
  exp: GrowthExperiment
  onMove: (status: ExperimentStatus) => void
  onDelete: () => void
  busy: boolean
}) {
  const idx = EXPERIMENT_STATUS_ORDER.indexOf(exp.status)
  return (
    <div className="v5-exp-card">
      <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
        {exp.dimensions.map((d) => (
          <span className="v5-tag" key={d}>
            {EXPERIMENT_DIMENSION_LABEL[d]}
          </span>
        ))}
      </div>
      <div className="v5-exp-card-title">{exp.hypothesis}</div>
      <div className="small muted">지표: {exp.metric_definition}</div>
      {exp.videos && exp.videos.length > 0 ? (
        <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          대상: {exp.videos.map((v) => v.title || v.stock_name).join(', ')}
        </div>
      ) : null}
      <div className="v5-exp-card-meta">
        <span>{formatDate(exp.started_on)} ~ {exp.ended_on ? formatDate(exp.ended_on) : '진행중'}</span>
        {exp.effect_size !== null ? (
          <span className={exp.effect_size >= 0 ? 'v5-exp-card-amount' : ''} style={{ color: exp.effect_size >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {exp.effect_size >= 0 ? '+' : ''}
            {exp.effect_size}%
          </span>
        ) : null}
      </div>
      {exp.next_action ? <div className="v5-exp-card-next">다음: {exp.next_action}</div> : null}
      <div className="small muted">{exp.author_name || '작성자 미상'}</div>
      <div className="v5-exp-card-actions">
        <button className="button xs secondary" disabled={busy || idx <= 0} onClick={() => onMove(EXPERIMENT_STATUS_ORDER[idx - 1])}>
          ← 이전
        </button>
        <button className="button xs secondary" disabled={busy || idx >= EXPERIMENT_STATUS_ORDER.length - 1} onClick={() => onMove(EXPERIMENT_STATUS_ORDER[idx + 1])}>
          다음 →
        </button>
        <button className="button xs danger" disabled={busy} onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  )
}

export default function CanvasPage() {
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<GrowthExperiment[]>([])
  const [sample, setSample] = useState(false)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [videoOptions, setVideoOptions] = useState<VideoOption[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await authedFetchJson<{ sample: boolean; items: GrowthExperiment[] }>('/api/v5/growth-experiments')
    if (res.ok) {
      setItems(res.data.items || [])
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

  const grouped = useMemo(() => {
    const map = new Map<ExperimentStatus, GrowthExperiment[]>()
    for (const status of EXPERIMENT_STATUS_ORDER) map.set(status, [])
    for (const item of items) map.get(item.status)?.push(item)
    return map
  }, [items])

  const toggleDimension = (dim: ExperimentDimension) => {
    setForm((f) => ({
      ...f,
      dimensions: f.dimensions.includes(dim) ? f.dimensions.filter((d) => d !== dim) : [...f.dimensions, dim]
    }))
  }

  const toggleVideo = (id: string) => {
    setForm((f) => ({ ...f, videoIds: f.videoIds.includes(id) ? f.videoIds.filter((v) => v !== id) : [...f.videoIds, id] }))
  }

  const onCreate = async () => {
    if (form.dimensions.length === 0) return showError('실험 유형을 1개 이상 선택해 주세요.')
    if (form.videoIds.length === 0) return showError('대상 영상을 1개 이상 선택해 주세요.')
    if (!form.hypothesis.trim()) return showError('가설을 입력해 주세요.')
    if (!form.metricDefinition.trim()) return showError('측정 지표를 입력해 주세요.')

    setSaving(true)
    try {
      const res = await authedPostJson('/api/v5/growth-experiments', {
        dimensions: form.dimensions,
        videoIds: form.videoIds,
        hypothesis: form.hypothesis.trim(),
        metricDefinition: form.metricDefinition.trim(),
        startedOn: form.startedOn,
        endedOn: form.endedOn || undefined,
        nextAction: form.nextAction.trim() || undefined
      })
      if (!res.ok) {
        showError((res.data as any)?.error || '실험 등록에 실패했습니다.')
        return
      }
      showSuccess('실험이 캔버스에 추가되었습니다.')
      setDrawerOpen(false)
      setForm({ ...EMPTY_FORM })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onMove = async (id: string, status: ExperimentStatus) => {
    setBusyId(id)
    try {
      const res = await authedPatchJson(`/api/v5/growth-experiments/${id}`, { status })
      if (!res.ok) {
        showError((res.data as any)?.error || '상태 변경에 실패했습니다.')
        return
      }
      setItems((prev) => prev.map((it) => (it.id === id ? (res.data as any).item : it)))
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async (id: string) => {
    setBusyId(id)
    try {
      const res = await authedFetchJson(`/api/v5/growth-experiments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        showError((res.data as any)?.error || '삭제에 실패했습니다.')
        return
      }
      setItems((prev) => prev.filter((it) => it.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="성장 실험 캔버스"
        subtitle="제목·썸네일·발행시간·형식·길이를 다차원으로 조합해 실험을 설계하고 결과를 추적합니다."
        actions={
          <button className="button" onClick={() => setDrawerOpen(true)}>
            + 새 실험
          </button>
        }
      />

      <SampleBanner show={sample} />

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {EXPERIMENT_STATUS_ORDER.map((status) => (
            <Badge key={status} tone={STATUS_TONE[status]}>
              {EXPERIMENT_STATUS_LABEL[status]} {grouped.get(status)?.length || 0}
            </Badge>
          ))}
        </div>
        <Segment
          value={view}
          onChange={setView}
          options={[
            { value: 'kanban', label: '칸반' },
            { value: 'list', label: '목록' }
          ]}
        />
      </div>

      {loading ? (
        <div className="empty-state">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">등록된 실험이 없습니다. "새 실험"으로 첫 카드를 만들어 보세요.</div>
      ) : view === 'kanban' ? (
        <div className="v5-kanban cols-4">
          {EXPERIMENT_STATUS_ORDER.map((status) => (
            <div className="v5-kanban-col" key={status}>
              <div className="v5-kanban-col-head">
                <div className="v5-kanban-col-title">
                  {EXPERIMENT_STATUS_LABEL[status]}
                  <span>{grouped.get(status)?.length || 0}</span>
                </div>
              </div>
              {(grouped.get(status) || []).map((exp) => (
                <ExperimentCard key={exp.id} exp={exp} busy={busyId === exp.id} onMove={(s) => onMove(exp.id, s)} onDelete={() => onDelete(exp.id)} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="v5-table-wrap panel" style={{ padding: 0 }}>
          <table className="v5-table">
            <thead>
              <tr>
                <th>가설</th>
                <th>유형</th>
                <th>대상 영상</th>
                <th>기간</th>
                <th>상태</th>
                <th className="num">효과</th>
                <th>작성자</th>
              </tr>
            </thead>
            <tbody>
              {items.map((exp) => (
                <tr key={exp.id}>
                  <td style={{ maxWidth: 260 }}>{exp.hypothesis}</td>
                  <td>{exp.dimensions.map((d) => EXPERIMENT_DIMENSION_LABEL[d]).join(', ')}</td>
                  <td className="small muted">{(exp.videos || []).map((v) => v.title || v.stock_name).join(', ') || '-'}</td>
                  <td className="small">
                    {formatDate(exp.started_on)} ~ {exp.ended_on ? formatDate(exp.ended_on) : '진행중'}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[exp.status]}>{EXPERIMENT_STATUS_LABEL[exp.status]}</Badge>
                  </td>
                  <td className="num">{exp.effect_size !== null ? `${exp.effect_size >= 0 ? '+' : ''}${exp.effect_size}%` : '-'}</td>
                  <td className="small muted">{exp.author_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawerOpen ? (
        <Drawer
          title="새 성장 실험"
          onClose={() => setDrawerOpen(false)}
          footer={
            <>
              <button className="button secondary" onClick={() => setDrawerOpen(false)}>
                취소
              </button>
              <button className="button" disabled={saving} onClick={onCreate}>
                {saving ? '저장 중...' : '실험 추가'}
              </button>
            </>
          }
        >
          <div className="field">
            <label className="label">실험 유형(다중 선택)</label>
            <div className="v5-checklist">
              {EXPERIMENT_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  className={`v5-checklist-item ${form.dimensions.includes(dim) ? 'on' : ''}`}
                  onClick={() => toggleDimension(dim)}
                >
                  {EXPERIMENT_DIMENSION_LABEL[dim]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">대상 영상(다중 선택, 최근 {videoOptions.length}건)</label>
            <div className="v5-checklist" style={{ maxHeight: 160, overflowY: 'auto' }}>
              {videoOptions.slice(0, 60).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`v5-checklist-item ${form.videoIds.includes(v.id) ? 'on' : ''}`}
                  onClick={() => toggleVideo(v.id)}
                  title={v.title || v.stock_name}
                >
                  {(v.title || v.stock_name).slice(0, 18)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">가설</label>
            <textarea className="textarea" value={form.hypothesis} onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))} />
          </div>

          <div className="field">
            <label className="label">측정 지표(자유 서술)</label>
            <input
              className="input"
              value={form.metricDefinition}
              onChange={(e) => setForm((f) => ({ ...f, metricDefinition: e.target.value }))}
              placeholder="예: 업로드 후 48시간 CTR"
            />
          </div>

          <div className="v5-form-grid">
            <div className="field">
              <label className="label">시작일</label>
              <input className="input" type="date" value={form.startedOn} onChange={(e) => setForm((f) => ({ ...f, startedOn: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">종료일(선택)</label>
              <input className="input" type="date" value={form.endedOn} onChange={(e) => setForm((f) => ({ ...f, endedOn: e.target.value }))} />
            </div>
          </div>

          <div className="field">
            <label className="label">다음 액션(선택)</label>
            <input className="input" value={form.nextAction} onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))} />
          </div>
        </Drawer>
      ) : null}

      <Toast toast={toast} />
    </>
  )
}
