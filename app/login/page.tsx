'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      let loginEmail = email.trim()
      let loginPassword = password

      if (loginEmail.toLowerCase() === 'admin' && password === 'a1234') {
        loginEmail = 'admin@youcencrm.local'
        loginPassword = 'a1234'
      }

      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      })

      if (error || !data.session?.access_token) {
        setError(error?.message || '로그인에 실패했습니다.')
        return
      }

      await fetch('/api/auth/log-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: data.session.access_token })
      })

      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      })

      if (!meRes.ok) {
        setError('프로필 조회에 실패했습니다.')
        return
      }

      const me = (await meRes.json()) as { roleType: string }
      if (['super_admin', 'admin'].includes(me.roleType)) {
        router.push('/admin/dashboard')
      } else {
        router.push('/creator/dashboard')
      }
    } catch (e: any) {
      setError(e?.message || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-center">
        <div className="panel form-stack" style={{ width: '100%', maxWidth: 520 }}>
          <h1 className="auth-title">여왕개미미디어 CRM</h1>
          <p className="auth-subtitle">DB통계 CRM</p>
          <div className="field">
            <label className="label">이메일</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSubmit()
              }}
            />
          </div>
          <div className="field">
            <label className="label">비밀번호</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSubmit()
              }}
            />
          </div>
          <button className="button" disabled={loading} onClick={onSubmit}>
            로그인
          </button>
          {error ? <div className="message-error small">{error}</div> : null}
          <div className="small muted">
            계정이 없나요? <Link className="link" href="/signup">회원가입</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
