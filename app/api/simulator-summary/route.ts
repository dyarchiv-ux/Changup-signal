import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const preferredRegion = ['icn1']
import type { SimulatorInput, SimulatorResult } from '@/types/simulator'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type RequestBody = {
  result: SimulatorResult
  context: { guName: string; dongName: string; industryName: string }
  input: SimulatorInput
}

function fmtAmt(won: number) {
  if (Math.abs(won) >= 1e8) return `${(won / 1e8).toFixed(1)}억원`
  if (Math.abs(won) >= 1e4) return `${Math.round(won / 1e4).toLocaleString()}만원`
  return `${won.toLocaleString()}원`
}

function buildUserMessage(body: RequestBody): string {
  const { result: r, context: ctx, input: i } = body
  const isProfit = r.runwayMonths == null
  const lines = [
    `[창업자 프로필]`,
    `나이: ${i.ownerAge}세 / ${i.isFirstBusiness ? '첫 창업' : '재창업'}`,
    ``,
    `[분석 상권] ${ctx.guName} ${ctx.dongName} / 업종: ${ctx.industryName}`,
    `생존가능성 점수: ${r.survivalScore}/100 / 경쟁 강도: ${r.competitionLevel}`,
    ``,
    `[수익 구조]`,
    `예상 월매출: ${fmtAmt(r.estimatedMonthlySales)} / 손익분기점: ${fmtAmt(r.breakEvenSales)}`,
    `월 예상 순이익: ${fmtAmt(r.expectedMonthlyProfit)}`,
    isProfit
      ? `자금 상황: 흑자 구조 (자본 소진 위험 없음)`
      : `자본 소진 예상: ${r.runwayMonths}개월 후`,
    ``,
    `[비용 구조]`,
    `보유 자본금: ${fmtAmt(i.capital)} / 초기 개업비: ${fmtAmt(i.setupCost)}`,
    `월 임대료: ${fmtAmt(i.monthlyRent)} / 월 인건비: ${fmtAmt(i.laborCost)} / 기타 운영비: ${fmtAmt(i.operatingCost)}`,
    `마진율: ${i.marginRate}% / 월 고정비 합계: ${fmtAmt(r.monthlyFixedCost)}`,
    `필요 추가자금: ${fmtAmt(r.fundingGap)}`,
  ]
  if (r.dailyCustomers != null)
    lines.push(`손익분기 달성을 위한 일 필요 고객 수: 약 ${Math.round(r.dailyCustomers)}명 (객단가 ${fmtAmt(i.averageTicket)})`)
  return lines.join('\n')
}

const SYSTEM_PROMPT = `당신은 서울시 상권 데이터 기반 창업 전문 컨설턴트입니다.
시뮬레이션 수치를 바탕으로 예비 창업자에게 항목별 심층 분석을 제공합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "verdict": "한 줄 종합 판정",
  "sections": [
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." }
  ]
}

분석 원칙:
- verdict: "생존 가능성 양호", "비용 구조 조정 필요" 등 핵심 판정 10자 내외.
- 창업자 프로필(나이, 첫 창업 여부)을 반드시 분석에 반영하세요. 첫 창업자라면 운영 미숙으로 인한 추가 리스크를 언급하세요. 나이에 따른 금융 지원 조건 차이도 고려하세요.
- 섹션 순서와 제목은 상황에 맞게 자유롭게 설정하세요:
  · 자본 소진이 6개월 미만이면 리스크·자금 관련 섹션을 첫 번째로 배치하세요.
  · 흑자 구조라면 성장 전략과 기회 포착 섹션을 앞에 배치하세요.
- 수치는 판단의 근거로만 쓰고, 그 수치가 의미하는 바와 창업자가 취해야 할 행동을 중심으로 서술하세요.
  나쁜 예: "월 고정비가 300만원이고 예상 매출이 400만원입니다."
  좋은 예: "고정비 대비 매출 여유가 33%에 불과해, 한 달 매출 부진만으로도 적자 전환이 가능한 구조입니다."
- 핵심 액션 제안 섹션에서는 막연한 조언("비용 절감", "마케팅 강화") 대신 구체적인 다음 단계를 제시하세요.
  예: "손익분기 일 고객 수 달성을 위해 오픈 첫 달은 체험 이벤트로 초기 유입 확보", "소진공·서울신보 등 창업 초기 무이자 융자 프로그램 신청 검토"
- 한국어로 작성, 각 섹션 3~4문장`

export async function POST(req: NextRequest) {
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(body) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }, { signal: AbortSignal.timeout(30000) })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      verdict?: string
      sections?: { title: string; content: string }[]
    }

    if (!parsed.verdict || !Array.isArray(parsed.sections) || parsed.sections.length < 4) {
      return NextResponse.json({ error: 'unexpected ai response' }, { status: 500 })
    }

    return NextResponse.json({
      verdict: parsed.verdict,
      sections: parsed.sections.slice(0, 4),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
