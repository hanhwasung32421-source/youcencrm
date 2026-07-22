'use client'

import { Suspense } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Item = {
  id: string
  title: string | null
  youtube_url: string | null
  uploaded_at: string | null
  view_count: number | null
}

type ApiResponse = {
  user: { id: string; name: string }
  pagination: { page: number; pageSize: number; totalCount: number }
  sort: { sortKey: string; sortDir: 'asc' | 'desc' }
  items: Item[]
}

function AdminUploadsPageInner() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId') || ''

  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'uploaded_at' | 'title' | 'view_count'>('uploaded_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const totalPages = useMemo(() => {
    const totalCount = data?.pagination.totalCount || 0
    const pageSize = data?.pagination.pageSize || 10
    return Math.max(Math.ceil(totalCount / pageSize), 1)
  }, [data])

  const formatDate = (value: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ko-KR')
  }

  const load = async (nextPage = page, nextSortKey = sortKey, nextSortDir = sortDir) => {
    setError('')
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const qs = new URLSearchParams({
      userId,
      page: String(nextPage),
      sortKey: nextSortKey,
      sortDir: nextSortDir
    }).toString()
    const res = await fetch(`/api/admin/videos/by-user?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || '업로드 내역 조회 실패')
      return
    }
    setData(json as ApiResponse)
  }

  useEffect(() => {
    setPage(1)
    void load(1, sortKey, sortDir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    void load(page, sortKey, sortDir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortDir])

  const toggleSort = (key: 'uploaded_at' | 'title' | 'view_count') => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('desc')
      setPage(1)
      return
    }
    setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    setPage(1)
  }

  const pageButtons = useMemo(() => {
    const last = totalPages
    const buttons: Array<number | 'dots' | 'last'> = []
    const maxHead = Math.min(5, last)
    for (let i = 1; i <= maxHead; i += 1) buttons.push(i)
    if (last > 5) {
      buttons.push('dots')
      buttons.push('last')
    }
    return buttons
  }, [totalPages])

  return (
    <AuthGuard requireAdmin>
      <AppShell title="업로드 내역" subtitle={data ? `${data.user.name} 님의 업로드 내역입니다.` : '업로드 내역을 불러옵니다.'}>
        {error ? <div className="message-error small">{error}</div> : null}

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">업로드 내역</div>
              <p className="panel-subtitle">제목/업로드일자/조회수로 정렬할 수 있고, 제목을 누르면 유튜브로 이동합니다.</p>
            </div>
          </div>

          <div className="data-table" style={{ marginTop: 16 }}>
            <div className="data-table-header" style={{ gridTemplateColumns: '1.6fr 0.9fr 0.7fr' }}>
              <button className="button secondary" style={{ justifyContent: 'flex-start' }} onClick={() => toggleSort('title')}>
                제목
              </button>
              <button className="button secondary" style={{ justifyContent: 'flex-start' }} onClick={() => toggleSort('uploaded_at')}>
                업로드일자
              </button>
              <button className="button secondary" style={{ justifyContent: 'flex-end' }} onClick={() => toggleSort('view_count')}>
                조회수
              </button>
            </div>

            {(data?.items || []).length === 0 ? (
              <div className="data-table-row" style={{ gridTemplateColumns: '1.6fr 0.9fr 0.7fr' }}>
                <div className="muted">데이터 없음</div>
                <div />
                <div />
              </div>
            ) : (
              (data?.items || []).map((item) => (
                <div className="data-table-row" key={item.id} style={{ gridTemplateColumns: '1.6fr 0.9fr 0.7fr' }}>
                  <div>
                    {item.youtube_url ? (
                      <a className="link" href={item.youtube_url} target="_blank" rel="noreferrer">
                        {item.title || '제목 없음'}
                      </a>
                    ) : (
                      item.title || '제목 없음'
                    )}
                  </div>
                  <div className="data-right">{formatDate(item.uploaded_at)}</div>
                  <div className="data-right">{(item.view_count || 0).toLocaleString('ko-KR')}</div>
                </div>
              ))
            )}
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            {pageButtons.map((p) => {
              if (p === 'dots') return <div key="dots" className="muted">~</div>
              if (p === 'last') {
                return (
                  <button
                    key="last"
                    className={`button secondary ${page === totalPages ? 'active' : ''}`}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                )
              }
              return (
                <button key={p} className={`button secondary ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

export default function AdminUploadsPage() {
  return (
    <Suspense>
      <AdminUploadsPageInner />
    </Suspense>
  )
}
