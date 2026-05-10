export type FundingSource = 'kstartup' | 'policy_catalog' | 'loan_api'
export type FundingKind = 'grant' | 'loan' | 'guarantee' | 'space' | 'education' | 'consulting'
export type FundingFit = '적합' | '검토' | '참고'

export interface FundingProgram {
  id: string
  source: FundingSource
  kind: FundingKind
  title: string
  category: string
  region: string
  target: string
  businessAge: string
  targetAge: string
  organization: string
  startDate: string
  endDate: string
  applyUrl: string
  detailUrl: string
  phone: string
  score: number
  fit: FundingFit
  reasons: string[]
  description: string
}

export interface FundingResponse {
  programs: FundingProgram[]
  source: string
  matchCount: number
}
