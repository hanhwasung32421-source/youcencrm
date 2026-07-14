export function extractYoutubeVideoId(input: string) {
  try {
    const url = new URL(input)
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '').trim()
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v')?.trim() || ''
    return ''
  } catch {
    return ''
  }
}

function parseIsoDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  const hour = Number(match[1] || 0)
  const minute = Number(match[2] || 0)
  const second = Number(match[3] || 0)
  return hour * 3600 + minute * 60 + second
}

export async function fetchYoutubeVideoMeta(youtubeUrl: string, apiKey: string) {
  const videoId = extractYoutubeVideoId(youtubeUrl)
  if (!videoId) {
    throw new Error('유효한 유튜브 영상 주소가 아닙니다.')
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics,status&key=${apiKey}`,
    { cache: 'no-store' }
  )

  const json = (await response.json()) as {
    items?: Array<{
      id: string
      snippet?: {
        title?: string
        description?: string
        publishedAt?: string
        channelId?: string
        channelTitle?: string
        thumbnails?: Record<string, { url: string }>
      }
      contentDetails?: { duration?: string }
      status?: { privacyStatus?: string }
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
    }>
  }

  const item = json.items?.[0]
  if (!item?.snippet) {
    throw new Error('유튜브 영상 메타데이터를 찾을 수 없습니다.')
  }

  return {
    youtubeVideoId: item.id,
    youtubeChannelId: item.snippet.channelId || '',
    channelName: item.snippet.channelTitle || '',
    title: item.snippet.title || '',
    description: item.snippet.description || '',
    publishedAt: item.snippet.publishedAt || null,
    durationSeconds: item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null,
    privacyStatus: item.status?.privacyStatus || null,
    thumbnailUrl:
      item.snippet.thumbnails?.maxres?.url ||
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      null,
    viewCount: Number(item.statistics?.viewCount || 0),
    likeCount: Number(item.statistics?.likeCount || 0),
    commentCount: Number(item.statistics?.commentCount || 0)
  }
}
