'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader, useV5Me } from '@/components/v5/app-shell'
import { ComplianceStatusBadge, Drawer, EmptyState, Field, RiskStatusBadge, SampleBanner, SeverityBadge, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedPatchJson, authedPutJson } from '@/lib/v5/client'
import { formatDate, formatDateTime, formatNumber } from '@/lib/v5/format'
import {
  COMPLIANCE_ITEMS,
  COMPLIANCE_STATUSES,
  COMPLIANCE_STATUS_LABEL,
  RISK_SEVERITIES,
  RISK_SEVERITY_LABEL,
  RISK_STATUSES,
  RISK_STATUS_LABEL,
  type ComplianceCheck,
  type ComplianceItemKey,
  type ComplianceStatus,
  type ComplianceVideoRow,
  type RiskIssue,
  type RiskSeverity,
  type RiskStatus
} from '@/lib/v5/types'

type ListResponse = {
  sample?: boolean
  items: ComplianceVideoRow[]
  summary: { total: number; passed: number; needsFix: number; unchecked: number }
  error?: string
}

type RiskResponse = {
  sample?: boolean
  items: RiskIssue[]
  partners: Array<{ id: string; company_name: string }>
  error?: string
}

type IssueForm = {
  title: string
  video_id: string
  partner_id: string
  severity: RiskSeverity
  status: RiskStatus
  action_note: string
}

const EMPTY_ISSUE: IssueForm = { title: '', video_id: '', partner_id: '', severity: 'medium', status: 'open', action_note: '' }

