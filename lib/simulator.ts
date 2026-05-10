import type {
  FundingRecommendation,
  SimulatorContext,
  SimulatorInput,
  SimulatorResult,
} from '@/types/simulator'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const roundToTenThousand = (value: number) => Math.round(value / 10000) * 10000

function trafficMultiplier(flowPopulation: number | null) {
  if (!flowPopulation || flowPopulation <= 0) return 0.95
  if (flowPopulation >= 18_000_000) return 1.18
  if (flowPopulation >= 12_000_000) return 1.1
  if (flowPopulation >= 8_000_000) return 1.03
  if (flowPopulation >= 5_000_000) return 0.96
  return 0.88
}

function competitionMultiplier(storeCount: number | null, similarStores: number | null) {
  const stores = storeCount ?? 0
  const similar = similarStores ?? 0
  const density = stores + similar * 0.45

  if (density >= 180) return { multiplier: 0.86, level: '높음' as const }
  if (density >= 80) return { multiplier: 0.94, level: '보통' as const }
  return { multiplier: 1.04, level: '낮음' as const }
}

function capitalMultiplier(setupCost: number) {
  if (setupCost >= 100_000_000) return 1.04
  if (setupCost >= 50_000_000) return 1.02
  if (setupCost >= 25_000_000) return 1
  return 0.94
}

function estimateSingleStoreSales(context: SimulatorContext) {
  const totalIndustrySales = context.district.monthlySales ?? context.industry.sales ?? 0
  const storeCount = context.district.storeCount ?? context.industry.stores ?? 0
  const averageStoreSales = totalIndustrySales / Math.max(storeCount, 1)

  // 서울 상권 API의 매출은 행정동-업종 집계값이다. 신규 매장은 기존 점포 평균보다 낮은
  // 초기 안정화 매출로 시작한다고 보고 68%만 반영한다.
  return averageStoreSales * 0.68
}

function scoreFundingRecommendations(
  input: SimulatorInput,
  resultBase: Pick<SimulatorResult, 'fundingGap' | 'survivalScore' | 'expectedMonthlyProfit' | 'operatingCapital'>
): FundingRecommendation[] {
  const recommendations: FundingRecommendation[] = []

  if (resultBase.fundingGap > 0) {
    recommendations.push({
      title: '소상공인 정책자금',
      category: '창업자금/운전자금',
      fit: '높음',
      amountHint: `부족자금 약 ${Math.ceil(resultBase.fundingGap / 10000).toLocaleString()}만원 기준 검토`,
      reason: '초기 개업비와 6개월 권장 운영자금을 기준으로 추가 자금 확보가 필요합니다.',
    })
  }

  if (input.ownerAge > 0 && input.ownerAge <= 39) {
    recommendations.push({
      title: '청년 창업 지원자금',
      category: '청년창업',
      fit: '높음',
      amountHint: '대표자 연령 조건 우선 확인',
      reason: '대표자 연령이 청년창업 지원사업 검토 구간에 들어갑니다.',
    })
  }

  if (resultBase.operatingCapital < input.monthlyRent + input.laborCost + input.operatingCost) {
    recommendations.push({
      title: '서울신용보증재단 보증상담',
      category: '보증연계',
      fit: '보통',
      amountHint: '초기 운전자금 보완 목적',
      reason: '개업 후 첫 달 고정비 여력이 낮아 보증 연계 운전자금 검토가 필요합니다.',
    })
  }

  if (resultBase.survivalScore < 55 || resultBase.expectedMonthlyProfit < 0) {
    recommendations.push({
      title: '창업 컨설팅 및 비용구조 점검',
      category: '상담/진단',
      fit: '검토',
      amountHint: '대출 전 비용 조정 권장',
      reason: '수익성 지표가 낮아 금융상품 신청 전 임대료, 인건비, 규모 조정이 우선입니다.',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: '운전자금 예비한도 점검',
      category: '예비자금',
      fit: '보통',
      amountHint: '3개월 고정비 수준',
      reason: '큰 부족자금은 없지만 개업 초기 매출 변동에 대비한 예비자금 확인이 필요합니다.',
    })
  }

  return recommendations.slice(0, 3)
}

