import { NextRequest, NextResponse } from 'next/server'

export const preferredRegion = ['icn1']
export const maxDuration = 60

const BASE = 'http://openapi.seoul.go.kr:8088'
const SEOUL_API_TIMEOUT_MS = 15000

type SeoulRow = Record<string, string | number | null | undefined>
type SeoulApiPage = Record<string, { row?: SeoulRow[] } | undefined>

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SEOUL_API_TIMEOUT_MS),
  })
  const text = await res.text()
  if (!text || text.trimStart().startsWith('<') || !text.trimStart().startsWith('{')) {
    throw new Error(`Seoul API 비정상 응답 (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  return JSON.parse(text)
}

async function fetchAllPages(key: string, service: string, total: number, suffix = ''): Promise<SeoulRow[]> {
  const size = 1000
  const pages = Math.ceil(total / size)
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchJson(`${BASE}/${key}/json/${service}/${i * size + 1}/${Math.min((i + 1) * size, total)}/${suffix}`)
    )
  )
  return results.flatMap((r) => (r as SeoulApiPage)?.[service]?.row ?? [])
}

// ── 추정매출 캐시 ── dong8 → industryCode → SalesEntry ─────────────────────
type SalesEntry = {
  name: string; sales: number
  mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number
  t0006: number; t0611: number; t1114: number; t1417: number; t1721: number; t2124: number
  male: number; female: number
  age10: number; age20: number; age30: number; age40: number; age50: number; age60: number
}

let salesCache: Map<string, Map<string, SalesEntry>> | null = null
let salesPromise: Promise<Map<string, Map<string, SalesEntry>>> | null = null

async function loadSalesCache() {
  const key = process.env.SEOUL_API_KEY_SALES!
  const service = 'VwsmAdstrdSelngW'
  const quarter = '20254'
  const first = await fetchJson(`${BASE}/${key}/json/${service}/1/1/${quarter}/`) as SeoulApiPage
  const total: number = (first?.[service] as { list_total_count?: number })?.list_total_count ?? 0
  const rows = await fetchAllPages(key, service, total, `${quarter}/`)

  const map = new Map<string, Map<string, SalesEntry>>()
  for (const r of rows) {
    const dong = String(r.ADSTRD_CD)
    const ind = String(r.SVC_INDUTY_CD)
    if (!map.has(dong)) map.set(dong, new Map())
    const dongMap = map.get(dong)!
    const prev = dongMap.get(ind)
    const n = (f: string) => Number(r[f] ?? 0)
    dongMap.set(ind, {
      name: String(r.SVC_INDUTY_CD_NM ?? ''),
      sales: (prev?.sales ?? 0) + n('THSMON_SELNG_AMT'),
      mon:   (prev?.mon   ?? 0) + n('MON_SELNG_AMT'),
      tue:   (prev?.tue   ?? 0) + n('TUES_SELNG_AMT'),
      wed:   (prev?.wed   ?? 0) + n('WED_SELNG_AMT'),
      thu:   (prev?.thu   ?? 0) + n('THUR_SELNG_AMT'),
      fri:   (prev?.fri   ?? 0) + n('FRI_SELNG_AMT'),
      sat:   (prev?.sat   ?? 0) + n('SAT_SELNG_AMT'),
      sun:   (prev?.sun   ?? 0) + n('SUN_SELNG_AMT'),
      t0006: (prev?.t0006 ?? 0) + n('TMZON_00_06_SELNG_AMT'),
      t0611: (prev?.t0611 ?? 0) + n('TMZON_06_11_SELNG_AMT'),
      t1114: (prev?.t1114 ?? 0) + n('TMZON_11_14_SELNG_AMT'),
      t1417: (prev?.t1417 ?? 0) + n('TMZON_14_17_SELNG_AMT'),
      t1721: (prev?.t1721 ?? 0) + n('TMZON_17_21_SELNG_AMT'),
      t2124: (prev?.t2124 ?? 0) + n('TMZON_21_24_SELNG_AMT'),
      male:  (prev?.male  ?? 0) + n('ML_SELNG_AMT'),
      female:(prev?.female?? 0) + n('FML_SELNG_AMT'),
      age10: (prev?.age10 ?? 0) + n('AGRDE_10_SELNG_AMT'),
      age20: (prev?.age20 ?? 0) + n('AGRDE_20_SELNG_AMT'),
      age30: (prev?.age30 ?? 0) + n('AGRDE_30_SELNG_AMT'),
      age40: (prev?.age40 ?? 0) + n('AGRDE_40_SELNG_AMT'),
      age50: (prev?.age50 ?? 0) + n('AGRDE_50_SELNG_AMT'),
      age60: (prev?.age60 ?? 0) + n('AGRDE_60_ABOVE_SELNG_AMT'),
    })
  }
  return (salesCache = map)
}

const getSales = () => salesCache ?? (salesPromise ??= loadSalesCache()).then(m => (salesCache = m!))

// ── 점포 캐시 ── dong8 → industryCode → StoreEntry ──────────────────────────
type StoreEntry = { name: string; stores: number; similar: number; openCo: number; closeCo: number; frcCo: number }

let storeCache: Map<string, Map<string, StoreEntry>> | null = null
let storePromise: Promise<Map<string, Map<string, StoreEntry>>> | null = null

async function loadStoreCache() {
  const key = process.env.SEOUL_API_KEY_STORE!
  const service = 'VwsmAdstrdStorW'
  const quarter = '20254'
  const first = await fetchJson(`${BASE}/${key}/json/${service}/1/1/${quarter}/`) as SeoulApiPage
  const total: number = (first?.[service] as { list_total_count?: number })?.list_total_count ?? 0
  const rows = await fetchAllPages(key, service, total, `${quarter}/`)

  const map = new Map<string, Map<string, StoreEntry>>()
  for (const r of rows) {
    const dong = String(r.ADSTRD_CD)
    const ind = String(r.SVC_INDUTY_CD)
    if (!map.has(dong)) map.set(dong, new Map())
    const dongMap = map.get(dong)!
    const prev = dongMap.get(ind)
    const n = (f: string) => Number(r[f] ?? 0)
    dongMap.set(ind, {
      name:    String(r.SVC_INDUTY_CD_NM ?? ''),
      stores:  (prev?.stores  ?? 0) + n('STOR_CO'),
      similar: (prev?.similar ?? 0) + n('SIMILR_INDUTY_STOR_CO'),
      openCo:  (prev?.openCo  ?? 0) + n('OPBIZ_STOR_CO'),
      closeCo: (prev?.closeCo ?? 0) + n('CLSBIZ_STOR_CO'),
      frcCo:   (prev?.frcCo   ?? 0) + n('FRC_STOR_CO'),
    })
  }
  return (storeCache = map)
}

const getStore = () => storeCache ?? (storePromise ??= loadStoreCache()).then(m => (storeCache = m!))

// ── 소비 캐시 ── dong8 → 월소비지출 ─────────────────────────────────────────
let cnsmpCache: Map<string, number> | null = null
let cnsmpPromise: Promise<Map<string, number>> | null = null

async function loadCnsmpCache() {
  const key = process.env.SEOUL_API_KEY_CONSUMPTION!
  const service = 'VwsmAdstrdNcmCnsmpW'
  const first = await fetchJson(`${BASE}/${key}/json/${service}/1/1/`) as SeoulApiPage
  const total: number = (first?.[service] as { list_total_count?: number })?.list_total_count ?? 0
  const rows = await fetchAllPages(key, service, total)
  const latest = new Map<string, { q: string; amt: number }>()
  for (const r of rows) {
    const cd = String(r.ADSTRD_CD)
    const q = String(r.STDR_YYQU_CD ?? '')
    const prev = latest.get(cd)
    if (!prev || q > prev.q) latest.set(cd, { q, amt: Number(r.EXPNDTR_TOTAMT ?? 0) })
  }
  const map = new Map<string, number>()
  for (const [cd, { amt }] of latest) map.set(cd, amt)
  return (cnsmpCache = map)
}

const getCnsmp = () => cnsmpCache ?? (cnsmpPromise ??= loadCnsmpCache()).then(m => (cnsmpCache = m!))

// ── 생활인구 캐시 ── dong8 → 시간대평균 인구 ─────────────────────────────────
let popCache: Map<string, number> | null = null
let popPromise: Promise<Map<string, number>> | null = null

async function loadPopCache() {
  const key = process.env.SEOUL_API_KEY_POPULATION!
  const service = 'SPOP_LOCAL_RESD_DONG'
  const r0 = await fetchJson(`${BASE}/${key}/json/${service}/1/1/`) as SeoulApiPage
  const latestDate: string = (r0?.[service] as { row?: { STDR_DE_ID?: string }[] })?.row?.[0]?.STDR_DE_ID ?? '20260503'
  const r1 = await fetchJson(`${BASE}/${key}/json/${service}/1/1/${latestDate}/`) as SeoulApiPage
  const total: number = (r1?.[service] as { list_total_count?: number })?.list_total_count ?? 0
  const rows = await fetchAllPages(key, service, total, `${latestDate}/`)
  const raw = new Map<string, { sum: number; cnt: number }>()
  for (const r of rows) {
    const cd = String(r.ADSTRD_CODE_SE)
    const prev = raw.get(cd) ?? { sum: 0, cnt: 0 }
    raw.set(cd, { sum: prev.sum + Number(r.TOT_LVPOP_CO ?? 0), cnt: prev.cnt + 1 })
  }
  const map = new Map<string, number>()
  for (const [cd, { sum, cnt }] of raw) map.set(cd, cnt > 0 ? Math.round(sum / cnt) : 0)
  return (popCache = map)
}

const getPop = () => popCache ?? (popPromise ??= loadPopCache()).then(m => (popCache = m!))

type FlowEntry = {
  total: number
  mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number
  t0006: number; t0611: number; t1114: number; t1417: number; t1721: number; t2124: number
  male: number; female: number
  age10: number; age20: number; age30: number; age40: number; age50: number; age60: number
}

let flowPopCache: Map<string, FlowEntry> | null = null
let flowPopPromise: Promise<Map<string, FlowEntry>> | null = null

async function loadFlowPopCache() {
  const key = process.env.SEOUL_API_KEY_FLOW_POPULATION!
  const service = 'VwsmAdstrdFlpopW'
  const first = await fetchJson(`${BASE}/${key}/json/${service}/1/1/`) as SeoulApiPage
  const total: number = (first?.[service] as { list_total_count?: number })?.list_total_count ?? 0
  const rows = await fetchAllPages(key, service, total)

  const latest = new Map<string, { q: string; entry: FlowEntry }>()
  for (const r of rows) {
    const cd = String(r.ADSTRD_CD)
    const q = String(r.STDR_YYQU_CD ?? '')
    const prev = latest.get(cd)
    if (prev && q <= prev.q) continue

    const n = (f: string) => Number(r[f] ?? 0)
    latest.set(cd, {
      q,
      entry: {
        total: n('TOT_FLPOP_CO'),
        mon:   n('MON_FLPOP_CO'),
        tue:   n('TUES_FLPOP_CO'),
        wed:   n('WED_FLPOP_CO'),
        thu:   n('THUR_FLPOP_CO'),
        fri:   n('FRI_FLPOP_CO'),
        sat:   n('SAT_FLPOP_CO'),
        sun:   n('SUN_FLPOP_CO'),
        t0006: n('TMZON_00_06_FLPOP_CO'),
        t0611: n('TMZON_06_11_FLPOP_CO'),
        t1114: n('TMZON_11_14_FLPOP_CO'),
        t1417: n('TMZON_14_17_FLPOP_CO'),
        t1721: n('TMZON_17_21_FLPOP_CO'),
        t2124: n('TMZON_21_24_FLPOP_CO'),
        male:  n('ML_FLPOP_CO'),
        female:n('FML_FLPOP_CO'),
        age10: n('AGRDE_10_FLPOP_CO'),
        age20: n('AGRDE_20_FLPOP_CO'),
        age30: n('AGRDE_30_FLPOP_CO'),
        age40: n('AGRDE_40_FLPOP_CO'),
        age50: n('AGRDE_50_FLPOP_CO'),
        age60: n('AGRDE_60_ABOVE_FLPOP_CO'),
      },
    })
  }

  const map = new Map<string, FlowEntry>()
  for (const [cd, { entry }] of latest) map.set(cd, entry)
  return (flowPopCache = map)
}

const getFlowPop = () => flowPopCache ?? (flowPopPromise ??= loadFlowPopCache()).then(m => (flowPopCache = m!))

// ── GET /api/district ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const kakaoCode = req.nextUrl.searchParams.get('adstrdCd') ?? ''
  const cd8 = kakaoCode.slice(0, 8)
  const industry = req.nextUrl.searchParams.get('industry') ?? ''

  if (!cd8) return NextResponse.json({ error: 'adstrdCd required' }, { status: 400 })

  let salesMap: Awaited<ReturnType<typeof getSales>>
  let storeMap: Awaited<ReturnType<typeof getStore>>
  let cnsmpMap: Awaited<ReturnType<typeof getCnsmp>>
  let popMap: Awaited<ReturnType<typeof getPop>>
  let flowPopMap: Awaited<ReturnType<typeof getFlowPop>>

  try {
    ;[salesMap, storeMap, cnsmpMap, popMap, flowPopMap] = await Promise.all([
      getSales(), getStore(), getCnsmp(), getPop(), getFlowPop(),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[district] Seoul API error:', message, err)
    return NextResponse.json({ error: `서울 공공데이터 API 오류: ${message}` }, { status: 502 })
  }

  const dongSales = salesMap?.get(cd8)   // Map<industryCode, SalesEntry>
  const dongStore = storeMap?.get(cd8)   // Map<industryCode, StoreEntry>
  const population   = popMap?.get(cd8)  ?? null
  const consumptionAmt = cnsmpMap?.get(cd8) ?? null
  const flow = flowPopMap?.get(cd8) ?? null
  const flowGenderTotal = (flow?.male ?? 0) + (flow?.female ?? 0)
  const flowAgeArr = flow ? [flow.age10, flow.age20, flow.age30, flow.age40, flow.age50, flow.age60] : []
  const flowAgeTotal = flowAgeArr.reduce((a, b) => a + b, 0)
  const flowResponse = {
    flowPopulation: flow?.total ?? null,
    flowByDay: flow ? [flow.mon, flow.tue, flow.wed, flow.thu, flow.fri, flow.sat, flow.sun] : null,
    flowByTime: flow ? [flow.t0006, flow.t0611, flow.t1114, flow.t1417, flow.t1721, flow.t2124] : null,
    flowMalePct: flowGenderTotal > 0 ? Math.round((flow?.male ?? 0) / flowGenderTotal * 100) : null,
    flowFemalePct: flowGenderTotal > 0 ? Math.round((flow?.female ?? 0) / flowGenderTotal * 100) : null,
    flowAgePct: flowAgeTotal > 0 ? flowAgeArr.map(v => Math.round(v / flowAgeTotal * 100)) : null,
  }

  if (!industry) {
    // ── 전체 집계 모드 ──────────────────────────────────────────────────────
    let totalSales = 0, totalStores = 0
    const industries: { code: string; name: string; sales: number; stores: number }[] = []

    if (dongSales) {
      for (const [code, s] of dongSales) {
        totalSales += s.sales
        industries.push({ code, name: s.name, sales: s.sales, stores: dongStore?.get(code)?.stores ?? 0 })
      }
    }
    if (dongStore) {
      for (const [, s] of dongStore) totalStores += s.stores
    }
    industries.sort((a, b) => b.sales - a.sales)

    return NextResponse.json({
      population, consumptionAmt, ...flowResponse,
      totalSales, totalStores,
      topIndustries: industries.slice(0, 10),
      industryName: null, monthlySales: null, storeCount: null, similarStores: null,
      openRate: null, closeRate: null, franchiseRate: null,
      weekdaySales: null, weekendSales: null, timeSales: null,
      malePct: null, femalePct: null, agePct: null,
    })
  }

  // ── 업종 선택 모드 ──────────────────────────────────────────────────────────
  const s = dongSales?.get(industry)
  const t = dongStore?.get(industry)
  const totalGender = (s?.male ?? 0) + (s?.female ?? 0)
  const ageArr = s ? [s.age10, s.age20, s.age30, s.age40, s.age50, s.age60] : []
  const totalAge = ageArr.reduce((a, b) => a + b, 0)
  const stores = t?.stores ?? null

  return NextResponse.json({
    population, consumptionAmt, ...flowResponse,
    totalSales: null, totalStores: null, topIndustries: [],
    industryName: s?.name ?? t?.name ?? '',
    monthlySales: s?.sales ?? null,
    storeCount: stores,
    similarStores: t?.similar ?? null,
    openRate:      (t && stores) ? Math.round(t.openCo  / stores * 1000) / 10 : null,
    closeRate:     (t && stores) ? Math.round(t.closeCo / stores * 1000) / 10 : null,
    franchiseRate: (t && stores) ? Math.round(t.frcCo   / stores * 1000) / 10 : null,
    weekdaySales:  s ? [s.mon, s.tue, s.wed, s.thu, s.fri] : null,
    weekendSales:  s ? [s.sat, s.sun] : null,
    timeSales:     s ? [s.t0006, s.t0611, s.t1114, s.t1417, s.t1721, s.t2124] : null,
    malePct:   totalGender > 0 ? Math.round((s?.male   ?? 0) / totalGender * 100) : null,
    femalePct: totalGender > 0 ? Math.round((s?.female ?? 0) / totalGender * 100) : null,
    agePct:    totalAge    > 0 ? ageArr.map(v => Math.round(v / totalAge * 100)) : null,
  })
}
