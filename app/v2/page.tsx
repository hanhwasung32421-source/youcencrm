import { redirect } from 'next/navigation'
import { V2_HOME_HREF } from '@/lib/v2/menu'

// 로그인 여부는 (ops) 레이아웃의 AuthGuard가 판단해 /v2/login으로 돌려보낸다.
export default function HomePage() {
  redirect(V2_HOME_HREF)
}
