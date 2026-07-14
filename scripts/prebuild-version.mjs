import fs from 'node:fs'
import path from 'node:path'
const outputPath = path.resolve(process.cwd(), 'lib', 'generated-version.ts')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })

if (!fs.existsSync(outputPath)) {
  const fallbackVersion = '00000000-000000'
  const output = `export const BUILD_VERSION = '${fallbackVersion}'\n`
  fs.writeFileSync(outputPath, output, 'utf8')
  console.log(`Build version generated: ${fallbackVersion}`)
} else {
  console.log(`Build version preserved from ${outputPath}`)
}
