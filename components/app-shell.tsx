'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Me = {
  name: string
  roleType: string
}

export function AppShell({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (!session?.access_token) return

        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (!res.ok) return
        const data = (await res.json()) as Me & { crmUserId: string; employmentStatus: string }
        setMe({ name: data.name, roleType: data.roleType })
      } catch {}
    }

    void run()
  }, [])

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        <div className="row">
          <Link className="link small" href="/">
            홈
          </Link>
          {me ? <span className="pill small">{me.name} · {me.roleType}</span> : null}
          <button className="button secondary" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

