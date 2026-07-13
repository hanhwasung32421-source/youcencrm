import crypto from 'node:crypto'

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function randomDigits(length: number) {
  const max = 10 ** length
  const n = crypto.randomInt(0, max)
  return String(n).padStart(length, '0')
}

