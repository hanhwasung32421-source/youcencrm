<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">유튜버 대시보드</h1>
    <div class="grid gap-3 md:grid-cols-4">
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">오늘 CRM 등록</div>
        <div class="mt-1 text-lg">{{ stats.todayRegisteredCount }}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">영상 등록</div>
        <div class="mt-1 text-lg">
          <NuxtLink to="/creator/videos" class="text-cyan-400 hover:underline">바로 가기</NuxtLink>
        </div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">최근 등록 영상</div>
        <div class="mt-1 text-lg">{{ stats.latest.length }}</div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="text-xs text-slate-400">통계 반영</div>
        <div class="mt-1 text-lg">자동</div>
      </div>
    </div>

    <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div class="text-sm text-slate-300">등록 방식</div>
      <div class="mt-2 text-sm text-slate-400">
        유튜브 업로드는 유튜버가 따로 진행하고, 업로드 후 영상 주소와 롱폼/숏폼, 주요 종목명만 CRM에 입력합니다.
      </div>
      <div class="mt-1 text-sm text-slate-400">
        작성 버튼을 누르면 업로드 날짜/시간과 기본 통계가 자동 저장되어 이후 대시보드와 통계에 반영됩니다.
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
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabase()
const stats = ref({
  todayRegisteredCount: 0,
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
  const res = await $fetch('/api/dashboard/creator', {
    headers: { Authorization: `Bearer ${token}` }
  })
  stats.value = res as any
})
</script>
