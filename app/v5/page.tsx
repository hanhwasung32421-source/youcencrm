import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/v5/login')
}
