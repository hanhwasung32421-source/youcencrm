'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challengeCode, setChallengeCode] = useState('----')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setCode('')
    setError('')
    const res = await fetch('/api/auth/challenge')
    const data = (await res.json()) as { code: string }
    setChallengeCode(data.code)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const onSubmit = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          code
        })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || '회원가입에 실패했습니다.')
        await refresh()
        return
      }

      setMessage('회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.')
      setTimeout(() => {
        router.push('/login')
      }, 1000)
    } catch (e: any) {
      setError(e?.message || '회원가입 중 오류가 발생했습니다.')
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-shell">
        <div className="panel soft">
          <div className="panel-title">회원가입</div>
          <p className="panel-subtitle">
            처음 가입하는 계정은 기본 직급이 `직원`으로 생성됩니다. 아래 4자리 숫자 확인 절차를 통과해야 가입이 완료됩니다.
          </p>
        </div>

        <div className="panel form-stack">
          <div className="field">
            <label className="label">이메일</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">비밀번호</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="panel soft">
            <div className="row-between">
              <span className="label">가입 확인 숫자</span>
              <button className="button secondary" onClick={refresh}>새로 만들기</button>
            </div>
            <div className="row-between" style={{ marginTop: 12 }}>
              <div className="card-value">{challengeCode}</div>
              <input
                className="input"
                style={{ maxWidth: 140, textAlign: 'center' }}
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value)}
                placeholder="4자리"
              />
            </div>
          </div>
          <button className="button" disabled={loading} onClick={onSubmit}>
            가입하기
          </button>
          {error ? <div className="message-error small">{error}</div> : null}
          {message ? <div className="message-success small">{message}</div> : null}
          <div className="small muted">
            이미 계정이 있나요? <Link className="link" href="/login">로그인</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
