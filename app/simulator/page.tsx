'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import KakaoMap, { type KakaoMapHandle } from '@/components/KakaoMap'
import { runStartupSimulation } from '@/lib/simulator'
import type { FundingProgram, FundingResponse } from '@/types/funding'
import type { DistrictData, MarkerInfo } from '@/types/map'
import type { SimulatorInput, SimulatorResult } from '@/types/simulator'

const toWon = (manwon: number) => manwon * 10000
const toManwon = (won: number) => Math.round(won / 10000)

const fmtWon = (value: number | null) => {
  if (value == null) return '-'
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(1)}억원`
  return `${toManwon(value).toLocaleString()}만원`
}

const fmtPeople = (value: number | null) => value == null ? '-' : `${Math.round(value).toLocaleString()}명`

const hostName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '링크 열기'
  }
}

const defaultInput: SimulatorInput = {
  capital: toWon(5000),
  setupCost: toWon(3500),
  monthlyRent: toWon(350),
  laborCost: toWon(300),
  operatingCost: toWon(180),
  marginRate: 58,
  averageTicket: 9000,
  ownerAge: 35,
  isFirstBusiness: true,
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-rose-400">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full py-2 text-sm font-semibold text-gray-900 outline-none"
        />
        <span className="shrink-0 text-xs text-gray-400">{suffix}</span>
      </div>
    </label>
  )
}

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'blue' | 'red' | 'green' }) {
  const toneClass = tone === 'blue' ? 'text-blue-600' : tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-green-600' : 'text-gray-900'
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function FundingCard({ program }: { program: FundingProgram }) {
  return (
    <div className="flex min-h-64 flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-bold">{program.title}</p>
        <span className="shrink-0 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
          {program.fit}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {program.region} · {program.category} · {program.organization}
      </p>
      <p className="mt-1 text-[11px] text-gray-400">
        {program.source === 'policy_catalog' ? '정책자금 카탈로그' : program.source === 'kstartup' ? 'K-Startup 공고' : '대출상품 API'} · {program.kind}
      </p>
      <p className="mt-3 text-xs font-semibold text-gray-700">
        접수 {program.startDate || '-'} ~ {program.endDate || '-'}
      </p>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-gray-500">
        {program.description || program.target}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {program.reasons.slice(0, 2).map((reason) => (
          <span key={reason} className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
            {reason}
          </span>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <a
          href={program.applyUrl || program.detailUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-gray-700"
        >
          신청/상세 보기 · {hostName(program.applyUrl || program.detailUrl)}
        </a>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-700">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, value / max * 100)}%` }} />
      </div>
    </div>
  )
}

type SimulatorSummary = {
  verdict: string
  sections: { title: string; content: string }[]
}

