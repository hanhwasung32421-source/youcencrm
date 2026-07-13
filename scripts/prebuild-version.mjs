import fs from 'node:fs'
import path from 'node:path'

function getKstVersion() {
  const now = new Date()
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
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  )

  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`
}

const version = getKstVersion()
const outputPath = path.resolve(process.cwd(), 'lib', 'generated-version.ts')
const output = `export const BUILD_VERSION = '${version}'\n`

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, output, 'utf8')

console.log(`Build version generated: ${version}`)

