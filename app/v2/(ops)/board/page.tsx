'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { ItemChecklist } from '@/components/v2/item-checklist'
import { SampleBanner } from '@/components/v2/sample-banner'
import { useV2Me } from '@/components/v2/session-context'
import { ContentTypeTag, LateTag, PriorityTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson, authedPatchJson } from '@/lib/v2/client'
import { formatKstDateTime, isoToLocalInput, localInputToIso, todayAtKst } from '@/lib/v2/dates'
import { DEFAULT_DAILY_TARGET, V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STAGES,
  STAGE_LABELS,
  isInProgressStage,
  isLateItem,
  type BoardPayload,
  type ContentType,
  type Priority,
  type ProductionItem,
  type Stage
} from '@/lib/v2/types'

type QuickForm = {
  stockName: string
  issueSummary: string
  assigneeUserId: string
  contentType: ContentType
  dueAt: string
  priority: Priority
  note: string
}

type ItemResponse = { ok?: boolean; item?: ProductionItem; error?: string }

const EMPTY_BOARD: BoardPayload = { items: [], staff: [], targets: {}, doneToday: {}, today: '' }

function initialForm(): QuickForm {
  return {
    stockName: '',
    issueSummary: '',
    assigneeUserId: '',
    contentType: 'longform',
    dueAt: isoToLocalInput(todayAtKst(18)),
    priority: 'normal',
    note: ''
  }
}

