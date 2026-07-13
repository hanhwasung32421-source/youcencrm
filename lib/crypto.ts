import crypto from 'node:crypto'

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function randomDigits(length: number) {
  const max = 10 ** length
  return String(crypto.randomInt(0, max)).padStart(length, '0')
}

