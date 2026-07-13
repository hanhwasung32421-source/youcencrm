'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function SignupPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phoneMid, setPhoneMid] = useState('')
  const [phoneLast, setPhoneLast] = useState('')
  const [password, setPassword] = useState('')

  const [email, setEmail] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailAccessToken, setEmailAccessToken] = useState('')

  const [challengeCode, setChallengeCode] = useState('----')
  const [antiBotCode, setAntiBotCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const phoneMidRef = useRef<HTMLInputElement | null>(null)
  const phoneLastRef = useRef<HTMLInputElement | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const birthPickerRef = useRef<HTMLInputElement | null>(null)

  const refresh = async () => {
    setAntiBotCode('')
    const res = await fetch('/api/auth/challenge')
    const data = (await res.json()) as { code: string }
    setChallengeCode(data.code)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const sendEmailOtp = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim()
      })

      if (error) {
        setError(error.message)
        return
      }

      setEmailOtpSent(true)
      setEmailVerified(false)
      setMessage('이메일로 인증번호를 보냈습니다. 메일에 6자리 숫자가 오도록 Supabase 템플릿이 설정되어 있어야 합니다.')
    } finally {
      setLoading(false)
    }
  }

  const verifyEmailOtp = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: emailOtp.trim(),
        type: 'email'
      })

      if (error || !data.session?.access_token) {
        setError(error?.message || '인증번호가 올바르지 않습니다.')
        return
      }

      setEmailVerified(true)
      setEmailAccessToken(data.session.access_token)
      setMessage('이메일 인증이 완료되었습니다.')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (!emailVerified || !emailAccessToken) {
        setError('이메일 인증을 먼저 완료해 주세요.')
        return
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: emailAccessToken,
          loginId: loginId.trim(),
          name: name.trim(),
          birthDate: birthDate.trim(),
          phoneMid,
          phoneLast,
          password,
          antiBotCode
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
            가입 아이디와 기본 정보를 입력하고, 이메일 인증과 자동가입방지를 통과하면 가입이 완료됩니다.
          </p>
        </div>

        <div className="panel form-stack">
          <div className="field">
            <label className="label">아이디</label>
            <input className="input" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">이름</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">생년월일</label>
            <div className="row">
              <input
                className="input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                placeholder="19950710"
              />
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  birthPickerRef.current?.showPicker?.()
                  birthPickerRef.current?.click()
                }}
              >
                달력
              </button>
              <input
                ref={birthPickerRef}
                type="date"
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                onChange={(e) => {
                  const v = e.target.value // yyyy-mm-dd
                  if (!v) return
                  setBirthDate(v.replaceAll('-', ''))
                }}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">전화번호</label>
            <div className="row">
              <input className="input" style={{ maxWidth: 90, textAlign: 'center' }} value="010" disabled />
              <span className="muted">-</span>
              <input
                ref={phoneMidRef}
                className="input"
                style={{ maxWidth: 120, textAlign: 'center' }}
                value={phoneMid}
                maxLength={4}
                inputMode="numeric"
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                  setPhoneMid(next)
                  if (next.length === 4) phoneLastRef.current?.focus()
                }}
              />
              <span className="muted">-</span>
              <input
                ref={phoneLastRef}
                className="input"
                style={{ maxWidth: 120, textAlign: 'center' }}
                value={phoneLast}
                maxLength={4}
                inputMode="numeric"
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
                  setPhoneLast(next)
                  if (next.length === 4) emailRef.current?.focus()
                }}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">이메일</label>
            <div className="row">
              <input ref={emailRef} className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="button secondary" type="button" disabled={loading} onClick={sendEmailOtp}>
                인증보내기
              </button>
            </div>
          </div>

          {emailOtpSent ? (
            <div className="panel soft">
              <div className="row-between">
                <span className="label">이메일 인증번호 (6자리)</span>
                {emailVerified ? <span className="small message-success">인증 완료</span> : null}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <input className="input" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} placeholder="인증번호" />
                <button className="button" type="button" disabled={loading} onClick={verifyEmailOtp}>
                  확인
                </button>
              </div>
            </div>
          ) : null}

          <div className="field">
            <label className="label">비밀번호 (6자 이상)</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="panel soft">
            <div className="row-between">
              <span className="label">자동가입방지</span>
              <button className="button secondary" onClick={refresh}>새로 만들기</button>
            </div>
            <div className="row-between" style={{ marginTop: 12 }}>
              <div className="card-value">{challengeCode}</div>
              <input
                className="input"
                style={{ maxWidth: 140, textAlign: 'center' }}
                value={antiBotCode}
                maxLength={4}
                onChange={(e) => setAntiBotCode(e.target.value)}
                placeholder="4자리"
                inputMode="numeric"
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