export function runStartupSimulation(input: SimulatorInput, context: SimulatorContext): SimulatorResult {
  const district = context.district
  const monthlyFixedCost = input.monthlyRent + input.laborCost + input.operatingCost
  const margin = clamp(input.marginRate / 100, 0.05, 0.95)
  const baseSales = estimateSingleStoreSales(context)

  const traffic = trafficMultiplier(district.flowPopulation)
  const competition = competitionMultiplier(district.storeCount, district.similarStores)
  const capital = capitalMultiplier(input.setupCost)
  const risk = district.closeRate != null ? clamp(1 - district.closeRate / 100, 0.82, 1.04) : 0.96

  const estimatedMonthlySales = roundToTenThousand(baseSales * traffic * competition.multiplier * capital * risk)
  const breakEvenSales = roundToTenThousand(monthlyFixedCost / margin)
  const expectedMonthlyProfit = roundToTenThousand(estimatedMonthlySales * margin - monthlyFixedCost)
  const operatingCapital = input.capital - input.setupCost
  const recommendedReserve = monthlyFixedCost * 6
  const fundingGap = Math.max(0, input.setupCost + recommendedReserve - input.capital)
  const runwayMonths = expectedMonthlyProfit < 0
    ? Math.max(0, Math.floor(Math.max(operatingCapital, 0) / Math.abs(expectedMonthlyProfit)))
    : null
  const dailyCustomers = input.averageTicket > 0
    ? Math.round(estimatedMonthlySales / 30 / input.averageTicket)
    : null

  // 배점 합계: 32(매출) + 25(수익) + 15(유동) + 18(경쟁) + 10(폐업) = 100점
  // salesScore: 손익분기점의 1.45배 달성 시 만점 (기존 1.07배보다 구분력 향상)
  const salesScore = clamp((estimatedMonthlySales / Math.max(breakEvenSales, 1)) * 22, 0, 32)
  const profitScore = clamp(expectedMonthlyProfit > 0 ? 25 : 25 + (expectedMonthlyProfit / Math.max(monthlyFixedCost, 1)) * 25, 0, 25)
  // trafficScore: 실제 도달 불가한 하한(8) 제거, 상한(15)만 유지
  const trafficScore = Math.min(traffic * 13, 15)
  const competitionScore = competition.level === '낮음' ? 18 : competition.level === '보통' ? 13 : 8
  // riskScore: 폐업률 데이터 없을 때 7점 (데이터 있을 때 최대 9.3점보다 낮게 유지)
  const riskScore = district.closeRate == null ? 7 : clamp(10 - district.closeRate * 0.7, 3, 10)
  // fundingPenalty: 절대액 구간 기준 (기존 자본금 비율 방식은 소자본 창업자에게 불리)
  const fundingPenalty = fundingGap <= 0 ? 0
    : fundingGap <= 10_000_000 ? 2
    : fundingGap <= 30_000_000 ? 5
    : fundingGap <= 60_000_000 ? 8
    : 12
  const survivalScore = Math.round(clamp(
    salesScore + profitScore + trafficScore + competitionScore + riskScore - fundingPenalty,
    0,
    100
  ))

  const summary = [
    estimatedMonthlySales >= breakEvenSales
      ? '예상 월매출이 손익분기점을 넘는 구조입니다.'
      : '예상 월매출이 손익분기점보다 낮아 비용 조정이 우선입니다.',
    competition.level === '높음'
      ? '동일·유사업종 점포 밀도가 높아 차별화 전략이 필요합니다.'
      : '경쟁 강도는 과도한 수준은 아니며 입지 검토 여지가 있습니다.',
    fundingGap > 0
      ? '초기 개업비와 6개월 운영자금을 기준으로 추가 자금 확보가 필요합니다.'
      : '입력한 자본금으로 개업비와 초기 운영자금 일부를 감당할 수 있습니다.',
  ]

  const baseResult = {
    survivalScore,
    estimatedMonthlySales,
    breakEvenSales,
    expectedMonthlyProfit,
    monthlyFixedCost,
    operatingCapital,
    fundingGap,
    runwayMonths,
    dailyCustomers,
    trafficMultiplier: traffic,
    competitionLevel: competition.level,
    summary,
    scoreBreakdown: {
      sales: Math.round(salesScore),
      profit: Math.round(profitScore),
      traffic: Math.round(trafficScore),
      competition: Math.round(competitionScore),
      risk: Math.round(riskScore),
    },
  }

  return {
    ...baseResult,
    fundingRecommendations: scoreFundingRecommendations(input, baseResult),
  }
}