export default function BoardPage() {
  const me = useV2Me()
  const { toast, showSuccess, showError } = useToast()
  const [board, setBoard] = useState<BoardPayload>(EMPTY_BOARD)
  const [loaded, setLoaded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<QuickForm>(initialForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [completeUrl, setCompleteUrl] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [staffFilter, setStaffFilter] = useState('')

  const load = async () => {
    const { ok, data } = await authedFetchJson<BoardPayload & { error?: string }>('/api/v2/board')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '제작 보드 조회 실패')
      return
    }
    setBoard(data)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const replaceItem = (item: ProductionItem) => {
    setBoard((prev) => ({ ...prev, items: prev.items.map((row) => (row.id === item.id ? item : row)) }))
  }

  const guardSample = () => {
    if (board.sample) {
      showError(V2_MISSING_TABLE_MESSAGE)
      return true
    }
    return false
  }

  const create = async () => {
    if (!form.stockName.trim()) {
      showError('종목명을 입력해 주세요.')
      return
    }
    if (guardSample()) return
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<ItemResponse>('/api/v2/production-items', {
        stockName: form.stockName.trim(),
        issueSummary: form.issueSummary.trim() || null,
        assigneeUserId: me.isAdmin ? form.assigneeUserId || null : null,
        contentType: form.contentType,
        dueAt: localInputToIso(form.dueAt),
        priority: form.priority,
        note: form.note.trim() || null
      })
      if (!ok || !data.item) {
        showError(data?.error || '제작 아이템 추가 실패')
        return
      }
      const created = data.item
      setBoard((prev) => ({ ...prev, items: [...prev.items, created] }))
      setForm(initialForm())
      setFormOpen(false)
      showSuccess(`${created.stock_name} 아이템을 기획 단계에 추가했습니다.`)
    } finally {
      setSaving(false)
    }
  }

  const moveStage = async (item: ProductionItem, direction: 1 | -1) => {
    const index = STAGES.indexOf(item.stage)
    const next = STAGES[index + direction] as Stage | undefined
    if (!next) return
    if (next === 'done') {
      setCompleteId(item.id)
      setCompleteUrl('')
      return
    }
    if (guardSample()) return
    setBusyId(item.id)
    try {
      const { ok, data } = await authedPatchJson<ItemResponse>('/api/v2/production-items', { id: item.id, stage: next })
      if (!ok || !data.item) {
        showError(data?.error || '단계 이동 실패')
        return
      }
      replaceItem(data.item)
      showSuccess(`${item.stock_name} → ${STAGE_LABELS[next]}`)
    } finally {
      setBusyId(null)
    }
  }

  const complete = async (item: ProductionItem) => {
    const youtubeUrl = completeUrl.trim()
    if (!youtubeUrl) {
      showError('업로드한 유튜브 영상 URL을 입력해 주세요.')
      return
    }
    if (guardSample()) return
    setBusyId(item.id)
    try {
      const created = await authedPostJson<{ ok?: boolean; video?: { id: string }; error?: string }>('/api/videos/create', {
        youtubeUrl,
        contentType: item.content_type,
        stockName: item.stock_name,
        contentCategory: null
      })
      if (!created.ok || !created.data.video?.id) {
        showError(created.data?.error || '영상 등록 실패')
        return
      }
      const patched = await authedPatchJson<ItemResponse>('/api/v2/production-items', {
        id: item.id,
        stage: 'done',
        videoId: created.data.video.id
      })
      if (!patched.ok || !patched.data.item) {
        showError(patched.data?.error || '영상은 등록됐지만 완료 처리에 실패했습니다.')
        return
      }
      replaceItem(patched.data.item)
      setCompleteId(null)
      setCompleteUrl('')
      showSuccess(`${item.stock_name} 영상이 등록되고 완료 처리되었습니다.`)
      void load()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item: ProductionItem) => {
    if (guardSample()) return
    if (!window.confirm(`${item.stock_name} 아이템을 삭제할까요?`)) return
    setBusyId(item.id)
    try {
      const { ok, data } = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v2/production-items?id=${item.id}`)
      if (!ok) {
        showError(data?.error || '삭제 실패')
        return
      }
      setBoard((prev) => ({ ...prev, items: prev.items.filter((row) => row.id !== item.id) }))
      showSuccess('삭제했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const now = Date.now()
  const items = staffFilter ? board.items.filter((item) => item.assignee_user_id === staffFilter) : board.items
  const staffScope = staffFilter ? board.staff.filter((s) => s.id === staffFilter) : board.staff
  const targetTotal = staffScope.reduce((sum, s) => sum + (board.targets[s.id] ?? DEFAULT_DAILY_TARGET), 0)
  const doneTotal = staffScope.reduce((sum, s) => sum + (board.doneToday[s.id] ?? 0), 0)
  const inProgress = items.filter((item) => isInProgressStage(item.stage)).length
  const late = items.filter((item) => isLateItem(item, now)).length
  const boardDone = items.filter((item) => item.stage === 'done').length
  const achievement = targetTotal > 0 ? Math.round((doneTotal / targetTotal) * 100) : 0

  return (
    <>
      <PageHeader
        title="제작 보드"
        subtitle="종목·이슈 → 기획 → 촬영/녹화 → 편집 → 업로드 대기 → 완료. 카드를 단계별로 옮기고, 업로드가 끝나면 유튜브 URL로 완료 처리합니다."
        actions={
          <button className="button" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? '닫기' : '+ 아이템 추가'}
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={board.sample} />

      <div className="v2-kpi-strip">
        <div className={`v2-kpi ${achievement >= 100 ? 'good' : achievement >= 60 ? 'warn' : ''}`}>
          <div className="v2-kpi-label">오늘 완료 / 목표</div>
          <div className="v2-kpi-value">
            {doneTotal}
            <span className="unit">/ {targetTotal}</span>
          </div>
          <div className="v2-kpi-meta">달성률 {achievement}% · 등록 영상 기준</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">진행 중</div>
          <div className="v2-kpi-value">
            {inProgress}
            <span className="unit">건</span>
          </div>
          <div className="v2-kpi-meta">촬영 · 편집 · 업로드 대기</div>
        </div>
        <div className={`v2-kpi ${late > 0 ? 'bad' : 'good'}`}>
          <div className="v2-kpi-label">지연</div>
          <div className="v2-kpi-value">
            {late}
            <span className="unit">건</span>
          </div>
          <div className="v2-kpi-meta">마감 지난 미완료</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">보드 완료</div>
          <div className="v2-kpi-value">
            {boardDone}
            <span className="unit">건</span>
          </div>
          <div className="v2-kpi-meta">오늘 완료 칸에 있는 카드</div>
        </div>
      </div>

      {board.staff.length > 0 ? (
        <div className="panel soft">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="v2-section-title" style={{ margin: 0 }}>
              담당자별 진행률 (오늘 완료 / 목표)
            </div>
            {me.isAdmin ? (
              <select className="select compact" style={{ maxWidth: 200 }} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="">전체 담당자</option>
                {board.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="v2-minibars">
            {board.staff.map((s) => {
              const target = board.targets[s.id] ?? DEFAULT_DAILY_TARGET
              const done = board.doneToday[s.id] ?? 0
              const ratio = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0
              const tone = ratio >= 100 ? 'full' : ratio < 40 ? 'low' : ''
              return (
                <div className="v2-minibar-row" key={s.id}>
                  <span className="v2-minibar-name" title={s.name}>
                    {s.name}
                  </span>
                  <div className="v2-minibar-track">
                    <div className={`v2-minibar-fill ${tone}`} style={{ width: `${ratio}%` }} />
                  </div>
                  <span className="v2-minibar-value">
                    {done}/{target}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">아이템 빠른 추가</div>
              <p className="panel-subtitle">기획 단계로 들어갑니다. 콘텐츠 형식에 맞는 기본 체크리스트가 자동으로 붙습니다.</p>
            </div>
          </div>
          <div className="v2-form-grid">
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label className="label">종목명 *</label>
              <input
                className="input compact"
                value={form.stockName}
                placeholder="예: 삼성전자"
                onChange={(e) => setForm({ ...form, stockName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create()
                }}
              />
            </div>
            {me.isAdmin ? (
              <div className="field">
                <label className="label">담당자</label>
                <select className="select compact" value={form.assigneeUserId} onChange={(e) => setForm({ ...form, assigneeUserId: e.target.value })}>
                  <option value="">나 ({me.name})</option>
                  {board.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="field">
              <label className="label">형식</label>
              <select className="select compact" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as ContentType })}>
                {CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">마감</label>
              <input className="input compact" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">우선순위</label>
              <select className="select compact" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="label">관련 이슈</label>
              <input
                className="input compact"
                value={form.issueSummary}
                placeholder="예: HBM4 양산 일정 앞당김 보도 — 외국인 수급 점검"
                onChange={(e) => setForm({ ...form, issueSummary: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="label">메모</label>
              <textarea className="textarea compact" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" disabled={saving} onClick={create}>
              {saving ? '추가 중...' : '기획에 추가'}
            </button>
            <button className="button secondary" disabled={saving} onClick={() => setFormOpen(false)}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      <div className="v2-kanban">
        {STAGES.map((stage) => {
          const column = items
            .filter((item) => item.stage === stage)
            .sort((a, b) => Number(isLateItem(b, now)) - Number(isLateItem(a, now)) || (a.due_at || '').localeCompare(b.due_at || ''))
          return (
            <div className="v2-kanban-col" data-stage={stage} key={stage}>
              <div className="v2-kanban-head">
                <span>{STAGE_LABELS[stage]}</span>
                <span className="count">{column.length}</span>
              </div>
              <div className="v2-kanban-body">
                {column.length === 0 ? (
                  <div className="small muted" style={{ padding: '8px 2px' }}>
                    {loaded ? '카드 없음' : ''}
                  </div>
                ) : (
                  column.map((item) => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      isAdmin={me.isAdmin}
                      busy={busyId === item.id}
                      late={isLateItem(item, now)}
                      expanded={expandedId === item.id}
                      completing={completeId === item.id}
                      completeUrl={completeUrl}
                      onToggleExpand={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                      onPrev={() => void moveStage(item, -1)}
                      onNext={() => void moveStage(item, 1)}
                      onStartComplete={() => {
                        setCompleteId(item.id)
                        setCompleteUrl('')
                      }}
                      onCancelComplete={() => setCompleteId(null)}
                      onCompleteUrl={setCompleteUrl}
                      onComplete={() => void complete(item)}
                      onDelete={() => void remove(item)}
                      onProgress={(done, total) => replaceItem({ ...item, checklist_done: done, checklist_total: total })}
                      onError={showError}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function BoardCard({
  item,
  isAdmin,
  busy,
  late,
  expanded,
  completing,
  completeUrl,
  onToggleExpand,
  onPrev,
  onNext,
  onStartComplete,
  onCancelComplete,
  onCompleteUrl,
  onComplete,
  onDelete,
  onProgress,
  onError
}: {
  item: ProductionItem
  isAdmin: boolean
  busy: boolean
  late: boolean
  expanded: boolean
  completing: boolean
  completeUrl: string
  onToggleExpand: () => void
  onPrev: () => void
  onNext: () => void
  onStartComplete: () => void
  onCancelComplete: () => void
  onCompleteUrl: (value: string) => void
  onComplete: () => void
  onDelete: () => void
  onProgress: (done: number, total: number) => void
  onError: (message: string) => void
}) {
  const stageIndex = STAGES.indexOf(item.stage)
  const isFirst = stageIndex === 0
  const isDone = item.stage === 'done'
  const checklistLabel = item.checklist_total ? `체크 ${item.checklist_done ?? 0}/${item.checklist_total}` : null

  return (
    <div className={`v2-card prio-${item.priority} ${late ? 'late' : ''} ${isDone ? 'done' : ''}`}>
      <div className="v2-card-title">
        <span>{item.stock_name}</span>
        <ContentTypeTag contentType={item.content_type} />
        {item.priority !== 'normal' ? <PriorityTag priority={item.priority} /> : null}
        {late ? <LateTag /> : null}
      </div>
      {item.issue_summary ? <div className="v2-card-issue">{item.issue_summary}</div> : null}
      <div className="v2-card-meta">
        <span>담당 {item.assignee_name || '-'}</span>
        <span className={late ? 'hot' : ''}>마감 {formatKstDateTime(item.due_at)}</span>
        {checklistLabel ? <span>{checklistLabel}</span> : null}
        {item.video_id ? <span style={{ color: '#4ade80' }}>영상 등록됨</span> : null}
      </div>
      {item.note ? <div className="v2-card-note">{item.note}</div> : null}

      {completing ? (
        <div className="v2-card-form">
          <div className="small muted">업로드한 유튜브 영상 URL을 넣으면 영상이 등록되고(조회수 자동 수집) 카드가 완료로 이동합니다.</div>
          <input
            className="input compact"
            placeholder="https://www.youtube.com/watch?v=..."
            value={completeUrl}
            onChange={(e) => onCompleteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onComplete()
            }}
          />
          {isAdmin ? <div className="small muted">영상은 지금 로그인한 계정 명의로 등록됩니다. 담당자 본인이 처리하는 것을 권장합니다.</div> : null}
          <div className="row" style={{ gap: 6 }}>
            <button className="button success xs" disabled={busy} onClick={onComplete}>
              {busy ? '처리 중...' : '영상 등록 + 완료'}
            </button>
            <button className="button secondary xs" disabled={busy} onClick={onCancelComplete}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="v2-card-actions">
          <button className="button secondary xs" disabled={busy || isFirst} onClick={onPrev} title="이전 단계">
            ◀
          </button>
          {isDone ? null : item.stage === 'ready' ? (
            <button className="button success xs" disabled={busy} onClick={onStartComplete}>
              완료 처리
            </button>
          ) : (
            <button className="button xs" disabled={busy} onClick={onNext} title="다음 단계">
              {STAGE_LABELS[STAGES[stageIndex + 1]]} ▶
            </button>
          )}
          <button className="button secondary xs" onClick={onToggleExpand}>
            {expanded ? '체크리스트 닫기' : '체크리스트'}
          </button>
          <button className="button secondary xs" disabled={busy} onClick={onDelete} title="삭제" style={{ marginLeft: 'auto', color: '#f87171' }}>
            삭제
          </button>
        </div>
      )}

      {expanded ? <ItemChecklist itemId={item.id} onProgress={onProgress} onError={onError} /> : null}
    </div>
  )
}
