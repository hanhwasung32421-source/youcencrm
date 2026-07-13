'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { APP_ORIGIN } from '@/lib/app-config'

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
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailAccessToken, setEmailAccessToken] = useState('')

  const [challengeCode, setChallengeCode] = useState('----')
  const [antiBotCode, setAntiBotCode] = useState('')
  const [error, setError] = useState('')
  const [emailSendError, setEmailSendError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailCooldownUntil, setEmailCooldownUntil] = useState(0)
  const phoneMidRef = useRef<HTMLInputElement | null>(null)
  const phoneLastRef = useRef<HTMLInputElement | null>(null)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const birthRef = useRef<HTMLInputElement | null>(null)

  const refresh = async () => {
    setAntiBotCode('')
    const res = await fetch('/api/auth/challenge')
    const data = (await res.json()) as { code: string }
    setChallengeCode(data.code)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const syncFromSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session?.access_token || !session.user?.email) return

      setEmailVerified(true)
      setEmailAccessToken(session.access_token)
      setEmail(session.user.email)
    }

    void syncFromSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void syncFromSession()
    })

    return () => subscription.unsubscribe()
  }, [email])

  const sendEmailOtp = async () => {
    setError('')
    setMessage('')
    setEmailSendError('')

    if (!email.trim()) {
      setEmailSendError('이메일을 먼저 입력해 주세요.')
      return
    }

    const remainMs = emailCooldownUntil - Date.now()
    if (remainMs > 0) {
      const remainSec = Math.ceil(remainMs / 1000)
      setEmailSendError(`인증 메일 전송 제한 중입니다. ${remainSec}초 후 다시 시도해 주세요.`)
      return
    }

    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // 사용자가 메일의 Sign in 버튼을 누르면 /signup 으로 돌아오게
          emailRedirectTo: `${APP_ORIGIN}/signup`
        }
      })

      if (error) {
        const status = (error as { status?: number } | null)?.status
        const message = error.message || ''
        if (status === 429 || /too many|rate limit|429/i.test(message)) {
          const cooldownMs = 30 * 1000
          setEmailCooldownUntil(Date.now() + cooldownMs)
          setEmailSendError('인증 메일 전송 요청이 너무 많습니다. 30초 후 다시 시도해 주세요.')
        } else {
          setEmailSendError(message)
        }
        return
      }

      setEmailOtpSent(true)
      setEmailVerified(false)
      setEmailCooldownUntil(Date.now() + 30 * 1000)
      setMessage('이메일을 보냈습니다. 메일에서 Sign in 버튼을 누르면 회원가입 페이지로 돌아옵니다.')
    } catch (e: any) {
      setEmailSendError(e?.message || '인증 메일 전송 중 오류가 발생했습니다.')
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
            1단계에서 이메일 인증을 하고, 2단계에서 가입 정보를 입력합니다.
          </p>
        </div>

        <div className="panel form-stack">
          <div className="field">
            <label className="label">이메일</label>
            <div className="row">
              <input
                ref={emailRef}
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={emailVerified}
              />
              {!emailVerified ? (
                <button
                  className="button secondary multiline"
                  type="button"
                  disabled={loading || emailCooldownUntil > Date.now()}
                  onClick={sendEmailOtp}
                >
                  <span className="button-multiline-label">
                    <span>인증</span>
                    <span>전송</span>
                  </span>
                </button>
              ) : null}
            </div>
            {emailSendError ? <div className="message-error small">{emailSendError}</div> : null}
          </div>

          {!emailVerified && emailOtpSent ? (
            <div className="panel soft">
              <div className="row-between">
                <span className="label">이메일 인증</span>
              </div>
              <div className="small muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                메일에서 <b>Sign in</b> 버튼을 클릭해 주세요. 클릭하면 이 페이지로 다시 돌아옵니다.
              </div>
            </div>
          ) : null}
          {emailVerified ? (
            <>
              <div className="field">
                <label className="label">아이디</label>
                <input className="input" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">비밀번호 (6자 이상)</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">이름</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">생년월일</label>
                <input
                  ref={birthRef}
                  className="input"
                  value={birthDate}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^\d]/g, '').slice(0, 8)
                    setBirthDate(next)
                    if (next.length === 8) phoneMidRef.current?.focus()
                  }}
                  placeholder="19950710"
                  inputMode="numeric"
                />
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
                      if (next.length === 4) setTimeout(() => emailRef.current?.focus(), 0)
                    }}
                  />
                </div>
              </div>
              <div className="panel soft">
                <div className="row-between">
                  <span className="label">자동가입방지</span>
                  <button className="button secondary" onClick={refresh}>
                    새로 만들기
                  </button>
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
            </>
          ) : null}

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
