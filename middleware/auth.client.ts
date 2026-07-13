export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/signup') return

  // 보호할 경로만 적용 (필요 시 확장)
  const needsAuth = to.path.startsWith('/creator') || to.path.startsWith('/admin')
  if (!needsAuth) return

  const supabase = useSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return navigateTo('/login')
  }
})

