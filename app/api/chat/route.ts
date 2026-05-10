import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export const preferredRegion = ['icn1']
import type { DistrictData } from '@/types/map'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type Message = { role: 'user' | 'assistant'; content: string }

type ChatContext = {
  guName: string
  dongName: string
  industryName: string | null
  district: DistrictData
} | null

function buildSystemPrompt(ctx: ChatContext): string {
  if (!ctx) {
    return [
      '당신은 서울시 상권 데이터 기반 창업 전문 AI 상담사입니다.',
      '간결하고 친근하게 답변하세요. 수치 근거를 포함하면 더 좋습니다.',
    ].join('\n')
  }

  const { guName, dongName, industryName, district: d } = ctx

  const fmt = (n: number | null, unit = '') =>
    n == null ? '데이터 없음' : `${Math.round(n).toLocaleString()}${unit}`
  const fmtRate = (n: number | null) => (n == null ? '데이터 없음' : `${n.toFixed(1)}%`)
  const fmtAmt = (n: number | null) => {
    if (n == null) return '데이터 없음'
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`
    if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`
    return `${n.toLocaleString()}원`
  }

  const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
  const TIME_LABELS = ['0~6시', '6~11시', '11~14시', '14~17시', '17~21시', '21~24시']
  const AGE_LABELS = ['10대', '20대', '30대', '40대', '50대', '60대+']

  const topDay = (() => {
    const arr = d.weekdaySales && d.weekendSales
      ? [...d.weekdaySales, ...d.weekendSales]
      : null
    if (!arr) return null
    const idx = arr.indexOf(Math.max(...arr))
    return DAY_LABELS[idx]
  })()

  const topTime = (() => {
    const arr = d.timeSales
    if (!arr) return null
    const idx = arr.indexOf(Math.max(...arr))
    return TIME_LABELS[idx]
  })()

  const topAge = (() => {
    const arr = d.agePct
    if (!arr) return null
    const idx = arr.indexOf(Math.max(...arr))
    return AGE_LABELS[idx]
  })()

  const lines = [
    '당신은 서울시 상권 데이터 기반 창업 전문 AI 상담사입니다.',
    '간결하고 친근하게 답변하세요. 수치 근거를 포함하면 더 좋습니다.',
    '',
    '[현재 분석 상권]',
    `위치: ${guName} ${dongName}`,
    `업종: ${industryName ?? '미선택'}`,
    `생활인구: ${fmt(d.population, '명')}`,
    `분기 유동인구: ${fmt(d.flowPopulation, '명')}`,
    `월 소비지출: ${fmtAmt(d.consumptionAmt)}`,
  ]

  if (industryName) {
    lines.push(
      `월매출(업종): ${fmtAmt(d.monthlySales)}`,
      `점포 수: ${fmt(d.storeCount, '개')}`,
      `유사업종 점포: ${fmt(d.similarStores, '개')}`,
      `개업률: ${fmtRate(d.openRate)}`,
      `폐업률: ${fmtRate(d.closeRate)}`,
      `프랜차이즈 비율: ${fmtRate(d.franchiseRate)}`,
    )
    if (d.malePct != null)
      lines.push(`성별 비율: 남 ${d.malePct}% / 여 ${d.femalePct}%`)
    if (topAge) lines.push(`주요 고객층 연령: ${topAge}`)
    if (topDay) lines.push(`매출 높은 요일: ${topDay}`)
    if (topTime) lines.push(`매출 집중 시간대: ${topTime}`)
  } else {
    lines.push(`전체 월매출: ${fmtAmt(d.totalSales)}`)
    lines.push(`전체 점포 수: ${fmt(d.totalStores, '개')}`)
    const top3 = d.topIndustries.slice(0, 3).map(i => i.name).join(', ')
    if (top3) lines.push(`매출 상위 업종: ${top3}`)
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, context }: { messages: Message[]; context: ChatContext } = await req.json()

  if (!Array.isArray(messages) || messages.length > 30) {
    return new Response(JSON.stringify({ error: 'invalid messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const totalLength = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
  if (totalLength > 20000) {
    return new Response(JSON.stringify({ error: 'messages too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const systemPrompt = buildSystemPrompt(context)

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }, { signal: AbortSignal.timeout(25000) })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
