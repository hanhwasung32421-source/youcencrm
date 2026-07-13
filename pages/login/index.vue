<template>
  <div class="mx-auto max-w-md space-y-4">
    <h1 class="text-2xl font-semibold">로그인</h1>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div class="space-y-1">
        <div class="text-sm text-slate-300">이메일</div>
        <input v-model="email" class="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2" />
      </div>

      <div class="space-y-1">
        <div class="text-sm text-slate-300">비밀번호</div>
        <input
          v-model="password"
          type="password"
          class="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2"
        />
      </div>

      <button
        class="w-full rounded-md bg-cyan-600 px-3 py-2 font-medium hover:bg-cyan-500 disabled:opacity-50"
        :disabled="loading"
        @click="login"
      >
        로그인
      </button>

      <div v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</div>
      <div class="text-sm text-slate-400">
        계정이 없나요?
        <NuxtLink class="text-cyan-400 hover:underline" to="/signup">회원가입</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabase()
const me = useMeState()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function login() {
  errorMsg.value = ''
  loading.value = true
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    })

    if (error || !data.session) {
      errorMsg.value = error?.message || '로그인에 실패했습니다.'
      return
    }

    // 로그인 이벤트 기록 (IP 저장)
    await $fetch('/api/auth/log-login', {
      method: 'POST',
      body: { accessToken: data.session.access_token }
    }).catch(() => {})

    const meInfo = await fetchMe()
    const isAdmin = meInfo?.roleType === 'super_admin' || meInfo?.roleType === 'admin'
    await navigateTo(isAdmin ? '/admin/dashboard' : '/creator/dashboard')
  } finally {
    loading.value = false
  }
}
</script>
