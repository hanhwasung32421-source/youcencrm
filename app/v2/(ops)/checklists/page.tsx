'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { useV2Me } from '@/components/v2/session-context'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson } from '@/lib/v2/client'
import { V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import { CONTENT_TYPE_LABELS, type ChecklistTemplate, type ContentType, type TemplatesPayload } from '@/lib/v2/types'

type Draft = { name: string; contentType: '' | ContentType; itemsText: string; isDefault: boolean }

function toDraft(template: ChecklistTemplate): Draft {
  return {
    name: template.name,
    contentType: template.content_type || '',
    itemsText: template.items.join('\n'),
    isDefault: template.is_default
  }
}

function emptyDraft(): Draft {
  return { name: '', contentType: '', itemsText: '', isDefault: false }
}

function parseItems(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export default function ChecklistsPage() {
  const me = useV2Me()
  const { toast, showSuccess, showError } = useToast()
  const [payload, setPayload] = useState<TemplatesPayload>({ items: [] })
  const [loaded, setLoaded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<TemplatesPayload & { error?: string }>('/api/v2/checklist-templates')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '체크리스트 템플릿 조회 실패')
      return
    }
    setPayload(data)
    setDrafts((prev) => {
      const next: Record<string, Draft> = {}
      for (const template of data.items) next[template.id] = prev[template.id] || toDraft(template)
      return next
    })
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardSample = () => {
    if (payload.sample) {
      showError(V2_MISSING_TABLE_MESSAGE)
      return true
    }
    return false
  }

  const save = async (id: string | null, draft: Draft) => {
    const items = parseItems(draft.itemsText)
    if (!draft.name.trim()) {
      showError('템플릿 이름을 입력해 주세요.')
      return
    }
    if (items.length === 0) {
      showError('항목을 한 줄에 하나씩 입력해 주세요.')
      return
    }
    if (guardSample()) return
    setSavingId(id || 'new')
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/checklist-templates', {
        id: id || undefined,
        name: draft.name.trim(),
        contentType: draft.contentType || null,
        items,
        isDefault: draft.isDefault
      })
      if (!ok) {
        showError(data?.error || '템플릿 저장 실패')
        return
      }
      showSuccess(id ? '템플릿을 저장했습니다.' : '템플릿을 추가했습니다.')
      if (!id) setNewDraft(emptyDraft())
      if (id) setDrafts((prev) => ({ ...prev, [id]: draft }))
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (template: ChecklistTemplate) => {
    if (guardSample()) return
    if (!window.confirm(`'${template.name}' 템플릿을 삭제할까요? 이미 만들어진 아이템의 체크리스트는 유지됩니다.`)) return
    setSavingId(template.id)
    try {
      const { ok, data } = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v2/checklist-templates?id=${template.id}`)
      if (!ok) {
        showError(data?.error || '템플릿 삭제 실패')
        return
      }
      showSuccess('삭제했습니다.')
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const renderEditor = (id: string | null, draft: Draft, setDraft: (next: Draft) => void) => (
    <div className="grid grid-2" style={{ gap: 12 }}>
      <div className="field">
        <label className="label">템플릿 이름</label>
        <input className="input compact" value={draft.name} placeholder="예: 롱폼 표준" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">적용 형식</label>
        <select className="select compact" value={draft.contentType} onChange={(e) => setDraft({ ...draft, contentType: e.target.value as Draft['contentType'] })}>
          <option value="">공통 (형식 무관)</option>
          <option value="longform">{CONTENT_TYPE_LABELS.longform}</option>
          <option value="shortform">{CONTENT_TYPE_LABELS.shortform}</option>
        </select>
      </div>
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label className="label">항목 (한 줄에 하나)</label>
        <textarea
          className="textarea compact"
          style={{ minHeight: 120 }}
          value={draft.itemsText}
          placeholder={'썸네일 확인\n종목 고지 문구 삽입\n면책 문구 삽입'}
          onChange={(e) => setDraft({ ...draft, itemsText: e.target.value })}
        />
      </div>
      <label className="v2-check" style={{ gridColumn: '1 / -1' }}>
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
        <span>이 형식의 기본 템플릿으로 사용 (새 아이템에 자동 적용)</span>
      </label>
      <div className="row" style={{ gridColumn: '1 / -1' }}>
        <button className="button" disabled={savingId === (id || 'new')} onClick={() => void save(id, draft)}>
          {savingId === (id || 'new') ? '저장 중...' : id ? '저장' : '템플릿 추가'}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        title="제작 표준 / 체크리스트"
        subtitle="영상마다 빠뜨리면 안 되는 항목(종목 고지, 면책 문구, 태그 등)을 템플릿으로 관리합니다. 제작 아이템이 생길 때 형식에 맞는 기본 템플릿이 자동으로 붙고, 카드에서 하나씩 체크합니다."
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="panel soft">
        <div className="v2-section-title">적용 규칙</div>
        <div className="small muted" style={{ lineHeight: 1.7 }}>
          1) 아이템 형식(롱폼/숏폼)의 기본 템플릿 → 2) 공통 기본 템플릿 → 3) 같은 형식의 아무 템플릿 → 4) 첫 템플릿 순으로 골라 붙입니다.
          {me.isAdmin ? ' 템플릿을 바꿔도 이미 만들어진 아이템의 체크리스트는 그대로 유지됩니다.' : ' 템플릿 편집은 관리자만 할 수 있습니다.'}
        </div>
      </div>

      {payload.items.length === 0 ? (
        <div className="panel">
          <div className="empty-state">{loaded ? '등록된 템플릿이 없습니다.' : ''}</div>
        </div>
      ) : (
        payload.items.map((template) => {
          const draft = drafts[template.id] || toDraft(template)
          return (
            <div className="panel" key={template.id}>
              <div className="panel-header">
                <div>
                  <div className="panel-title">
                    {template.name}{' '}
                    <span className={`v2-tag ${template.content_type ? `type-${template.content_type}` : ''}`} style={{ marginLeft: 6 }}>
                      {template.content_type ? CONTENT_TYPE_LABELS[template.content_type] : '공통'}
                    </span>
                    {template.is_default ? (
                      <span className="v2-tag ok" style={{ marginLeft: 4 }}>
                        기본
                      </span>
                    ) : null}
                  </div>
                  <p className="panel-subtitle">{template.items.length}개 항목</p>
                </div>
                {me.isAdmin ? (
                  <button className="button secondary xs" disabled={savingId === template.id} style={{ color: '#f87171' }} onClick={() => void remove(template)}>
                    삭제
                  </button>
                ) : null}
              </div>
              {me.isAdmin ? (
                renderEditor(template.id, draft, (next) => setDrafts((prev) => ({ ...prev, [template.id]: next })))
              ) : (
                <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                  {template.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
              )}
            </div>
          )
        })
      )}

      {me.isAdmin ? (
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">새 템플릿</div>
              <p className="panel-subtitle">특정 시리즈나 긴급 속보용 체크리스트를 따로 둘 수 있습니다.</p>
            </div>
          </div>
          {renderEditor(null, newDraft, setNewDraft)}
        </div>
      ) : null}
    </>
  )
}
