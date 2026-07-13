<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">관리자 대시보드</h1>

    <div class="grid gap-3 md:grid-cols-4">
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">오늘 CRM 등록</div>
        <div class="mt-1 text-lg">{{ stats.todayRegisteredCount }}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">근태 관리</div>
        <div class="mt-1 text-lg">
          <NuxtLink to="/admin/attendance" class="text-cyan-400 hover:underline">바로 가기</NuxtLink>
        </div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">직급 관리</div>
        <div class="mt-1 text-lg">
          <NuxtLink to="/admin/users" class="text-cyan-400 hover:underline">바로 가기</NuxtLink>
        </div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">미분류 IP 로그인</div>
        <div class="mt-1 text-lg">{{ stats.unknownIpCount }}</div>
      </div>
    </div>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div class="text-sm text-slate-300">운영 기준</div>
      <div class="mt-2 text-sm text-slate-400">
        이 CRM은 유튜브에 업로드하는 시스템이 아니라, 업로드 완료 후 URL을 입력받아 업로드 날짜/시간과 기본 통계를 저장하고 비교하는 통계형 CRM입니다.
      </div>
      <div class="mt-2 text-sm text-slate-400">
        유튜브 계정이 여러 개면 관리자 페이지에서 계정 이름과 API 키를 계속 추가할 수 있습니다.
        <NuxtLink to="/admin/youtube-accounts" class="ml-1 text-cyan-400 hover:underline">유튜브 계정 관리</NuxtLink>
      </div>
    </div>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div class="mb-3 text-sm font-medium text-slate-200">최근 등록 영상</div>
      <div v-if="stats.latest.length === 0" class="text-sm text-slate-500">아직 등록된 영상이 없습니다.</div>
      <div v-else class="space-y-2">
        <div v-for="item in stats.latest" :key="item.id" class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <div class="font-medium">{{ item.title || '제목 없음' }}</div>
          <div class="mt-1 text-sm text-slate-400">{{ item.stock_name }} · {{ item.content_type === 'longform' ? '롱폼' : '숏폼' }}</div>
          <div class="mt-1 text-xs text-slate-500">조회수 {{ item.view_count ?? 0 }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

const supabase = useSupabase()
const stats = ref({
  todayRegisteredCount: 0,
  unknownIpCount: 0,
  latest: [] as Array<{
    id: string
    title: string | null
    stock_name: string
    content_type: 'longform' | 'shortform'
    published_at: string | null
    view_count: number | null
  }>
})

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return
  const res = await $fetch('/api/dashboard/admin', {
    headers: { Authorization: `Bearer ${token}` }
  })
  stats.value = res as any
})
</script>
