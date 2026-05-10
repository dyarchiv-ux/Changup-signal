import { NextRequest, NextResponse } from 'next/server'
import { policyCatalog, type CatalogProgram } from '@/lib/funding/catalog'

export const preferredRegion = ['icn1']
import { fetchKinfaLoans } from '@/lib/funding/kinfa'
import type { FundingFit, FundingKind, FundingProgram, FundingResponse } from '@/types/funding'

const KSTARTUP_ENDPOINT =
  'https://nidview.k-startup.go.kr/view/public/call/kisedKstartupService/announcementInformation'

type KStartupAnnouncement = {
  pbanc_sn?: number | string
  biz_pbanc_nm?: string
  intg_pbanc_biz_nm?: string
  pbanc_ctnt?: string
  supt_biz_clsfc?: string
  pbanc_rcpt_bgng_dt?: string
  pbanc_rcpt_end_dt?: string
  aply_trgt_ctnt?: string
  supt_regin?: string
  pbanc_ntrp_nm?: string
  sprv_inst?: string
  biz_gdnc_url?: string
  biz_aply_url?: string | null
  detl_pg_url?: string
  aply_mthd_onli_rcpt_istc?: string | null
  aply_trgt?: string
  biz_enyy?: string
  biz_trgt_age?: string
  prfn_matr?: string | null
  prch_cnpl_no?: string
}

type KStartupResponse = {
  data?: KStartupAnnouncement[]
  matchCount?: number
}

type MatchProfile = {
  region: string
  guName: string
  industry: string
  ownerAge: number
  isFirstBusiness: boolean
  fundingGap: number
  survivalScore: number
  needType: 'funding' | 'space' | 'education'
  isManufacturing: boolean
}

const localSupportKeywords = ['소상공인', '점포', '매장', '상권', '골목', '생활밀접', '임대료', '시설개선', '운전자금', '시설자금', '전통시장', '로컬']
const localIndustryKeywords = ['음식', '카페', '커피', '도소매', '소매', '미용', '생활', '점포', '매장', '소상공인', '전통시장', '로컬', '외식', '제조']
const techOnlyKeywords = ['글로벌', '해외진출', 'R&D', '연구개발', '딥테크', '바이오', 'AI', 'IoT', '데이터', '투자유치', '액셀러레이팅', '오픈이노베이션', '스케일업', '벤처', 'TIPS', 'UNIST', '창공']
const moneyKeywords = ['자금', '융자', '대출', '보증', '지원금', '사업화', '운전자금', '시설자금']
const youthKeywords = ['청년', '만 39세', '39세 이하', '20세 이상 ~ 만 39세 이하']
const earlyKeywords = ['예비창업', '초기', '1년미만', '3년미만', '5년미만']

const industryGroups = [
  { match: ['커피', '카페', '음료', '제과', '디저트'], keywords: ['카페', '커피', '음료', '외식', '먹거리', '소상공인', '생활밀접'] },
  { match: ['한식', '중식', '일식', '양식', '음식', '분식', '치킨', '주점'], keywords: ['음식', '외식', '먹거리', '식품', '소상공인', '생활밀접'] },
  { match: ['미용', '네일', '피부', '헤어'], keywords: ['미용', '뷰티', '생활밀접', '소상공인', '점포'] },
  { match: ['의류', '도소매', '소매', '편의점', '문구'], keywords: ['도소매', '소매', '유통', '온라인 판로', '소상공인', '점포'] },
  { match: ['학원', '교육'], keywords: ['교육서비스', '교육', '콘텐츠', '소상공인'] },
  { match: ['제조', '공방'], keywords: ['제조', '공방', '제품', '메이커', '소공인'] },
]

function cleanText(value: string | null | undefined) {
  if (!value) return ''
  if (/[가-힣]/.test(value)) return value
  if (!/[À-ÿ]/.test(value)) return value
  const decoded = Buffer.from(value, 'latin1').toString('utf8')
  return /[가-힣]/.test(decoded) ? decoded : value
}

