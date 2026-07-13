<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">근태 관리</h1>
      <p class="mt-1 text-sm text-slate-400">
        총 관리자와 관리자는 직원의 근태를 일별, 주별, 월별로 보고, 직원을 클릭해 출근/지각/휴가/조퇴를 등록할 수 있습니다.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="p in periods"
        :key="p.value"
        class="rounded-md border px-3 py-2 text-sm"
        :class="period === p.value ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300' : 'border-slate-800 bg-slate-900/40 text-slate-300'"
        @click="changePeriod(p.value)"
      >
        {{ p.label }}
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="mb-3 text-sm font-medium text-slate-200">직원 목록</div>
        <div class="space-y-2">
          <button
            v-for="user in users"
            :key="user.id"
            class="w-full rounded-md border px-3 py-2 text-left"
            :class="selectedUser?.id === user.id ? 'border-cyan-500 bg-cyan-600/10' : 'border-slate-800 bg-slate-950/60'"
            @click="selectedUser = user"
          >
            <div class="font-medium">{{ user.name }}</div>
            <div class="text-xs text-slate-400">{{ roleLabel(user.role_type) }}</div>
          </button>
        </div>
      </section>

      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div v-if="!selectedUser" class="text-sm text-slate-500">직원을 선택해 주세요.</div>

        <template v-else>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">{{ selectedUser.name }}</div>
              <div class="text-sm text-slate-400">{{ roleLabel(selectedUser.role_type) }}</div>
            </div>
            <input v-model="selectedDate" type="date" class="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm" />
          </div>

          <div class="grid gap-2 md:grid-cols-4">
            <button class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500" @click="setAttendance('present')">출근</button>
            <button class="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium hover:bg-amber-500" @click="setAttendance('late')">지각</button>
            <button class="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium hover:bg-violet-500" @click="setAttendance('vacation')">휴가</button>
            <button class="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium hover:bg-rose-500" @click="setAttendance('early_leave')">조퇴</button>
          </div>

          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <div class="mb-2 text-sm font-medium text-slate-200">최근 근태 기록</div>
            <div v-if="selectedDays.length === 0" class="text-sm text-slate-500">선택한 기간에 기록이 없습니다.</div>
            <div v-else class="space-y-2">
              <div
                v-for="day in selectedDays"
                :key="day.id"
                class="rounded-md border border-slate-800 bg-slate-950 p-3"
              >
                <div class="font-medium">{{ day.work_date }}</div>
                <div class="mt-1 text-sm text-slate-400">{{ attendanceLabel(day.attendance_status) }}</div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="message" class="text-sm text-emerald-400">{{ message }}</div>
        <div v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

type UserItem = {
  id: string
  name: string
  role_type: string
  employment_status: string
}

type AttendanceDay = {
  id: string
  user_id: string
  work_date: string
  attendance_status: string
  check_in_at: string | null
  check_out_at: string | null
}

const supabase = useSupabase()
const period = ref<'day' | 'week' | 'month'>('day')
const users = ref<UserItem[]>([])
const days = ref<AttendanceDay[]>([])
const selectedUser = ref<UserItem | null>(null)
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const message = ref('')
const errorMsg = ref('')

const periods = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' }
] as const

onMounted(async () => {
  await loadAttendance()
})

const selectedDays = computed(() => {
  if (!selectedUser.value) return []
  return days.value.filter((day) => day.user_id === selectedUser.value?.id)
})

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function loadAttendance() {
  const token = await getAccessToken()
  if (!token) return
  const res = await $fetch<{ users: UserItem[]; days: AttendanceDay[] }>(`/api/admin/attendance?period=${period.value}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  users.value = res.users || []
  days.value = res.days || []
  if (!selectedUser.value && users.value.length > 0) {
    selectedUser.value = users.value[0]
  }
}

async function changePeriod(value: 'day' | 'week' | 'month') {
  period.value = value
  await loadAttendance()
}

async function setAttendance(status: 'present' | 'late' | 'vacation' | 'early_leave') {
  if (!selectedUser.value) return
  message.value = ''
  errorMsg.value = ''
  try {
    const token = await getAccessToken()
    await $fetch('/api/admin/attendance/set', {
      method: 'POST',
      body: {
        accessToken: token,
        userId: selectedUser.value.id,
        workDate: selectedDate.value,
        attendanceStatus: status
      }
    })
    message.value = '근태가 등록되었습니다.'
    await loadAttendance()
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '근태 등록에 실패했습니다.'
  }
}

function roleLabel(value: string) {
  const map: Record<string, string> = {
    super_admin: '총 관리자',
    admin: '관리자',
    general_manager: '부장',
    manager: '과장',
    assistant_manager: '대리',
    senior_staff: '주임',
    staff: '직원',
    retired: '퇴사'
  }
  return map[value] || value
}

function attendanceLabel(value: string) {
  const map: Record<string, string> = {
    not_started: '미등록',
    present: '출근',
    late: '지각',
    vacation: '휴가',
    early_leave: '조퇴',
    review_needed: '검토 필요'
  }
  return map[value] || value
}
</script>

