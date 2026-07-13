<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">직원 직급 관리</h1>
      <p class="mt-1 text-sm text-slate-400">
        총 관리자와 관리자는 하위 직원의 직급을 변경할 수 있습니다. 처음 가입한 계정은 기본적으로 직원입니다.
      </p>
    </div>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div v-if="items.length === 0" class="text-sm text-slate-500">직원 목록이 없습니다.</div>

      <div v-else class="space-y-3">
        <div
          v-for="user in items"
          :key="user.id"
          class="rounded-md border border-slate-800 bg-slate-950/60 p-3"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="font-medium">{{ user.name }}</div>
              <div class="text-sm text-slate-400">{{ user.email }}</div>
            </div>

            <div class="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                v-model="user.role_type"
                class="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              >
                <option v-for="role in roles" :key="role.value" :value="role.value">
                  {{ role.label }}
                </option>
              </select>
              <button
                class="rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500"
                @click="saveRole(user.id, user.role_type)"
              >
                직급 저장
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="message" class="mt-3 text-sm text-emerald-400">{{ message }}</div>
      <div v-if="errorMsg" class="mt-3 text-sm text-red-400">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

type UserItem = {
  id: string
  name: string
  email: string
  role_type: string
  employment_status: string
}

const supabase = useSupabase()
const items = ref<UserItem[]>([])
const errorMsg = ref('')
const message = ref('')

const roles = [
  { value: 'super_admin', label: '총 관리자' },
  { value: 'admin', label: '관리자' },
  { value: 'general_manager', label: '부장' },
  { value: 'manager', label: '과장' },
  { value: 'assistant_manager', label: '대리' },
  { value: 'senior_staff', label: '주임' },
  { value: 'staff', label: '직원' },
  { value: 'retired', label: '퇴사' }
]

onMounted(async () => {
  await loadUsers()
})

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function loadUsers() {
  errorMsg.value = ''
  const token = await getAccessToken()
  if (!token) return
  const res = await $fetch<{ items: UserItem[] }>('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` }
  })
  items.value = res.items || []
}

async function saveRole(userId: string, roleType: string) {
  message.value = ''
  errorMsg.value = ''
  try {
    const token = await getAccessToken()
    await $fetch('/api/admin/users/role', {
      method: 'POST',
      body: {
        accessToken: token,
        userId,
        roleType
      }
    })
    message.value = '직급이 저장되었습니다.'
    await loadUsers()
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '직급 저장에 실패했습니다.'
  }
}
</script>

