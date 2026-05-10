import type { DistrictData, IndustryItem, MarkerInfo } from './map'

export interface SimulatorInput {
  capital: number
  setupCost: number
  monthlyRent: number
  laborCost: number
  operatingCost: number
  marginRate: number
  averageTicket: number
  ownerAge: number
  isFirstBusiness: boolean
}

export interface SimulatorContext {
  marker: MarkerInfo
  industry: IndustryItem
  district: DistrictData
}

export interface ScoreBreakdown {
  sales: number
  profit: number
  traffic: number
  competition: number
  risk: number
}

export interface FundingRecommendation {
  title: string
  category: string
  fit: '높음' | '보통' | '검토'
  amountHint: string
  reason: string
}

export interface SimulatorResult {
  survivalScore: number
  estimatedMonthlySales: number
  breakEvenSales: number
  expectedMonthlyProfit: number
  monthlyFixedCost: number
  operatingCapital: number
  fundingGap: number
  runwayMonths: number | null
  dailyCustomers: number | null
  trafficMultiplier: number
  competitionLevel: '낮음' | '보통' | '높음'
  summary: string[]
  scoreBreakdown: ScoreBreakdown
  fundingRecommendations: FundingRecommendation[]
}
