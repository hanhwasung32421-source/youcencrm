<template>
  <div class="mx-auto max-w-md space-y-4">
    <h1 class="text-2xl font-semibold">회원가입</h1>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div class="space-y-1">
        <div class="text-sm text-slate-300">이메일</div>
        <input v-model="email" class="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2" />
      </div>

      <div class="space-y-1">
        <div class="text-sm text-slate-300">비밀번호 (6자 이상)</div>
        <input
          v-model="password"
          type="password"
          class="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2"
        />
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-300">가입 확인 숫자</div>
          <button class="text-xs text-cyan-400 hover:underline" @click="refreshCode">새로 만들기</button>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <div class="text-3xl font-bold tracking-widest">{{ challengeCode }}</div>
          <input
            v-model="codeInput"
            maxlength="4"
            class="w-28 rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-center tracking-widest"
            placeholder="4자리"
          />
        </div>
        <div class="mt-2 text-xs text-slate-500">
          화면에 표시된 숫자를 그대로 입력해야 가입할 수 있습니다.
        </div>
      </div>

      <button
        class="w-full rounded-md bg-cyan-600 px-3 py-2 font-medium hover:bg-cyan-500 disabled:opacity-50"
        :disabled="loading"
        @click="signup"
      >
        가입하기
      </button>

      <div v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</div>
      <div class="text-sm text-slate-400">
        이미 계정이 있나요?
        <NuxtLink class="text-cyan-400 hover:underline" to="/login">로그인</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const codeInput = ref('')
const challengeCode = ref('----')
const loading = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  await refreshCode()
})

async function refreshCode() {
  errorMsg.value = ''
  codeInput.value = ''
  const res = await $fetch<{ code: string }>('/api/auth/challenge')
  challengeCode.value = res.code
}

async function signup() {
  errorMsg.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        password: password.value,
        code: codeInput.value
      }
    })
    await navigateTo('/login')
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '회원가입에 실패했습니다.'
    // 실패 시 새 코드로 교체
    await refreshCode().catch(() => {})
  } finally {
    loading.value = false
  }
}
</script>