function SimulatorPageInner() {
  const searchParams = useSearchParams()
  const initLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
  const initLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
  const initIndustryRef = useRef(searchParams.get('industry') ?? '')

  const mapRef = useRef<KakaoMapHandle>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [markers, setMarkers] = useState<MarkerInfo[]>([])
  const [district, setDistrict] = useState<DistrictData | null>(null)
  const [industryData, setIndustryData] = useState<DistrictData | null>(null)
  const [selectedIndustryCode, setSelectedIndustryCode] = useState('')
  const [districtLoading, setDistrictLoading] = useState(false)
  const [industryLoading, setIndustryLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [fundingLoading, setFundingLoading] = useState(false)
  const [fundingPrograms, setFundingPrograms] = useState<FundingProgram[]>([])
  const [fundingError, setFundingError] = useState('')
  const [input, setInput] = useState(defaultInput)
  const [result, setResult] = useState<SimulatorResult | null>(null)
  const [aiSummary, setAiSummary] = useState<SimulatorSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ address: string; lat: number; lng: number }[]>([])
  const [showResults, setShowResults] = useState(false)

  const marker = markers[0] ?? null
  const industries = useMemo(() => district?.topIndustries ?? [], [district])
  const selectedIndustry = industries.find((industry) => industry.code === selectedIndustryCode) ?? null
  const loading = districtLoading || industryLoading
  const loanPrograms = fundingPrograms.filter((program) =>
    program.source === 'loan_api' ||
    (program.source === 'policy_catalog' && ['loan', 'guarantee'].includes(program.kind))
  )
  const startupPrograms = fundingPrograms.filter((program) =>
    program.source === 'kstartup' ||
    (program.source === 'policy_catalog' && !['loan', 'guarantee'].includes(program.kind))
  )

  // URL 파라미터로 전달된 위치를 지도가 준비되는 즉시 마커로 배치
  useEffect(() => {
    if (!initLat || !initLng || markers.length > 0) return
    const interval = setInterval(() => {
      mapRef.current?.setMarker(initLat, initLng)
    }, 300)
    return () => clearInterval(interval)
  }, [initLat, initLng, markers.length])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node))
        setShowResults(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); setShowResults(false); return }
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await mapRef.current?.searchAddress(searchQuery) ?? []
      setSearchResults(results)
      setShowResults(results.length > 0)
    }, 400)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

  useEffect(() => {
    if (!marker?.adstrdCd) return

    fetch(`/api/district?adstrdCd=${marker.adstrdCd}`)
      .then((res) => res.json())
      .then((data: DistrictData) => {
        setDistrict(data)
        const preferred = initIndustryRef.current && data.topIndustries.some((i) => i.code === initIndustryRef.current)
          ? initIndustryRef.current
          : (data.topIndustries[0]?.code ?? '')
        initIndustryRef.current = ''
        if (preferred) setIndustryLoading(true)
        setSelectedIndustryCode(preferred)
      })
      .catch(() => setDistrict(null))
      .finally(() => setDistrictLoading(false))
  }, [marker])

  useEffect(() => {
    if (!marker?.adstrdCd || !selectedIndustryCode) return

    fetch(`/api/district?adstrdCd=${marker.adstrdCd}&industry=${selectedIndustryCode}`)
      .then((res) => res.json())
      .then((data: DistrictData) => setIndustryData(data))
      .catch(() => setIndustryData(null))
      .finally(() => setIndustryLoading(false))
  }, [marker, selectedIndustryCode])

  function resetAnalysis() {
    setResult(null)
    setAiSummary(null)
    setSummaryLoading(false)
    setFundingPrograms([])
    setFundingError('')
  }

  function updateInput<K extends keyof SimulatorInput>(key: K, value: SimulatorInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
    resetAnalysis()
  }

  function handleMarkersChange(nextMarkers: MarkerInfo[]) {
    setMarkers(nextMarkers)
    setDistrict(null)
    setIndustryData(null)
    setSelectedIndustryCode('')
    setDistrictLoading(nextMarkers.length > 0)
    setIndustryLoading(false)
    resetAnalysis()
  }

  function handleIndustryChange(code: string) {
    setSelectedIndustryCode(code)
    setIndustryData(null)
    setIndustryLoading(!!code)
    resetAnalysis()
  }

  function handleSearchSelect(r: { address: string; lat: number; lng: number }) {
    mapRef.current?.setMarker(r.lat, r.lng)
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  function resetLocation() {
    mapRef.current?.reset()
    setMarkers([])
    setDistrict(null)
    setIndustryData(null)
    setSelectedIndustryCode('')
    setDistrictLoading(false)
    setIndustryLoading(false)
    setSearchQuery('')
    setShowResults(false)
    resetAnalysis()
  }

  async function loadFundingPrograms(nextResult: SimulatorResult, nextIndustryName: string) {
    if (!marker) return

    const params = new URLSearchParams({
      region: '서울',
      guName: marker.guName,
      industry: nextIndustryName,
      ownerAge: String(input.ownerAge),
      isFirstBusiness: String(input.isFirstBusiness),
      fundingGap: String(nextResult.fundingGap),
      survivalScore: String(nextResult.survivalScore),
    })

    setFundingLoading(true)
    setFundingError('')
    try {
      const res = await fetch(`/api/funding?${params.toString()}`)
      if (!res.ok) throw new Error('funding request failed')
      const data = await res.json() as FundingResponse
      setFundingPrograms(data.programs)
    } catch {
      setFundingPrograms([])
      setFundingError('K-Startup 공고를 불러오지 못했습니다. 임시 추천을 표시합니다.')
    } finally {
      setFundingLoading(false)
    }
  }

  function analyze() {
    if (!marker || !selectedIndustry || !industryData) return
    setAnalyzing(true)
    const nextResult = runStartupSimulation(input, {
      marker,
      industry: selectedIndustry,
      district: industryData,
    })
    setResult(nextResult)
    setFundingPrograms([])
    void loadFundingPrograms(nextResult, selectedIndustry.name)

    setSummaryLoading(true)
    setAiSummary(null)
    fetch('/api/simulator-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result: nextResult,
        context: { guName: marker.guName, dongName: marker.dongName, industryName: selectedIndustry.name },
        input,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SimulatorSummary | null) => { if (data?.sections) setAiSummary(data) })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))

    setAnalyzing(false)
  }

  const canAnalyze = !!marker && !!selectedIndustry && !!industryData && !loading

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ background: "#daeaf1" }}>
        <div className="flex items-center gap-4">
          <Link href="/compare" className="text-sm text-slate-500 hover:text-slate-700">상권 비교</Link>
          <h1 className="text-lg font-bold text-slate-700">창업 시뮬레이터</h1>
        </div>
        <p className="text-sm text-slate-500">입지 진단부터 자금 추천까지 한 번에 확인합니다.</p>
      </header>

      <div className="grid min-h-[calc(100vh-57px)] grid-cols-[500px_1fr]">
        <aside className="border-r border-gray-200 bg-white">
          <div className="h-72 border-b border-gray-200">
            <div className="relative h-full">
              <KakaoMap ref={mapRef} maxMarkers={1} onMarkersChange={handleMarkersChange} />
            </div>
          </div>

          <div className="space-y-5 p-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">1. 창업 위치</h2>
                {marker && (
                  <button onClick={resetLocation} className="text-xs text-gray-400 hover:text-gray-700">
                    다시 선택
                  </button>
                )}
              </div>

              {/* 주소 검색 */}
              <div ref={searchWrapRef} className="relative mb-2">
                <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-orange-400">
                  <span className="text-gray-400 text-sm mr-2">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="동/구 이름 검색 (예: 합정동)"
                    className="flex-1 py-2 text-sm outline-none placeholder-gray-400"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setShowResults(false) }}
                      className="text-gray-300 hover:text-gray-500 text-xs ml-1">✕</button>
                  )}
                </div>
                {showResults && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {searchResults.map((r, i) => (
                      <button key={i} onClick={() => handleSearchSelect(r)}
                        className={`w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        {r.address}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {marker ? (
                <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                  <span className="font-semibold">{marker.guName} {marker.dongName}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center">또는 지도를 직접 클릭해 선택</p>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">2. 업종</h2>
              <select
                value={selectedIndustryCode}
                onChange={(e) => handleIndustryChange(e.target.value)}
                disabled={!industries.length}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium disabled:bg-gray-50 disabled:text-gray-400"
              >
                {!industries.length && <option>위치를 먼저 선택하세요</option>}
                {industries.map((industry) => (
                  <option key={industry.code} value={industry.code}>
                    {industry.name}
                  </option>
                ))}
              </select>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold">3. 자본/비용 조건</h2>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="보유 자본금" value={toManwon(input.capital)} suffix="만원" onChange={(v) => updateInput('capital', toWon(v))} />
                <NumberField label="초기 개업비" value={toManwon(input.setupCost)} suffix="만원" onChange={(v) => updateInput('setupCost', toWon(v))} />
                <NumberField label="월 임대료" value={toManwon(input.monthlyRent)} suffix="만원" onChange={(v) => updateInput('monthlyRent', toWon(v))} />
                <NumberField label="월 인건비" value={toManwon(input.laborCost)} suffix="만원" onChange={(v) => updateInput('laborCost', toWon(v))} />
                <NumberField label="기타 운영비" value={toManwon(input.operatingCost)} suffix="만원" onChange={(v) => updateInput('operatingCost', toWon(v))} />
                <NumberField label="마진율" value={input.marginRate} suffix="%" onChange={(v) => updateInput('marginRate', v)} />
                <NumberField label="평균 객단가" value={input.averageTicket} suffix="원" onChange={(v) => updateInput('averageTicket', v)} />
                <NumberField label="대표자 나이" value={input.ownerAge} suffix="세" onChange={(v) => updateInput('ownerAge', v)} />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={input.isFirstBusiness}
                  onChange={(e) => updateInput('isFirstBusiness', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                첫 창업입니다
              </label>
            </section>

            <button
              onClick={analyze}
              disabled={!canAnalyze || analyzing}
              className="w-full rounded-lg bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:bg-gray-300"
            >
              {loading ? '상권 데이터 불러오는 중...' : analyzing ? '분석 중...' : '분석 시작'}
            </button>
          </div>
        </aside>

        <section className="overflow-y-auto p-6">
          {!result && (
            <div className="flex min-h-full items-center justify-center">
              <div className="max-w-md text-center">
                <p className="text-4xl font-bold text-gray-200">SIM</p>
                <h2 className="mt-3 text-xl font-bold">창업 조건을 입력하고 분석을 시작하세요</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  지도 위치, 업종, 자본금과 월 고정비를 기준으로 예상 매출, 손익분기점, 생존가능성, 금융지원 추천을 한 번에 보여줍니다.
                </p>
                {district && (
                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <MetricCard label="생활인구" value={fmtPeople(district.population)} />
                    <MetricCard label="분기 유동인구" value={fmtPeople(district.flowPopulation)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {result && marker && selectedIndustry && industryData && (
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">{marker.guName} {marker.dongName} · {selectedIndustry.name}</p>
                  <h2 className="mt-1 text-2xl font-bold">창업성 진단 결과</h2>
                </div>
                <div className="rounded-lg bg-white px-5 py-3 text-right shadow-sm ring-1 ring-gray-200">
                  <p className="text-xs font-semibold text-gray-500">생존가능성 점수</p>
                  <p className={`text-3xl font-black ${result.survivalScore >= 80 ? 'text-green-600' : result.survivalScore >= 50 ? 'text-amber-500' : 'text-red-600'}`}>
                    {result.survivalScore}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="예상 월매출" value={fmtWon(result.estimatedMonthlySales)} />
                <MetricCard label="월 예상 순이익" value={fmtWon(result.expectedMonthlyProfit)} tone={result.expectedMonthlyProfit >= 0 ? 'blue' : 'red'} />
                <MetricCard label="손익분기점 매출" value={fmtWon(result.breakEvenSales)} tone="green" />
                <MetricCard label="필요 추가자금" value={fmtWon(result.fundingGap)} tone={result.fundingGap > 0 ? 'red' : 'blue'} />
              </div>

              <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold">점수 구성</h3>
                  <div className="mt-4 space-y-4">
                    <ScoreBar label="매출 잠재력" value={result.scoreBreakdown.sales} max={32} />
                    <ScoreBar label="수익성" value={result.scoreBreakdown.profit} max={25} />
                    <ScoreBar label="유동인구" value={result.scoreBreakdown.traffic} max={15} />
                    <ScoreBar label="경쟁 강도" value={result.scoreBreakdown.competition} max={18} />
                    <ScoreBar label="폐업 리스크" value={result.scoreBreakdown.risk} max={10} />
                  </div>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold">자금 진단</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">월 고정비</span>
                      <span className="font-semibold">{fmtWon(result.monthlyFixedCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">개업 후 운영자금</span>
                      <span className="font-semibold">{fmtWon(result.operatingCapital)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">경쟁 강도</span>
                      <span className="font-semibold">{result.competitionLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">예상 일 방문고객</span>
                      <span className="font-semibold">{result.dailyCustomers == null ? '-' : `${result.dailyCustomers.toLocaleString()}명`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">자본 소진 예상</span>
                      <span className="font-semibold">{result.runwayMonths == null ? '흑자 구조' : `${result.runwayMonths}개월`}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">분석 요약</h3>
                  {summaryLoading && (
                    <span className="text-xs text-rose-500 animate-pulse">AI 분석 중…</span>
                  )}
                  {!summaryLoading && aiSummary && (
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">AI</span>
                  )}
                </div>

                {summaryLoading ? (
                  <div className="mt-4 space-y-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse space-y-1.5">
                        <div className="h-3 w-24 rounded bg-gray-100" />
                        <div className="h-4 w-full rounded bg-gray-100" />
                        <div className="h-4 w-5/6 rounded bg-gray-100" />
                      </div>
                    ))}
                  </div>
                ) : aiSummary ? (
                  <div className="mt-3 space-y-4">
                    <div className="rounded-lg bg-rose-50 px-3 py-2.5">
                      <p className="text-sm font-bold text-rose-700">✦ {aiSummary.verdict}</p>
                    </div>
                    {aiSummary.sections.map((section) => (
                      <div key={section.title}>
                        <p className="text-sm font-bold text-gray-700 mb-1">{section.title}</p>
                        <p className="text-sm font-medium leading-6 text-gray-700">{section.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {result.summary.map((text) => (
                      <p key={text} className="rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">{text}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">추천 금융지원</h3>
                  <span className="text-xs text-gray-400">
                    {fundingLoading ? '지원정보 조회 중' : fundingPrograms.length > 0 ? '정책자금·대출 / 창업지원사업 구분' : '임시 추천'}
                  </span>
                </div>
                {fundingError && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{fundingError}</p>
                )}
                {fundingLoading && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-44 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
                    ))}
                  </div>
                )}
                {!fundingLoading && fundingPrograms.length > 0 && (
                  <div className="mt-4 space-y-6">
                    {loanPrograms.length > 0 && (
                      <section>
                        <div className="mb-2 flex items-end justify-between">
                          <div>
                            <h4 className="text-sm font-bold">정책자금·대출</h4>
                            <p className="mt-0.5 text-xs text-gray-400">대출, 보증, 정책자금처럼 금융심사 또는 보증심사를 거치는 항목입니다.</p>
                          </div>
                          <span className="text-xs text-gray-400">{loanPrograms.length}건</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {loanPrograms.map((program) => <FundingCard key={program.id} program={program} />)}
                        </div>
                      </section>
                    )}

                    {startupPrograms.length > 0 && (
                      <section>
                        <div className="mb-2 flex items-end justify-between">
                          <div>
                            <h4 className="text-sm font-bold">창업지원사업</h4>
                            <p className="mt-0.5 text-xs text-gray-400">사업화, 공간, 교육, 멘토링처럼 공고별 선정 절차가 있는 항목입니다.</p>
                          </div>
                          <span className="text-xs text-gray-400">{startupPrograms.length}건</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {startupPrograms.map((program) => <FundingCard key={program.id} program={program} />)}
                        </div>
                      </section>
                    )}
                  </div>
                )}
                {!fundingLoading && fundingPrograms.length === 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {result.fundingRecommendations.map((item) => (
                      <div key={item.title} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold">{item.title}</p>
                          <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{item.fit}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{item.category}</p>
                        <p className="mt-3 text-sm font-semibold text-gray-800">{item.amountHint}</p>
                        <p className="mt-2 text-xs leading-5 text-gray-500">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">로딩 중...</div>}>
      <SimulatorPageInner />
    </Suspense>
  )
}
