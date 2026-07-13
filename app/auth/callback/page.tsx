'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const url = new URL(window.location.href)
      const next = url.searchParams.get('next') || '/signup'
      const code = url.searchParams.get('code')

      // PKCE 흐름일 때 code가 오는 경우가 있어서 교환 시도
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code)
        } catch {
          // 무시: getSession으로 최종 확인
        }
      }

      router.replace(next)
    }

    void run()
  }, [router])

  return (
    <div className="auth-wrap">
      <div className="auth-center">
        <div className="panel" style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
          <div className="panel-title">인증 처리 중</div>
          <p className="panel-subtitle">잠시만 기다려 주세요.</p>
        </div>
      </div>
    </div>
  )
}
