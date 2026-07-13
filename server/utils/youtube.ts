function extractVideoId(input: string) {
  try {
    const url = new URL(input)
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').trim()
    }
    if (url.hostname.includes('youtube.com')) {
      return url.searchParams.get('v')?.trim() || ''
    }
    return ''
  } catch {
    return ''
  }
}

function parseIso8601Duration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return null
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  return hours * 3600 + minutes * 60 + seconds
}

export async function fetchYoutubeVideoMeta(youtubeUrl: string) {
  const config = useRuntimeConfig()
  if (!config.youtubeApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'YOUTUBE_API_KEY 가 설정되어 있지 않습니다.'
    })
  }

  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) {
    throw createError({
      statusCode: 400,
      statusMessage: '유효한 유튜브 영상 주소가 아닙니다.'
    })
  }

  const response = await $fetch<{
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
      contentDetails?: {
        duration?: string
      }
      status?: {
        privacyStatus?: string
      }
      statistics?: {
        viewCount?: string
        likeCount?: string
        commentCount?: string
      }
    }>
  }>('https://www.googleapis.com/youtube/v3/videos', {
    query: {
      id: videoId,
      part: 'snippet,contentDetails,statistics,status',
      key: config.youtubeApiKey
    }
  })

  const item = response.items?.[0]
  if (!item?.snippet) {
    throw createError({
      statusCode: 404,
      statusMessage: '유튜브 영상 메타데이터를 찾을 수 없습니다.'
    })
  }

  return {
    youtubeVideoId: item.id,
    youtubeChannelId: item.snippet.channelId || '',
    channelName: item.snippet.channelTitle || '',
    title: item.snippet.title || '',
    description: item.snippet.description || '',
    publishedAt: item.snippet.publishedAt || null,
    durationSeconds: item.contentDetails?.duration
      ? parseIso8601Duration(item.contentDetails.duration)
      : null,
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

