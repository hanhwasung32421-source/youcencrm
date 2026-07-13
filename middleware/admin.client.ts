export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return navigateTo('/login')

  const me = await fetchMe()
  if (!me) return navigateTo('/login')

  const isAdmin = me.roleType === 'super_admin' || me.roleType === 'admin'
  if (!isAdmin) return navigateTo('/creator/dashboard')
})
