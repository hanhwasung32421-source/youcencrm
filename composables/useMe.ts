type MeInfo = {
  crmUserId: string
  roleType: string
  name: string
  employmentStatus: string
}

export const useMeState = () => useState<MeInfo | null>('me', () => null)

export async function fetchMe() {
  const supabase = useSupabase()
  const meState = useMeState()

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    meState.value = null
    return null
  }

  const me = await $fetch<MeInfo>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  meState.value = me
  return me
}

