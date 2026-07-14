import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

function formatKst(date) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  )

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`
}

function getDeterministicVersion() {
  // 배포 환경(Vercel)과 로컬에서 버전이 달라지는 문제를 막기 위해
  // "빌드 시간"이 아니라 "현재 커밋 시간"을 기준으로 버전을 생성합니다.
  try {
    const unixSecondsText = execSync('git show -s --format=%ct HEAD', { encoding: 'utf8' }).trim()
    const unixSeconds = Number(unixSecondsText)
    if (!Number.isFinite(unixSeconds)) throw new Error('invalid git timestamp')
    return formatKst(new Date(unixSeconds * 1000))
  } catch {
    // git이 없는 환경에서는 기존 방식으로 fallback
    return formatKst(new Date())
  }
}

const version = getDeterministicVersion()
const outputPath = path.resolve(process.cwd(), 'lib', 'generated-version.ts')
const output = `export const BUILD_VERSION = '${version}'\n`

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, output, 'utf8')

console.log(`Build version generated: ${version}`)