function normalizeUrl(url: string | null | undefined) {
  const trimmed = cleanText(url).trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function formatDate(value: string | undefined) {
  if (!value || value.length !== 8) return value ?? ''
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function buildProfile(search: URLSearchParams): MatchProfile {
  const fundingGap = Number(search.get('fundingGap') ?? 0)
  const survivalScore = Number(search.get('survivalScore') ?? 0)
  const industry = search.get('industry') ?? ''

  return {
    region: search.get('region') ?? '',
    guName: search.get('guName') ?? '',
    industry,
    ownerAge: Number(search.get('ownerAge') ?? 0),
    isFirstBusiness: search.get('isFirstBusiness') === 'true',
    fundingGap,
    survivalScore,
    needType: fundingGap > 0 ? 'funding' : survivalScore < 60 ? 'education' : 'space',
    isManufacturing: ['제조', '공방'].some((keyword) => industry.includes(keyword)),
  }
}

function industryKeywords(industry: string) {
  const found = industryGroups.find((group) => group.match.some((keyword) => industry.includes(keyword)))
  return found?.keywords ?? ['소상공인', '점포', '생활밀접']
}

function searchKeywords(profile: MatchProfile) {
  const keywords = new Set<string>([
    ...industryKeywords(profile.industry),
    profile.needType === 'funding' ? '자금' : '',
    profile.needType === 'funding' ? '보증' : '',
    profile.needType === 'space' ? '공간' : '',
    profile.needType === 'education' ? '컨설팅' : '',
    profile.ownerAge <= 39 ? '청년' : '',
    profile.guName,
  ].filter(Boolean))

  return Array.from(keywords).slice(0, 8)
}

function fitFromScore(score: number): FundingFit {
  if (score >= 110) return '적합'
  if (score >= 70) return '검토'
  return '참고'
}

function textOf(item: KStartupAnnouncement) {
  return [
    item.biz_pbanc_nm,
    item.intg_pbanc_biz_nm,
    item.pbanc_ctnt,
    item.supt_biz_clsfc,
    item.aply_trgt_ctnt,
    item.aply_trgt,
    item.biz_enyy,
    item.biz_trgt_age,
    item.prfn_matr,
    item.supt_regin,
  ].map((value) => cleanText(value)).filter(Boolean).join(' ')
}

function scoreCatalog(program: CatalogProgram, profile: MatchProfile) {
  const text = [program.title, program.category, program.description, program.keywords.join(' ')].join(' ')
  const reasons: string[] = []
  let score = 40

  if (program.region === '전국' || program.region.includes(profile.region)) {
    score += program.region === '전국' ? 12 : 24
    reasons.push(program.region === '전국' ? '전국 신청 가능' : `${profile.region} 지역 조건과 일치`)
  }
  if (profile.fundingGap > 0 && program.requireFundingGap) {
    score += 32
    reasons.push('시뮬레이션상 추가 자금 확보 필요')
  }
  if (profile.fundingGap <= 0 && program.requireFundingGap) {
    score -= 14
    reasons.push('자금 부족이 크지 않아 우선순위 낮음')
  }
  if (profile.ownerAge <= 39 && program.preferYouth) {
    score += 22
    reasons.push('청년 대표자 조건과 연관')
  }
  if (profile.isFirstBusiness && program.preferFirstBusiness) {
    score += 16
    reasons.push('첫 창업 조건과 연관')
  }
  if (profile.isFirstBusiness && program.excludeFirstBusiness) {
    score -= 28
    reasons.push('기존 대출/기존 사업자 조건 확인 필요')
  }
  if (profile.survivalScore < 60 && program.preferLowScore) {
    score += 26
    reasons.push('점수가 낮아 대출 전 상담/진단 우선')
  }
  if (profile.isManufacturing && program.preferManufacturing) {
    score += 30
    reasons.push('제조·공방 업종과 연관')
  }
  if (hasAny(text, industryKeywords(profile.industry))) {
    score += 16
    reasons.push('선택 업종군과 연관')
  }
  if (profile.needType === 'funding' && program.kind === 'loan') {
    score += 16
    reasons.push('자금 조달 목적에 적합')
  }
  if (profile.needType === 'funding' && program.kind === 'guarantee') {
    score += 14
    reasons.push('대출 전 보증 가능성 확인에 적합')
  }
  if (profile.needType === 'education' && ['consulting', 'education'].includes(program.kind)) {
    score += 20
    reasons.push('수익성 개선 상담 유형')
  }

  if (reasons.length === 0) reasons.push('정책자금 카탈로그 기반 추천')
  return { score, reasons: reasons.slice(0, 4) }
}

function catalogToProgram(program: CatalogProgram, profile: MatchProfile): FundingProgram {
  const { score, reasons } = scoreCatalog(program, profile)
  return {
    ...program,
    score,
    fit: fitFromScore(score),
    reasons,
  }
}

function excludeKStartup(item: KStartupAnnouncement, profile: MatchProfile) {
  const text = textOf(item)
  const title = cleanText(item.biz_pbanc_nm)
  const category = cleanText(item.supt_biz_clsfc)
  const region = cleanText(item.supt_regin)

  if (!item.detl_pg_url && !item.biz_aply_url && !item.aply_mthd_onli_rcpt_istc && !item.biz_gdnc_url) return true
  if (profile.region && region && !region.includes(profile.region) && !region.includes('전국')) return true
  if (hasAny(category, ['행사', '네트워크'])) return true
  if (hasAny(title, ['메이커스페이스', '3D프린터', '레이저커터'])) return true

  const localFit = hasAny(text, localSupportKeywords) || hasAny(text, localIndustryKeywords)
  if (hasAny(text, techOnlyKeywords) && !localFit) return true
  return false
}

function scoreKStartup(item: KStartupAnnouncement, profile: MatchProfile) {
  const text = textOf(item)
  const region = cleanText(item.supt_regin)
  const category = cleanText(item.supt_biz_clsfc)
  const reasons: string[] = []
  let score = 0

  if (profile.region && region.includes(profile.region)) {
    score += 28
    reasons.push(`${profile.region} 지역 공고`)
  } else if (region.includes('전국')) {
    score += 16
    reasons.push('전국 지원 공고')
  }
  if (profile.guName && text.includes(profile.guName)) {
    score += 22
    reasons.push(`${profile.guName} 조건 직접 포함`)
  }
  if (hasAny(text, localSupportKeywords)) {
    score += 28
    reasons.push('점포형 소상공인 창업과 연관')
  }
  if (hasAny(text, industryKeywords(profile.industry))) {
    score += 18
    reasons.push('선택 업종군과 연관')
  }
  if (profile.fundingGap > 0 && hasAny(text, moneyKeywords)) {
    score += 26
    reasons.push('자금 부족 진단과 관련')
  }
  if (profile.ownerAge <= 39 && hasAny(text, youthKeywords)) {
    score += 16
    reasons.push('청년 창업 조건과 연관')
  }
  if (profile.isFirstBusiness && hasAny(text, earlyKeywords)) {
    score += 16
    reasons.push('예비·초기 창업자 조건과 연관')
  }
  if (category.includes('사업화') || category.includes('융자') || category.includes('보증')) {
    score += 10
    reasons.push(`${category} 유형`)
  }

  if (reasons.length === 0) reasons.push('모집중인 창업지원 공고')
  return { score, reasons: reasons.slice(0, 4) }
}

function kindFromKStartup(category: string): FundingKind {
  if (category.includes('융자') || category.includes('자금')) return 'loan'
  if (category.includes('보증')) return 'guarantee'
  if (category.includes('공간') || category.includes('보육')) return 'space'
  if (category.includes('교육') || category.includes('멘토링') || category.includes('컨설팅')) return 'education'
  return 'grant'
}

function kStartupToProgram(item: KStartupAnnouncement, profile: MatchProfile): FundingProgram {
  const category = cleanText(item.supt_biz_clsfc) || '창업지원'
  const { score, reasons } = scoreKStartup(item, profile)
  const applyUrl =
    normalizeUrl(item.biz_aply_url) ||
    normalizeUrl(item.aply_mthd_onli_rcpt_istc) ||
    normalizeUrl(item.detl_pg_url) ||
    normalizeUrl(item.biz_gdnc_url)
  const detailUrl = normalizeUrl(item.detl_pg_url) || applyUrl

  return {
    id: `kstartup-${String(item.pbanc_sn ?? item.biz_pbanc_nm ?? '')}`,
    source: 'kstartup',
    kind: kindFromKStartup(category),
    title: cleanText(item.biz_pbanc_nm) || cleanText(item.intg_pbanc_biz_nm) || '창업지원 공고',
    category,
    region: cleanText(item.supt_regin) || '미정',
    target: cleanText(item.aply_trgt) || '공고 확인',
    businessAge: cleanText(item.biz_enyy) || '공고 확인',
    targetAge: cleanText(item.biz_trgt_age) || '공고 확인',
    organization: cleanText(item.pbanc_ntrp_nm) || cleanText(item.sprv_inst) || '공고 확인',
    startDate: formatDate(item.pbanc_rcpt_bgng_dt),
    endDate: formatDate(item.pbanc_rcpt_end_dt),
    applyUrl,
    detailUrl,
    phone: item.prch_cnpl_no ?? '',
    score,
    fit: fitFromScore(score),
    reasons,
    description: (cleanText(item.pbanc_ctnt) || cleanText(item.aply_trgt_ctnt)).replace(/\s+/g, ' ').trim(),
  }
}

async function fetchKStartup(url: URL, signal: AbortSignal) {
  const res = await fetch(url, { signal, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error('K-Startup API request failed')
  return await res.json() as KStartupResponse
}

async function getKStartupPrograms(profile: MatchProfile, signal: AbortSignal) {
  const urls = [new URL(KSTARTUP_ENDPOINT)]
  urls[0].searchParams.set('page', '1')
  urls[0].searchParams.set('perPage', '80')
  urls[0].searchParams.set('cond[rcrt_prgs_yn::EQ]', 'Y')

  for (const keyword of searchKeywords(profile)) {
    const url = new URL(KSTARTUP_ENDPOINT)
    url.searchParams.set('page', '1')
    url.searchParams.set('perPage', '30')
    url.searchParams.set('cond[rcrt_prgs_yn::EQ]', 'Y')
    url.searchParams.set('cond[biz_pbanc_nm::LIKE]', keyword)
    urls.push(url)
  }

  const responses = await Promise.all(urls.map((url) => fetchKStartup(url, signal)))
  const unique = new Map<string, KStartupAnnouncement>()

  for (const response of responses) {
    for (const item of response.data ?? []) {
      const key = String(item.pbanc_sn ?? item.biz_pbanc_nm ?? unique.size)
      unique.set(key, item)
    }
  }

  return Array.from(unique.values())
    .filter((item) => !excludeKStartup(item, profile))
    .map((item) => kStartupToProgram(item, profile))
    .filter((program) => program.score >= 45)
}

function sortPrograms(programs: FundingProgram[]) {
  const sourcePriority = { policy_catalog: 2, kstartup: 1, loan_api: 1 }
  return programs.sort((a, b) => {
    const scoreDiff = b.score - a.score
    if (scoreDiff !== 0) return scoreDiff
    return sourcePriority[b.source] - sourcePriority[a.source]
  })
}

function topPrograms(programs: FundingProgram[], count: number) {
  return sortPrograms([...programs]).slice(0, count)
}

export async function GET(req: NextRequest) {
  const profile = buildProfile(req.nextUrl.searchParams)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  const catalogPrograms = policyCatalog
    .map((program) => catalogToProgram(program, profile))
    .filter((program) => program.score >= 45)

  try {
    const [kStartupPrograms, loanPrograms] = await Promise.all([
      getKStartupPrograms(profile, controller.signal),
      fetchKinfaLoans(profile, controller.signal),
    ])
    const programs = [
      ...topPrograms(catalogPrograms, 3),
      ...topPrograms(loanPrograms, 3),
      ...topPrograms(kStartupPrograms, 3),
    ]

    const body: FundingResponse = {
      programs,
      source: '무료 공공 API + 내부 정책자금 카탈로그',
      matchCount: programs.length,
    }

    return NextResponse.json(body)
  } catch {
    const programs = sortPrograms(catalogPrograms).slice(0, 9)
    const body: FundingResponse = {
      programs,
      source: '내부 정책자금 카탈로그',
      matchCount: programs.length,
    }
    return NextResponse.json(body)
  } finally {
    clearTimeout(timeout)
  }
}