export default function CompliancePage() {
  const me = useV5Me()
  const { toast, showSuccess, showError } = useToast()
  const [rows, setRows] = useState<ComplianceVideoRow[]>([])
  const [summary, setSummary] = useState<ListResponse['summary'] | null>(null)
  const [checksSample, setChecksSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'' | ComplianceStatus>('')
  const [search, setSearch] = useState('')
  const [busyVideo, setBusyVideo] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})

  const [issues, setIssues] = useState<RiskIssue[]>([])
  const [partners, setPartners] = useState<RiskResponse['partners']>([])
  const [issuesSample, setIssuesSample] = useState(false)
  const [issueFilter, setIssueFilter] = useState<'' | RiskStatus>('')
  const [issueDrawer, setIssueDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null)
  const [issueForm, setIssueForm] = useState<IssueForm>(EMPTY_ISSUE)
  const [issueSaving, setIssueSaving] = useState(false)
  const [busyIssue, setBusyIssue] = useState<string | null>(null)

  const loadChecks = async () => {
    const { ok, data } = await authedFetchJson<ListResponse>('/api/v5/compliance')
    setLoaded(true)
    if (!ok || data?.error) {
      showError(data?.error || '컴플라이언스 목록 조회 실패')
      return
    }
    setRows(data.items || [])
    setSummary(data.summary)
    setChecksSample(Boolean(data.sample))
  }

  const loadIssues = async () => {
    const { ok, data } = await authedFetchJson<RiskResponse>('/api/v5/risk-issues')
    if (!ok || data?.error) {
      showError(data?.error || '리스크 이슈 조회 실패')
      return
    }
    setIssues(data.items || [])
    setPartners(data.partners || [])
    setIssuesSample(Boolean(data.sample))
  }

  useEffect(() => {
    void loadChecks()
    void loadIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && r.check.status !== statusFilter) return false
      if (!q) return true
      return `${r.video.title || ''} ${r.video.stock_name} ${r.video.owner_name || ''}`.toLowerCase().includes(q)
    })
  }, [rows, statusFilter, search])

  const filteredIssues = useMemo(() => issues.filter((i) => !issueFilter || i.status === issueFilter), [issues, issueFilter])
  const openIssues = useMemo(() => issues.filter((i) => i.status !== 'resolved').length, [issues])
  const highOpen = useMemo(() => issues.filter((i) => i.status !== 'resolved' && i.severity === 'high').length, [issues])

  // 체크 항목 하나를 저장한다. 서버가 돌려준 값으로 행을 갱신한다.
  const saveCheck = async (row: ComplianceVideoRow, patch: Partial<ComplianceCheck>) => {
    setBusyVideo(row.video.id)
    const res = await authedPutJson<{ item?: ComplianceCheck; error?: string }>(`/api/v5/compliance/${row.video.id}`, patch)
    setBusyVideo(null)
    if (!res.ok || res.data?.error || !res.data.item) {
      showError(res.data?.error || '저장 실패')
      return false
    }
    const item = res.data.item
    setRows((prev) => prev.map((r) => (r.video.id === row.video.id ? { ...r, check: { ...r.check, ...item } } : r)))
    setSummary((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      const before = row.check.status
      const after = item.status
      if (before !== after) {
        if (before === 'passed') next.passed -= 1
        if (before === 'needs_fix') next.needsFix -= 1
        if (before === 'unchecked') next.unchecked -= 1
        if (after === 'passed') next.passed += 1
        if (after === 'needs_fix') next.needsFix += 1
        if (after === 'unchecked') next.unchecked += 1
      }
      return next
    })
    return true
  }

  const toggleItem = async (row: ComplianceVideoRow, key: ComplianceItemKey) => {
    await saveCheck(row, { [key]: !row.check[key] } as Partial<ComplianceCheck>)
  }

  const setStatus = async (row: ComplianceVideoRow, status: ComplianceStatus) => {
    const patch: Partial<ComplianceCheck> = { status }
    // 통과 처리하면 5개 항목을 모두 확인한 것으로 간주한다.
    if (status === 'passed') {
      for (const item of COMPLIANCE_ITEMS) (patch as Record<string, unknown>)[item.key] = true
    }
    const note = noteDraft[row.video.id]
    if (note !== undefined) patch.note = note
    const ok = await saveCheck(row, patch)
    if (ok) showSuccess(`"${row.video.title || row.video.stock_name}" → ${COMPLIANCE_STATUS_LABEL[status]}`)
  }

  const saveNote = async (row: ComplianceVideoRow) => {
    const note = noteDraft[row.video.id]
    if (note === undefined || note === (row.check.note || '')) return
    const ok = await saveCheck(row, { note })
    if (ok) showSuccess('메모를 저장했습니다.')
  }

  const openIssueCreate = (videoId = '') => {
    setIssueForm({ ...EMPTY_ISSUE, video_id: videoId })
    setIssueDrawer({ mode: 'create' })
  }

  const openIssueEdit = (issue: RiskIssue) => {
    setIssueForm({
      title: issue.title,
      video_id: issue.video_id || '',
      partner_id: issue.partner_id || '',
      severity: issue.severity,
      status: issue.status,
      action_note: issue.action_note || ''
    })
    setIssueDrawer({ mode: 'edit', id: issue.id })
  }

  const submitIssue = async () => {
    if (!issueDrawer) return
    if (!issueForm.title.trim()) return showError('제목을 입력해 주세요.')
    setIssueSaving(true)
    const payload = { ...issueForm, title: issueForm.title.trim() }
    const res =
      issueDrawer.mode === 'create'
        ? await authedPostJson<{ item?: RiskIssue; error?: string }>('/api/v5/risk-issues', payload)
        : await authedPatchJson<{ item?: RiskIssue; error?: string }>(`/api/v5/risk-issues/${issueDrawer.id}`, payload)
    setIssueSaving(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '저장 실패')
      return
    }
    showSuccess(issueDrawer.mode === 'create' ? '리스크 이슈를 등록했습니다.' : '리스크 이슈를 수정했습니다.')
    setIssueDrawer(null)
    await loadIssues()
  }

  const setIssueStatus = async (issue: RiskIssue, status: RiskStatus) => {
    setBusyIssue(issue.id)
    const res = await authedPatchJson<{ item?: RiskIssue; error?: string }>(`/api/v5/risk-issues/${issue.id}`, { status })
    setBusyIssue(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '상태 변경 실패')
      return
    }
    showSuccess(`이슈 상태 → ${RISK_STATUS_LABEL[status]}`)
    await loadIssues()
  }

  const updateIssue = <K extends keyof IssueForm>(key: K, value: IssueForm[K]) => setIssueForm((prev) => ({ ...prev, [key]: value }))
  const isStaff = me ? !me.isAdmin : false
  const passRate = summary && summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0

  return (
    <>
      <PageHeader
        title="컴플라이언스 체크"
        subtitle={
          isStaff
            ? '내 영상의 유료광고 고지 · 종목 면책 · 투자 권유 아님 고지 · 출처 표기 · 썸네일 검토 체크리스트입니다.'
            : '최근 영상 50편의 고지/면책 체크리스트와 리스크 이슈 레지스터입니다. 유사투자자문 관련 고지 준수를 관리합니다.'
        }
        actions={
          <button className="button sm" onClick={() => openIssueCreate()}>
            + 리스크 이슈
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={checksSample || issuesSample} />

      <div className="v5-kpi-grid">
        <div className="v5-kpi">
          <div className="v5-kpi-label">검토 대상 영상</div>
          <div className="v5-kpi-value">
            {summary ? summary.total : '–'}
            <small>편</small>
          </div>
          <div className="v5-kpi-meta">{isStaff ? '내 영상 최신 50편' : '최신 50편'}</div>
        </div>
        <div className="v5-kpi tone-green">
          <div className="v5-kpi-label">통과</div>
          <div className="v5-kpi-value">
            {summary ? summary.passed : '–'}
            <small>편 · {passRate}%</small>
          </div>
        </div>
        <div className={`v5-kpi ${summary && summary.needsFix > 0 ? 'tone-red' : ''}`}>
          <div className="v5-kpi-label">수정필요</div>
          <div className="v5-kpi-value">
            {summary ? summary.needsFix : '–'}
            <small>편</small>
          </div>
        </div>
        <div className={`v5-kpi ${summary && summary.unchecked > 0 ? 'tone-amber' : ''}`}>
          <div className="v5-kpi-label">미확인</div>
          <div className="v5-kpi-value">
            {summary ? summary.unchecked : '–'}
            <small>편</small>
          </div>
        </div>
        <div className={`v5-kpi ${highOpen > 0 ? 'tone-red' : ''}`}>
          <div className="v5-kpi-label">열린 리스크 이슈</div>
          <div className="v5-kpi-value">
            {openIssues}
            <small>건 · 높음 {highOpen}</small>
          </div>
        </div>
      </div>

      <WidgetCard
        icon="✓"
        title="영상별 체크리스트"
        subtitle={`${filtered.length}편 표시 · 항목을 눌러 토글, "통과"는 5개 항목을 모두 확인 처리합니다`}
        menu={
          <div className="v5-toolbar">
            <input className="input search" placeholder="제목 · 종목 · 담당 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | ComplianceStatus)}>
              <option value="">상태 전체</option>
              {COMPLIANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COMPLIANCE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        }
        footer={checksSample ? '체크 테이블이 없어 모두 미확인으로 표시됩니다. 저장하려면 SQL을 먼저 실행하세요.' : '메모는 입력 후 포커스를 벗어나면 저장됩니다'}
      >
        {loaded && filtered.length === 0 ? <EmptyState>표시할 영상이 없습니다.</EmptyState> : null}
        {filtered.length > 0 ? (
          <div className="v5-table-wrap">
            <table className="v5-table">
              <thead>
                <tr>
                  <th>영상</th>
                  <th>체크 항목</th>
                  <th>상태</th>
                  <th>검토자</th>
                  <th>메모</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const busy = busyVideo === row.video.id
                  const checkedCount = COMPLIANCE_ITEMS.filter((i) => row.check[i.key]).length
                  return (
                    <tr key={row.video.id}>
                      <td>
                        <a className="v5-video-title link" href={row.video.youtube_url} target="_blank" rel="noopener noreferrer" title={row.video.title || ''}>
                          {row.video.title || '(제목 미수집)'}
                        </a>
                        <div className="small muted">
                          {row.video.stock_name} · {row.video.content_type === 'shortform' ? '숏폼' : '롱폼'} · {row.video.owner_name || '-'} · {formatDate(row.video.published_at || row.video.created_at)}
                          {row.video.view_count !== null ? ` · 조회 ${formatNumber(row.video.view_count)}` : ''}
                        </div>
                      </td>
                      <td>
                        <div className="v5-checklist">
                          {COMPLIANCE_ITEMS.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className={`v5-checklist-item ${row.check[item.key] ? 'on' : ''}`}
                              disabled={busy}
                              onClick={() => void toggleItem(row, item.key)}
                            >
                              {row.check[item.key] ? '✓' : '○'} {item.label}
                            </button>
                          ))}
                        </div>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          {checkedCount}/{COMPLIANCE_ITEMS.length} 확인
                        </div>
                      </td>
                      <td>
                        <ComplianceStatusBadge status={row.check.status} />
                      </td>
                      <td className="small">
                        {row.check.reviewer_name || '-'}
                        {row.check.updated_at ? <div className="muted">{formatDateTime(row.check.updated_at)}</div> : null}
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <input
                          className="input v5-inline-note"
                          placeholder="메모"
                          value={noteDraft[row.video.id] ?? row.check.note ?? ''}
                          disabled={busy}
                          onChange={(e) => setNoteDraft((prev) => ({ ...prev, [row.video.id]: e.target.value }))}
                          onBlur={() => void saveNote(row)}
                        />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="button success xs" disabled={busy || row.check.status === 'passed'} onClick={() => void setStatus(row, 'passed')}>
                            통과
                          </button>
                          <button className="button danger xs" disabled={busy || row.check.status === 'needs_fix'} onClick={() => void setStatus(row, 'needs_fix')}>
                            수정필요
                          </button>
                          <button className="button ghost xs" disabled={busy} onClick={() => openIssueCreate(row.video.id)} title="이 영상으로 리스크 이슈 등록">
                            이슈
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </WidgetCard>

      <WidgetCard
        icon="⚠"
        title="리스크 이슈 레지스터"
        subtitle={`${filteredIssues.length}건 표시`}
        menu={
          <div className="v5-toolbar">
            <select className="select" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as '' | RiskStatus)}>
              <option value="">상태 전체</option>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RISK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button className="button secondary sm" onClick={() => openIssueCreate()}>
              + 이슈 등록
            </button>
          </div>
        }
        footer={`열림 ${issues.filter((i) => i.status === 'open').length} · 조치 중 ${issues.filter((i) => i.status === 'in_progress').length} · 해결 ${issues.filter((i) => i.status === 'resolved').length}`}
      >
        {filteredIssues.length === 0 ? <EmptyState>등록된 리스크 이슈가 없습니다.</EmptyState> : null}
        {filteredIssues.length > 0 ? (
          <div className="v5-table-wrap">
            <table className="v5-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>관련 영상 / 파트너</th>
                  <th>심각도</th>
                  <th>상태</th>
                  <th>조치 내용</th>
                  <th>등록</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue) => (
                  <tr key={issue.id}>
                    <td style={{ fontWeight: 700 }}>{issue.title}</td>
                    <td className="small">
                      {issue.video_title ? <div>영상: {issue.video_title}</div> : null}
                      {issue.partner_name ? <div>파트너: {issue.partner_name}</div> : null}
                      {!issue.video_title && !issue.partner_name ? <span className="muted">-</span> : null}
                    </td>
                    <td>
                      <SeverityBadge severity={issue.severity} />
                    </td>
                    <td>
                      <RiskStatusBadge status={issue.status} />
                    </td>
                    <td className="small" style={{ maxWidth: 260 }}>
                      {issue.action_note || <span className="muted">-</span>}
                    </td>
                    <td className="small muted">
                      {issue.author_name || '-'}
                      <div>{formatDate(issue.created_at)}</div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {issue.status === 'open' ? (
                          <button className="button warning xs" disabled={busyIssue === issue.id} onClick={() => void setIssueStatus(issue, 'in_progress')}>
                            조치 시작
                          </button>
                        ) : null}
                        {issue.status !== 'resolved' ? (
                          <button className="button success xs" disabled={busyIssue === issue.id} onClick={() => void setIssueStatus(issue, 'resolved')}>
                            해결
                          </button>
                        ) : (
                          <button className="button secondary xs" disabled={busyIssue === issue.id} onClick={() => void setIssueStatus(issue, 'open')}>
                            다시 열기
                          </button>
                        )}
                        <button className="button ghost xs" disabled={busyIssue === issue.id} onClick={() => openIssueEdit(issue)}>
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </WidgetCard>

      <Drawer
        open={Boolean(issueDrawer)}
        title={issueDrawer?.mode === 'edit' ? '리스크 이슈 수정' : '리스크 이슈 등록'}
        onClose={() => (issueSaving ? null : setIssueDrawer(null))}
        footer={
          <>
            <button className="button secondary" disabled={issueSaving} onClick={() => setIssueDrawer(null)}>
              취소
            </button>
            <button className="button" disabled={issueSaving} onClick={() => void submitIssue()}>
              {issueSaving ? '저장 중…' : '저장'}
            </button>
          </>
        }
      >
        <div className="v5-form-grid">
          <Field label="제목" full>
            <input className="input" value={issueForm.title} onChange={(e) => updateIssue('title', e.target.value)} placeholder="예: 썸네일 과장 문구 사용" />
          </Field>
          <Field label="관련 영상" full>
            <select className="select" value={issueForm.video_id} onChange={(e) => updateIssue('video_id', e.target.value)}>
              <option value="">{isStaff ? '선택' : '선택 안 함'}</option>
              {rows.map((r) => (
                <option key={r.video.id} value={r.video.id}>
                  {(r.video.title || r.video.stock_name).slice(0, 50)} · {r.video.stock_name}
                </option>
              ))}
            </select>
          </Field>
          {!isStaff ? (
            <Field label="관련 파트너" full>
              <select className="select" value={issueForm.partner_id} onChange={(e) => updateIssue('partner_id', e.target.value)}>
                <option value="">선택 안 함</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="심각도">
            <select className="select" value={issueForm.severity} onChange={(e) => updateIssue('severity', e.target.value as RiskSeverity)}>
              {RISK_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {RISK_SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="상태">
            <select className="select" value={issueForm.status} onChange={(e) => updateIssue('status', e.target.value as RiskStatus)}>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RISK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="조치 내용" full>
            <textarea className="textarea" value={issueForm.action_note} onChange={(e) => updateIssue('action_note', e.target.value)} placeholder="조치 계획 또는 완료 내용" />
          </Field>
        </div>
      </Drawer>
    </>
  )
}
