import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { extractYoutubeVideoId, fetchYoutubeVideoMeta } from '@/lib/youtube/api'
import { authenticate, loadActiveYoutubeApiKey } from '@/lib/v3/server'

// 영상 등록 폼의 "새 문서 작성" 미리보기 블록용. URL만으로 제목/썸네일/채널을 먼저 보여주고,
// 실제 저장은 여전히 공용 POST /api/videos/create 가 담당한다(등록 시 다시 한 번 조회해 저장).
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url).searchParams.get('url') || ''
    if (!extractYoutubeVideoId(url)) {
      return NextResponse.json({ error: '유효한 유튜브 영상 주소가 아닙니다.' }, { status: 400 })
    }

    const apiKey = await loadActiveYoutubeApiKey(auth.supabaseAdmin)
    if (!apiKey) {
      return NextResponse.json({ error: '활성화된 유튜브 API 키가 없어 미리보기를 불러올 수 없습니다. 등록은 계속 진행할 수 있습니다.' }, { status: 200 })
    }

    const meta = await fetchYoutubeVideoMeta(url, apiKey)
    return NextResponse.json({
      title: meta.title,
      channelName: meta.channelName,
      thumbnailUrl: meta.thumbnailUrl,
      publishedAt: meta.publishedAt,
      viewCount: meta.viewCount,
      durationSeconds: meta.durationSeconds
    })
  } catch (e) {
    return errorResponse(e, '미리보기를 불러오지 못했습니다.')
  }
}
