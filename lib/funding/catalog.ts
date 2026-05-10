import type { FundingKind, FundingProgram } from '@/types/funding'

export type CatalogProgram = Omit<FundingProgram, 'score' | 'fit' | 'reasons'> & {
  keywords: string[]
  requireFundingGap?: boolean
  preferYouth?: boolean
  preferFirstBusiness?: boolean
  preferLowScore?: boolean
  preferManufacturing?: boolean
  excludeFirstBusiness?: boolean
}

const SEMAS_APPLY_URL = 'https://ols.semas.or.kr'
const SEOUL_SHINBO_URL = 'https://www.seoulshinbo.co.kr'
const KINFA_LOAN_URL = 'https://www.data.go.kr/data/15106208/openapi.do'

function program(
  input: Omit<CatalogProgram, 'source' | 'startDate' | 'endDate' | 'phone'> & {
    kind: FundingKind
    phone?: string
  }
): CatalogProgram {
  return {
    source: 'policy_catalog',
    startDate: '상시/공고 확인',
    endDate: '예산 소진 또는 공고 확인',
    phone: input.phone ?? '1357',
    ...input,
  }
}

export const policyCatalog: CatalogProgram[] = [
  program({
    id: 'semas-general-stability',
    kind: 'loan',
    title: '소상공인 정책자금 일반경영안정자금',
    category: '정책자금/운전자금',
    region: '전국',
    target: '업력 무관 소상공인',
    businessAge: '업력 무관',
    targetAge: '연령 제한 없음',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '일반 소상공인의 경영안정을 위한 정책자금입니다. 실제 접수 가능 여부와 금리·한도는 소상공인정책자금 누리집 공고를 확인해야 합니다.',
    keywords: ['소상공인', '운전자금', '자금', '융자', '점포', '매장', '카페', '음식', '미용', '소매'],
    requireFundingGap: true,
  }),
  program({
    id: 'semas-youth-employment',
    kind: 'loan',
    title: '청년고용연계자금',
    category: '정책자금/청년·고용',
    region: '전국',
    target: '청년 대표 또는 청년 고용 소상공인',
    businessAge: '공고 확인',
    targetAge: '청년 대표자 우대',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '청년 대표자 또는 청년 고용과 연계된 소상공인을 위한 정책자금 유형입니다.',
    keywords: ['청년', '소상공인', '자금', '융자', '운전자금'],
    requireFundingGap: true,
    preferYouth: true,
  }),
  program({
    id: 'semas-low-credit',
    kind: 'loan',
    title: '신용취약 소상공인 정책자금',
    category: '정책자금/신용취약',
    region: '전국',
    target: '중·저신용 소상공인',
    businessAge: '공고 확인',
    targetAge: '연령 제한 없음',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '신용 여건이 취약한 소상공인을 위한 정책자금 유형입니다. 신용점수 등 세부 요건은 공고 확인이 필요합니다.',
    keywords: ['신용', '저신용', '소상공인', '자금', '대출', '경영안정'],
    requireFundingGap: true,
  }),
  program({
    id: 'semas-refinance',
    kind: 'loan',
    title: '소상공인 대환대출',
    category: '정책자금/대환',
    region: '전국',
    target: '고금리 대출 부담이 있는 소상공인',
    businessAge: '공고 확인',
    targetAge: '연령 제한 없음',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '기존 고금리 대출 부담 완화를 위한 정책자금 유형입니다. 기존 대출 보유 여부가 중요합니다.',
    keywords: ['대환', '고금리', '대출', '소상공인', '이자'],
    requireFundingGap: true,
    excludeFirstBusiness: true,
  }),
  program({
    id: 'semas-manufacturing',
    kind: 'loan',
    title: '소공인특화자금',
    category: '정책자금/제조·시설',
    region: '전국',
    target: '제조업 기반 소공인',
    businessAge: '공고 확인',
    targetAge: '연령 제한 없음',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '제조업을 영위하는 소공인을 위한 운전·시설 자금 유형입니다.',
    keywords: ['제조', '공방', '시설자금', '소공인', '장비', '설비'],
    requireFundingGap: true,
    preferManufacturing: true,
  }),
  program({
    id: 'semas-innovation-growth',
    kind: 'loan',
    title: '혁신성장촉진자금',
    category: '정책자금/성장',
    region: '전국',
    target: '성장 가능성이 있거나 스마트기술 도입을 준비하는 소상공인',
    businessAge: '공고 확인',
    targetAge: '연령 제한 없음',
    organization: '소상공인시장진흥공단',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '스마트기술, 매출 성장, 로컬크리에이터 등 성장성이 있는 소상공인을 위한 정책자금 유형입니다.',
    keywords: ['성장', '스마트', '로컬', '소상공인', '시설자금', '운전자금'],
    requireFundingGap: true,
  }),
  program({
    id: 'seoul-credit-guarantee',
    kind: 'guarantee',
    title: '서울신용보증재단 보증상담',
    category: '보증/상담',
    region: '서울',
    target: '서울 소재 또는 서울 창업 예정 소상공인',
    businessAge: '예비·초기·기존 사업자 상담 가능',
    targetAge: '연령 제한 없음',
    organization: '서울신용보증재단',
    applyUrl: SEOUL_SHINBO_URL,
    detailUrl: SEOUL_SHINBO_URL,
    phone: '1577-6119',
    description: '담보가 부족하거나 정책자금 대출 전 보증 가능성을 확인해야 할 때 검토할 수 있는 서울 지역 보증상담 채널입니다.',
    keywords: ['서울', '보증', '신용보증', '소상공인', '대출', '운전자금'],
    requireFundingGap: true,
  }),
  program({
    id: 'kinfa-loan-products',
    kind: 'loan',
    title: '서민금융진흥원 대출상품 한눈에',
    category: '대출상품/API 연동 예정',
    region: '전국',
    target: '사업자 포함 정책서민금융 상품 비교 필요자',
    businessAge: '상품별 상이',
    targetAge: '상품별 상이',
    organization: '서민금융진흥원',
    applyUrl: KINFA_LOAN_URL,
    detailUrl: KINFA_LOAN_URL,
    description: '대출한도, 금리구분, 용도, 취급기관 등을 비교할 수 있는 무료 공공 API입니다. API 키를 받으면 실시간 상품 조회로 확장할 수 있습니다.',
    keywords: ['대출', '서민금융', '사업자', '금리', '한도', '취급기관'],
    requireFundingGap: true,
  }),
  program({
    id: 'business-consulting',
    kind: 'consulting',
    title: '소상공인 경영개선 상담 우선 검토',
    category: '상담/진단',
    region: '전국',
    target: '수익성 또는 비용구조 점검이 필요한 창업자',
    businessAge: '업력 무관',
    targetAge: '연령 제한 없음',
    organization: '소상공인 지원기관',
    applyUrl: SEMAS_APPLY_URL,
    detailUrl: SEMAS_APPLY_URL,
    description: '시뮬레이션 점수가 낮거나 손익분기점 부담이 큰 경우 대출보다 비용구조와 상권 전략 점검을 먼저 권장합니다.',
    keywords: ['컨설팅', '진단', '교육', '비용', '수익성'],
    preferLowScore: true,
  }),
]
