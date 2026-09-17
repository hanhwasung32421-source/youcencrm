import fs from 'node:fs'
import path from 'node:path'

const outputPath = path.resolve(process.cwd(), 'lib', 'generated-version.ts')

function getKstYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

function getWeekdayLabel(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date)
}

function formatVersionLabel(ymd, n) {
  const [year, month, day] = ymd.split('-').map(Number)
  const weekday = getWeekdayLabel(ymd)
  return `${year}년 ${month}월 ${day}일 (${weekday}) - ${n}`
}

function parseVersionLabel(raw) {
  const match = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\([^)]*\)\s*-\s*(\d+)$/)
  if (!match) return null
  const [, year, month, day, n] = match
  const ymd = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return { ymd, n: Number(n) }
}

// 매 빌드(=푸시)마다 실행됩니다.
// - 오늘 처음 빌드되는 것이면 "오늘 날짜 - 2"로 시작합니다.
//   ("- 1"은 빌드 없이 화면에서 오전 7시에 자동으로 보여주는 값이라, 실제 빌드는 2부터 시작합니다.)
// - 같은 날 다시 빌드되면 번호만 1씩 올립니다.
const todayYmd = getKstYmd(new Date())

let existingRaw = null
if (fs.existsSync(outputPath)) {
  const content = fs.readFileSync(outputPath, 'utf8')
  const match = content.match(/BUILD_VERSION = '([^']*)'/)
  existingRaw = match ? match[1] : null
}

const parsed = existingRaw ? parseVersionLabel(existingRaw) : null
const nextN = parsed && parsed.ymd === todayYmd ? parsed.n + 1 : 2
const nextVersion = formatVersionLabel(todayYmd, nextN)

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `export const BUILD_VERSION = '${nextVersion}'\n`, 'utf8')
console.log(`Build version updated: ${nextVersion}`)
