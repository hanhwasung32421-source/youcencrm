<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">영상 등록</h1>
      <p class="mt-1 text-sm text-slate-400">
        유튜브 업로드가 끝난 뒤 영상 주소를 입력하면, 업로드 날짜/시간과 기본 통계가 자동으로 저장됩니다.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div class="space-y-1">
          <div class="text-sm text-slate-300">유튜브 영상 주소</div>
          <input
            v-model="form.youtubeUrl"
            class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">콘텐츠 형식</div>
          <select v-model="form.contentType" class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <option value="longform">롱폼</option>
            <option value="shortform">숏폼</option>
          </select>
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">주요 종목명</div>
          <input
            v-model="form.stockName"
            class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
            placeholder="예: 삼성전자"
          />
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">카테고리</div>
          <input
            v-model="form.contentCategory"
            class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
            placeholder="예: 종목 브리핑"
          />
        </div>

        <button
          class="w-full rounded-md bg-cyan-600 px-3 py-2 font-medium hover:bg-cyan-500 disabled:opacity-50"
          :disabled="loading"
          @click="submitVideo"
        >
          작성 버튼
        </button>

        <div v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</div>
        <div v-if="successMsg" class="text-sm text-emerald-400">{{ successMsg }}</div>
      </section>

      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-medium text-slate-200">최근 등록 영상</div>
          <button class="text-xs text-cyan-400 hover:underline" @click="loadMyVideos">새로고침</button>
        </div>

        <div v-if="items.length === 0" class="text-sm text-slate-500">아직 등록된 영상이 없습니다.</div>

        <div v-else class="space-y-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="rounded-md border border-slate-800 bg-slate-950/60 p-3"
          >
            <div class="font-medium">{{ item.title || '제목 없음' }}</div>
            <div class="mt-1 text-sm text-slate-400">
              {{ item.stock_name }} · {{ item.content_type === 'longform' ? '롱폼' : '숏폼' }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              업로드 시각: {{ formatDate(item.published_at) }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              조회수 {{ item.view_count ?? 0 }} · 좋아요 {{ item.like_count ?? 0 }} · 댓글 {{ item.comment_count ?? 0 }}
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

type VideoItem = {
  id: string
  title: string | null
  stock_name: string
  content_type: 'longform' | 'shortform'
  published_at: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
}

const supabase = useSupabase()
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const items = ref<VideoItem[]>([])

const form = reactive({
  youtubeUrl: '',
  contentType: 'longform' as 'longform' | 'shortform',
  stockName: '',
  contentCategory: ''
})

onMounted(async () => {
  await loadMyVideos()
})

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function loadMyVideos() {
  const token = await getAccessToken()
  if (!token) return

  const res = await $fetch<{ items: VideoItem[] }>('/api/videos/mine', {
    headers: { Authorization: `Bearer ${token}` }
  })
  items.value = res.items || []
}

async function submitVideo() {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    const token = await getAccessToken()
    if (!token) {
      errorMsg.value = '로그인이 필요합니다.'
      return
    }

    await $fetch('/api/videos/create', {
      method: 'POST',
      body: {
        accessToken: token,
        youtubeUrl: form.youtubeUrl.trim(),
        contentType: form.contentType,
        stockName: form.stockName.trim(),
        contentCategory: form.contentCategory.trim() || null
      }
    })

    successMsg.value = '영상이 CRM에 저장되었습니다. 업로드 날짜와 기본 통계도 자동 반영되었습니다.'
    form.youtubeUrl = ''
    form.contentType = 'longform'
    form.stockName = ''
    form.contentCategory = ''
    await loadMyVideos()
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '영상 저장에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}
</script>

