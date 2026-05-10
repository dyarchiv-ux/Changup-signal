import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export const preferredRegion = ['icn1']
import type { DistrictData } from '@/types/map'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type AreaData = DistrictData & { guName: string; dongName: string }

type RequestBody = {
  a: AreaData
  b: AreaData
  industryName: string
}

function fmtAmt(n: number | null) {
  if (n == null) return '데이터 없음'
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}
function fmtNum(n: number | null, unit = '') {
  return n == null ? '데이터 없음' : `${Math.round(n).toLocaleString()}${unit}`
}
function fmtRate(n: number | null) {
  return n == null ? '데이터 없음' : `${n.toFixed(1)}%`
}

const AGE_LABELS = ['10대', '20대', '30대', '40대', '50대', '60대+']
const TIME_LABELS = ['0~6시', '6~11시', '11~14시', '14~17시', '17~21시', '21~24시']
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function buildAreaText(area: AreaData, label: string, isIndustry: boolean): string {
  const lines = [
    `${label}지역(${area.guName} ${area.dongName}):`,
    `  분기 유동인구: ${fmtNum(area.flowPopulation, '명')}`,
    `  일평균 생활인구: ${fmtNum(area.population, '명')}`,
    `  월 소비지출: ${fmtAmt(area.consumptionAmt)}`,
  ]

  if (isIndustry) {
    lines.push(
      `  추정 월매출(업종): ${fmtAmt(area.monthlySales)}`,
      `  업종 점포 수: ${fmtNum(area.storeCount, '개')} / 유사업종: ${fmtNum(area.similarStores, '개')}`,
      `  개업률: ${fmtRate(area.openRate)} / 폐업률: ${fmtRate(area.closeRate)}`,
      `  프랜차이즈 비율: ${fmtRate(area.franchiseRate)}`,
    )
    if (area.malePct != null)
      lines.push(`  주요 고객 성별: 남 ${area.malePct}% / 여 ${area.femalePct}%`)
    if (area.agePct) {
      const idx = area.agePct.indexOf(Math.max(...area.agePct))
      lines.push(`  주요 고객 연령대: ${AGE_LABELS[idx]} (${area.agePct[idx].toFixed(0)}%)`)
    }
    if (area.timeSales) {
      const idx = area.timeSales.indexOf(Math.max(...area.timeSales))
      lines.push(`  매출 집중 시간대: ${TIME_LABELS[idx]}`)
    }
    if (area.weekdaySales && area.weekendSales) {
      const all = [...area.weekdaySales, ...area.weekendSales]
      const idx = all.indexOf(Math.max(...all))
      lines.push(`  매출 높은 요일: ${DAY_LABELS[idx]}`)
    }
  } else {
    lines.push(
      `  전체 월매출: ${fmtAmt(area.totalSales)}`,
      `  총 점포 수: ${fmtNum(area.totalStores, '개')}`,
    )
    if (area.flowAgePct) {
      const idx = area.flowAgePct.indexOf(Math.max(...area.flowAgePct))
      lines.push(`  주요 유동인구 연령대: ${AGE_LABELS[idx]} (${area.flowAgePct[idx].toFixed(0)}%)`)
    }
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = `당신은 서울시 상권 데이터 기반 창업 전문 컨설턴트입니다.
두 지역의 공공데이터를 분석해 예비 창업자가 의사결정에 바로 활용할 수 있는 전략적 인사이트를 제공합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "recommendation": "A지역(동명) 추천" 또는 "B지역(동명) 추천",
  "sections": [
    { "title": "매출·수익성 분석", "content": "..." },
    { "title": "상권 환경 분석", "content": "..." },
    { "title": "리스크 분석", "content": "..." },
    { "title": "최종 추천", "content": "..." }
  ]
}

분석 원칙:
- 수치는 '사실'이 아닌 '증거'로 활용하세요. 숫자 자체보다 그 의미와 시사점을 해석하세요.
  나쁜 예: "A지역 폐업률 15.2%, B지역 폐업률 9.1%입니다."
  좋은 예: "A지역은 폐업률이 개업률을 앞질러 시장 포화 신호가 뚜렷합니다. 신규 진입 시 기존 점포와의 차별화 전략 없이는 생존이 어렵습니다."
- 두 지역의 차이에서 파생되는 창업 전략의 차이를 설명하세요. 같은 업종이라도 어떤 지역에서는 프리미엄 전략이, 다른 지역에서는 회전율 전략이 맞을 수 있습니다.
- 숨겨진 함정을 경고하세요. 예: 유동인구는 많지만 소비지출이 낮아 객단가를 높이기 어려운 경우, 프랜차이즈 비율이 높아 독립 점포 생존이 불리한 경우.
- 최종 추천은 "어떤 자본 규모, 어떤 전략을 가진 창업자"에게 어느 지역이 맞는지 구체적으로 제시하세요.
- recommendation: 반드시 "A지역(XX동) 추천" 또는 "B지역(XX동) 추천" 형식
- 한국어로 작성, 각 섹션 3~4문장`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const { a, b, industryName } = body
  const isIndustry = !!(industryName && industryName !== '전체 상권')

  const userMessage = [
    `[분석 요청]`,
    `업종: ${industryName || '전체 상권'}`,
    ``,
    buildAreaText(a, 'A', isIndustry),
    ``,
    buildAreaText(b, 'B', isIndustry),
  ].join('\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }, { signal: AbortSignal.timeout(30000) })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      recommendation?: string
      sections?: { title: string; content: string }[]
    }

    if (!parsed.recommendation || !Array.isArray(parsed.sections) || parsed.sections.length < 4) {
      return NextResponse.json({ error: 'unexpected ai response' }, { status: 500 })
    }

    return NextResponse.json({
      recommendation: parsed.recommendation,
      sections: parsed.sections.slice(0, 4),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
