<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="text-lg font-semibold">유튜브센터 CRM</div>
          <div class="text-xs text-slate-400">
            <span v-if="me">{{ me.roleType }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div v-if="me" class="text-sm text-slate-300">{{ me.name }}</div>
          <button
            v-if="me"
            class="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-900"
            @click="logout"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabase()
const me = useMeState()

onMounted(async () => {
  // 로그인 상태라면 프로필 미리 로딩
  await fetchMe().catch(() => {})
})

async function logout() {
  await supabase.auth.signOut()
  me.value = null
  await navigateTo('/login')
}
</script>

