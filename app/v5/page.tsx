import { redirect } from 'next/navigation'

// 로그인 페이지가 역할에 맞는 홈(/v5/canvas 또는 /v5/register)으로 보낸다.
export default function HomePage() {
  redirect('/v5/login')
}
