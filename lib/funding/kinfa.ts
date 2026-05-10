import type { FundingProgram } from '@/types/funding'

type KinfaItem = Record<string, string | undefined>

type KinfaProfile = {
  industry: string
  fundingGap: number
  ownerAge: number
}

const ENDPOINT =
  'https://apis.data.go.kr/B553701/LoanProductSearchingInfo/LoanProductSearchingInfo/getLoanProductSearchingInfo'

function textOf(item: KinfaItem) {
  return Object.values(item).filter(Boolean).join(' ')
}

function readTag(source: string, tag: string) {
  const match = source.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'))
  return match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() ?? ''
}

function parseItems(xml: string) {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return matches.map((itemXml) => {
    const fields = [
      'finprdnm',
      'lnlmt',
      'irtCtg',
      'irt',
      'maxtotlntrm',
      'rdptmthd',
      'usge',
      'trgt',
      'tgtFltr',
      'ofrinstnm',
      'hdlinst',
      'hdlinstdtlvw',
      'prdCtg',
      'rsdAreaPamtEqltIstm',
      'suprtgtdtlcond',
      'cnpl',
      'rltsite',
    ]
    return Object.fromEntries(fields.map((field) => [field, readTag(itemXml, field)])) as KinfaItem
  })
}

function scoreLoan(item: KinfaItem, profile: KinfaProfile) {
  const text = textOf(item)
  const reasons: string[] = []
  let score = 70

  if (text.includes('사업자')) {
    score += 30
    reasons.push('사업자 대상 대출상품')
  }
  if (profile.fundingGap > 0 && /운영|운전|창업|사업|생업|대환/.test(text)) {
    score += 30
    reasons.push('자금 조달 목적과 연관')
  }
  if (profile.ownerAge <= 39 && text.includes('청년')) {
    score += 14
    reasons.push('청년 조건과 연관')
  }
  if (profile.industry && text.includes(profile.industry)) {
    score += 10
    reasons.push('선택 업종명 포함')
  }
  if (text.includes('정책자금') || text.includes('서민금융')) {
    score += 10
    reasons.push('정책금융 상품')
  }
  if (reasons.length === 0) reasons.push('서민금융진흥원 대출상품')
  return { score, reasons }
}

function isBusinessLoan(item: KinfaItem) {
  const text = textOf(item)
  const title = item.finprdnm ?? ''
  const businessLike = /사업자|창업|운영자금|운전|소상공인|미소금융|생업/.test(text)
  const personalOnly = /전.?월세|전세|월세|주택|카드|학자금|의료비/.test(title)
  return businessLike && !personalOnly
}

export async function fetchKinfaLoans(profile: KinfaProfile, signal: AbortSignal): Promise<FundingProgram[]> {
  const key = process.env.KINFA_LOAN_API_KEY
  if (!key) return []

  const url = new URL(ENDPOINT)
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '30')
  url.searchParams.set('type', 'xml')
  url.searchParams.set('TGT_FLTR', '사업자')

  const res = await fetch(url, { signal, next: { revalidate: 86400 } })
  if (!res.ok) return []

  const xml = await res.text()
  if (xml.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR') || xml.includes('SERVICE ACCESS DENIED')) return []

  return parseItems(xml)
    .filter(isBusinessLoan)
    .map((item) => {
      const { score, reasons } = scoreLoan(item, profile)
      return {
        id: `kinfa-${item.finprdnm ?? crypto.randomUUID()}`,
        source: 'loan_api' as const,
        kind: 'loan' as const,
        title: item.finprdnm || '서민금융 대출상품',
        category: item.usge || item.prdCtg || '대출상품',
        region: item.rsdAreaPamtEqltIstm || '전국/상품별 상이',
        target: item.tgtFltr || item.trgt || '상품별 확인',
        businessAge: '상품별 확인',
        targetAge: '상품별 확인',
        organization: item.ofrinstnm || item.hdlinst || '서민금융진흥원',
        startDate: '상시/상품별 확인',
        endDate: '상품별 확인',
        applyUrl: item.rltsite || 'https://www.kinfa.or.kr',
        detailUrl: item.rltsite || 'https://www.kinfa.or.kr',
        phone: item.cnpl || '1397',
        score,
        fit: score >= 110 ? '적합' as const : score >= 70 ? '검토' as const : '참고' as const,
        reasons,
        description: [
          item.lnlmt ? `한도: ${Number(item.lnlmt).toLocaleString()}만원` : '',
          item.irtCtg || item.irt ? `금리: ${[item.irtCtg, item.irt].filter(Boolean).join(' ')}` : '',
          item.maxtotlntrm ? `기간: ${item.maxtotlntrm}` : '',
          item.rdptmthd ? `상환: ${item.rdptmthd}` : '',
          item.suprtgtdtlcond ? `조건: ${item.suprtgtdtlcond}` : '',
        ].filter(Boolean).join(' · ') || '서민금융진흥원 대출상품 API에서 조회된 상품입니다.',
      }
    })
    .filter((program) => program.score >= 45)
}
