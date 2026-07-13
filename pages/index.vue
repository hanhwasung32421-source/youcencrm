<template>
  <div class="space-y-3">
    <h1 class="text-xl font-semibold">시작</h1>
    <div class="text-slate-300">로그인 상태에 따라 자동 이동합니다.</div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabase()

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return navigateTo('/login')

  const me = await fetchMe().catch(() => null)
  if (!me) return navigateTo('/login')

  const isAdmin = me.roleType === 'super_admin' || me.roleType === 'admin'
  return navigateTo(isAdmin ? '/admin/dashboard' : '/creator/dashboard')
})
</script>
