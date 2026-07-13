<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold">유튜브 계정 관리</h1>
      <p class="mt-1 text-sm text-slate-400">
        유튜브 계정 이름과 API 키를 계속 추가할 수 있습니다. 이후 유튜버는 영상 등록 시 계정을 선택하고 URL을 입력하면 해당 계정 기준으로 메타와 통계를 가져옵니다.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div class="space-y-1">
          <div class="text-sm text-slate-300">계정 이름</div>
          <input v-model="form.accountName" class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2" placeholder="예: 주식센터 A계정" />
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">YouTube API 키</div>
          <input v-model="form.apiKey" class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2" placeholder="AIza..." />
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">채널 ID (선택)</div>
          <input v-model="form.channelId" class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2" placeholder="UC..." />
        </div>

        <div class="space-y-1">
          <div class="text-sm text-slate-300">채널 이름 (선택)</div>
          <input v-model="form.channelName" class="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2" placeholder="예: 한화성 투자센터" />
        </div>

        <button class="w-full rounded-md bg-cyan-600 px-3 py-2 font-medium hover:bg-cyan-500" @click="saveAccount">
          유튜브 계정 추가
        </button>

        <div v-if="message" class="text-sm text-emerald-400">{{ message }}</div>
        <div v-if="errorMsg" class="text-sm text-red-400">{{ errorMsg }}</div>
      </section>

      <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-medium text-slate-200">등록된 유튜브 계정</div>
          <button class="text-xs text-cyan-400 hover:underline" @click="loadAccounts">새로고침</button>
        </div>

        <div v-if="items.length === 0" class="text-sm text-slate-500">등록된 유튜브 계정이 없습니다.</div>

        <div v-else class="space-y-3">
          <div v-for="item in items" :key="item.id" class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <div class="font-medium">{{ item.account_name }}</div>
            <div class="mt-1 text-sm text-slate-400">채널명: {{ item.channel_name || '-' }}</div>
            <div class="mt-1 text-sm text-slate-400">채널ID: {{ item.channel_id || '-' }}</div>
            <div class="mt-1 text-xs text-slate-500">API 키: {{ maskApiKey(item.api_key) }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })

type YoutubeAccount = {
  id: string
  account_name: string
  api_key: string
  channel_id: string | null
  channel_name: string | null
}

const supabase = useSupabase()
const items = ref<YoutubeAccount[]>([])
const message = ref('')
const errorMsg = ref('')
const form = reactive({
  accountName: '',
  apiKey: '',
  channelId: '',
  channelName: ''
})

onMounted(async () => {
  await loadAccounts()
})

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function loadAccounts() {
  errorMsg.value = ''
  const token = await getAccessToken()
  if (!token) return
  const res = await $fetch<{ items: YoutubeAccount[] }>('/api/admin/youtube-accounts', {
    headers: { Authorization: `Bearer ${token}` }
  })
  items.value = res.items || []
}

async function saveAccount() {
  message.value = ''
  errorMsg.value = ''
  try {
    const token = await getAccessToken()
    await $fetch('/api/admin/youtube-accounts/create', {
      method: 'POST',
      body: {
        accessToken: token,
        accountName: form.accountName,
        apiKey: form.apiKey,
        channelId: form.channelId || null,
        channelName: form.channelName || null
      }
    })

    form.accountName = ''
    form.apiKey = ''
    form.channelId = ''
    form.channelName = ''
    message.value = '유튜브 계정이 저장되었습니다.'
    await loadAccounts()
  } catch (e: any) {
    errorMsg.value = e?.statusMessage || e?.message || '유튜브 계정 저장에 실패했습니다.'
  }
}

function maskApiKey(value: string) {
  if (!value) return '-'
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}
</script>

