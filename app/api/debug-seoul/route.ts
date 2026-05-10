import { NextResponse } from 'next/server'

export const preferredRegion = ['icn1']

export async function GET() {
  const key = process.env.SEOUL_API_KEY_SALES ?? '(없음)'
  const keyLen = key.length
  const keyFirstTwo = key.slice(0, 2)
  const keyLastTwo = key.slice(-2)

  const url = `http://openapi.seoul.go.kr:8088/${key}/json/VwsmAdstrdSelngW/1/1/20254/`
  let status = 0
  let body = ''
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    status = res.status
    body = (await res.text()).slice(0, 400)
  } catch (err) {
    body = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ keyLen, keyFirstTwo, keyLastTwo, status, body })
}
