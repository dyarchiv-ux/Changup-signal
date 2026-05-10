'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import KakaoMap, { type KakaoMapHandle } from '@/components/KakaoMap'
import type { MarkerInfo, DistrictData, IndustryItem } from '@/types/map'

// ── 포맷 유틸 ────────────────────────────────────────────────────────────────
const fmtAmt = (n: number | null) => {
  if (n == null) return '-'
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`
  return n.toLocaleString()
}
const fmtPop  = (n: number | null) => n == null ? '-' : `${Math.round(n).toLocaleString()}명`
const fmtCnt  = (n: number | null) => n == null ? '-' : `${n.toLocaleString()}개`
const fmtRate = (n: number | null) => n == null ? '-' : `${n.toFixed(1)}%`

// ── 도넛 차트 ─────────────────────────────────────────────────────────────────
const DAY_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#6366f1','#a855f7']
const GAP = 1.5  // 세그먼트 사이 흰 간격 (circumference 단위)

function DonutChart({ labels, values, colors }: {
  labels: string[]
  values: number[]
  colors?: string[]
}) {
  const total = values.reduce((a, b) => a + b, 0) || 1
  const r = 30, cx = 50, cy = 50, sw = 22
  const circ = 2 * Math.PI * r
  const palette = colors ?? DAY_COLORS

  const segments = values.map((v, i) => {
    const pct = v / total
    const fullPortion = pct * circ
    const cumPortion = values.slice(0, i).reduce((sum, prev) => sum + (prev / total) * circ, 0)
    const midRad = ((cumPortion + fullPortion / 2) / circ) * 2 * Math.PI
    const seg = {
      visible: Math.max(0, fullPortion - GAP),  // 간격만큼 줄여 흰 틈 생성
      dashOffset: -cumPortion,
      color: palette[i % palette.length],
      label: labels[i],
      pct: Math.round(pct * 100),
      lx: cx + r * Math.cos(midRad),
      ly: cy + r * Math.sin(midRad),
      showLabel: pct >= 0.07,
    }
    return seg
  })

  return (
    <div className="flex items-center gap-3">
      {/* 왼쪽 범례 */}
      <div className="shrink-0 space-y-2">
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0"
              style={{ background: palette[i % palette.length] }} />
            <span className="text-sm text-gray-700">{label}</span>
            <span className="text-sm font-bold text-gray-900">{segments[i].pct}%</span>
          </div>
        ))}
      </div>

      {/* 도넛 */}
      <div className="relative w-52 shrink-0" style={{ aspectRatio: '1' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full"
          style={{ transform: 'rotate(-90deg)' }}>
          {/* 배경 링 */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
          {segments.map((seg, i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={sw}
                strokeDasharray={`${seg.visible} ${circ}`}
                strokeDashoffset={seg.dashOffset}
              />
              {/* 세그먼트 내 이름 + % (SVG -90° 회전 상쇄) */}
              {seg.showLabel && (
                <g transform={`rotate(90, ${seg.lx}, ${seg.ly})`}>
                  <text x={seg.lx} y={seg.ly - 3.5}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="5.5" fontWeight="800" fill="white">
                    {seg.label}
                  </text>
                  <text x={seg.lx} y={seg.ly + 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="5" fontWeight="600" fill="rgba(255,255,255,0.85)">
                    {seg.pct}%
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ── 미니 바차트 ───────────────────────────────────────────────────────────────
function BarChart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="space-y-1">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-9 shrink-0 text-right">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className={`${color} h-1.5 rounded-full transition-all`}
              style={{ width: `${(values[i] / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-6 shrink-0">
            {Math.round((values[i] / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 성별 바 ───────────────────────────────────────────────────────────────────
function GenderBar({ malePct, femalePct }: { malePct: number | null; femalePct: number | null }) {
  if (malePct == null) return <span className="text-xs text-gray-400">-</span>
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-blue-500 font-medium">남 {malePct}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f7f8" }}>
        <div className="h-full rounded-full" style={{ width: `${malePct}%`, background: "#abc6db" }} />
      </div>
      <span className="font-medium text-slate-500">여 {femalePct}%</span>
    </div>
  )
}

// ── 업종 드롭다운 선택기 ──────────────────────────────────────────────────────
function IndustrySelector({ industries, selected, onChange }: {
  industries: IndustryItem[]
  selected: string
  onChange: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const selectedName = industries.find(i => i.code === selected)?.name ?? ''

  return (
    <div className="flex items-center gap-2">
      {/* 드롭다운 버튼 */}
      <div ref={wrapRef} className="relative flex-1">
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
            selected
              ? 'border-[#f97316] bg-[#fff7ed] text-[#c2410c]'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className="font-medium truncate">{selected ? selectedName : '업종 선택'}</span>
          <span className="ml-2 shrink-0 text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {industries.map((ind, i) => (
              <button
                key={ind.code}
                onClick={() => { onChange(ind.code); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                  i > 0 ? 'border-t border-gray-50' : ''
                } ${
                  selected === ind.code
                    ? 'bg-[#fff7ed] text-[#c2410c] font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{ind.name}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{fmtAmt(ind.sales)}원</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 단일 상권 분석 패널 내용 ──────────────────────────────────────────────────
function SingleAnalysis({ data, label }: { data: DistrictData; label: 'A' | 'B' }) {
  const accentA = 'text-blue-600'; const accentB = 'text-red-600'
  const accent = label === 'A' ? accentA : accentB
  const barColor = label === 'A' ? 'bg-blue-400' : 'bg-red-400'

  const isIndustry = !!data.industryName

  return (
    <div className="space-y-4 px-5 py-4">
      {/* 핵심 지표 */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-2">
          {isIndustry ? `${data.industryName} 상권 분석` : '전체 상권 현황'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-sm font-semibold text-gray-700">추정 월매출</p>
            <p className={`text-base font-bold ${accent}`}>
              {fmtAmt(isIndustry ? data.monthlySales : data.totalSales)}
              {(isIndustry ? data.monthlySales : data.totalSales) != null && <span className="text-sm font-normal text-gray-500">원</span>}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-sm font-semibold text-gray-700">일평균 생활인구</p>
            <p className="text-base font-bold text-gray-900">{fmtPop(data.population)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-sm font-semibold text-gray-700">분기 유동인구</p>
            <p className="text-base font-bold text-gray-900">{fmtPop(data.flowPopulation)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-sm font-semibold text-gray-700">{isIndustry ? '업종 내 점포' : '총 점포 수'}</p>
            <p className="text-base font-bold text-gray-900">
              {fmtCnt(isIndustry ? data.storeCount : data.totalStores)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-sm font-semibold text-gray-700">월 소비지출</p>
            <p className="text-base font-bold text-gray-900">
              {fmtAmt(data.consumptionAmt)}
              {data.consumptionAmt != null && <span className="text-sm font-normal text-gray-500">원</span>}
            </p>
          </div>
        </div>
      </div>

      {/* 경쟁 분석 (업종 선택 시) */}
      {isIndustry && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">경쟁 분석</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">유사업종 점포</span>
              <span className="font-medium">{fmtCnt(data.similarStores)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">개업률</span>
              <span className="font-medium text-green-600">{fmtRate(data.openRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">폐업률</span>
              <span className="font-medium text-red-500">{fmtRate(data.closeRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">프랜차이즈 비율</span>
              <span className="font-medium">{fmtRate(data.franchiseRate)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 요일별 패턴 */}
      {data.weekdaySales && data.weekendSales && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">요일별 매출</p>
          <DonutChart
            labels={['월', '화', '수', '목', '금', '토', '일']}
            values={[...data.weekdaySales, ...data.weekendSales]}
          />
        </div>
      )}

      {/* 시간대별 패턴 */}
      {data.timeSales && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">시간대별 매출</p>
          <BarChart
            labels={['0시', '6시', '11시', '14시', '17시', '21시']}
            values={data.timeSales}
            color={barColor}
          />
        </div>
      )}

      {/* 고객 분석 */}
      {(data.malePct != null || data.agePct) && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">고객 분석</p>
          {data.malePct != null && (
            <div className="mb-2">
              <p className="text-sm text-gray-700 mb-1">성별 분포</p>
              <GenderBar malePct={data.malePct} femalePct={data.femalePct} />
            </div>
          )}
          {data.agePct && (
            <div>
              <p className="text-sm text-gray-700 mb-1">연령대 분포</p>
              <BarChart
                labels={['10대', '20대', '30대', '40대', '50대', '60+']}
                values={data.agePct}
                color={barColor}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 비교 모드 패널 ─────────────────────────────────────────────────────────────
function CompareAnalysis({ dataA, dataB }: { dataA: DistrictData | null; dataB: DistrictData | null }) {
  type Dir = 'high' | 'low'
  const cmp = (a: number | null, b: number | null, dir: Dir) => {
    if (a == null || b == null) return { a: '', b: '' }
    const aBetter = dir === 'high' ? a > b : a < b
    const bBetter = dir === 'high' ? b > a : b < a
    return {
      a: aBetter ? 'text-blue-600 font-semibold' : bBetter ? 'text-gray-400' : '',
      b: bBetter ? 'text-red-600 font-semibold' : aBetter ? 'text-gray-400' : '',
    }
  }

  const isIndustry = !!(dataA?.industryName || dataB?.industryName)

  const rows: { label: string; aVal: string; bVal: string; dir: Dir }[] = isIndustry ? [
    { label: '월매출', aVal: `${fmtAmt(dataA?.monthlySales ?? null)}원`, bVal: `${fmtAmt(dataB?.monthlySales ?? null)}원`, dir: 'high' },
    { label: '생활인구', aVal: fmtPop(dataA?.population ?? null), bVal: fmtPop(dataB?.population ?? null), dir: 'high' },
    { label: '유동인구', aVal: fmtPop(dataA?.flowPopulation ?? null), bVal: fmtPop(dataB?.flowPopulation ?? null), dir: 'high' },
    { label: '업종 점포', aVal: fmtCnt(dataA?.storeCount ?? null), bVal: fmtCnt(dataB?.storeCount ?? null), dir: 'low' },
    { label: '유사업종', aVal: fmtCnt(dataA?.similarStores ?? null), bVal: fmtCnt(dataB?.similarStores ?? null), dir: 'low' },
    { label: '개업률', aVal: fmtRate(dataA?.openRate ?? null), bVal: fmtRate(dataB?.openRate ?? null), dir: 'high' },
    { label: '폐업률', aVal: fmtRate(dataA?.closeRate ?? null), bVal: fmtRate(dataB?.closeRate ?? null), dir: 'low' },
    { label: '프랜차이즈', aVal: fmtRate(dataA?.franchiseRate ?? null), bVal: fmtRate(dataB?.franchiseRate ?? null), dir: 'low' },
    { label: '소비지출', aVal: `${fmtAmt(dataA?.consumptionAmt ?? null)}원`, bVal: `${fmtAmt(dataB?.consumptionAmt ?? null)}원`, dir: 'high' },
  ] : [
    { label: '총 월매출', aVal: `${fmtAmt(dataA?.totalSales ?? null)}원`, bVal: `${fmtAmt(dataB?.totalSales ?? null)}원`, dir: 'high' },
    { label: '생활인구', aVal: fmtPop(dataA?.population ?? null), bVal: fmtPop(dataB?.population ?? null), dir: 'high' },
    { label: '유동인구', aVal: fmtPop(dataA?.flowPopulation ?? null), bVal: fmtPop(dataB?.flowPopulation ?? null), dir: 'high' },
    { label: '총 점포', aVal: fmtCnt(dataA?.totalStores ?? null), bVal: fmtCnt(dataB?.totalStores ?? null), dir: 'low' },
    { label: '소비지출', aVal: `${fmtAmt(dataA?.consumptionAmt ?? null)}원`, bVal: `${fmtAmt(dataB?.consumptionAmt ?? null)}원`, dir: 'high' },
  ]

  return (
    <div className="px-5 py-4 space-y-4">
      {/* 비교 표 */}
      <div>
        <div className="grid grid-cols-[1fr_auto_1fr] text-center pb-1.5 border-b border-gray-100">
          <span className="text-sm font-bold text-blue-600">A지역</span>
          <span className="text-sm text-gray-400 px-2">지표</span>
          <span className="text-sm font-bold text-red-600">B지역</span>
        </div>
        {rows.map(({ label, aVal, bVal, dir }) => {
          // 실제 숫자 추출 (비교용)
          const getNum = (d: DistrictData | null, lbl: string) => {
            if (!d) return null
            const map: Record<string, number | null> = {
              '월매출': d.monthlySales, '총 월매출': d.totalSales,
              '생활인구': d.population, '유동인구': d.flowPopulation, '업종 점포': d.storeCount,
              '총 점포': d.totalStores, '유사업종': d.similarStores,
              '개업률': d.openRate, '폐업률': d.closeRate,
              '프랜차이즈': d.franchiseRate, '소비지출': d.consumptionAmt,
            }
            return map[lbl] ?? null
          }
          const c = cmp(getNum(dataA, label), getNum(dataB, label), dir)
          return (
            <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5 border-b border-gray-50">
              <span className={`text-base text-right pr-2 ${c.a}`}>{aVal}</span>
              <span className="text-sm text-gray-600 text-center whitespace-nowrap">{label}</span>
              <span className={`text-base text-left pl-2 ${c.b}`}>{bVal}</span>
            </div>
          )
        })}
      </div>

      {/* 요일 패턴 비교 (업종 선택 시) */}
      {isIndustry && (dataA?.weekdaySales || dataB?.weekdaySales) && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">요일별 매출</p>
          {dataA?.weekdaySales && dataA.weekendSales && (
            <div className="mb-3">
              <p className="text-[10px] text-blue-500 mb-1">A지역</p>
              <DonutChart labels={['월','화','수','목','금','토','일']}
                values={[...dataA.weekdaySales, ...dataA.weekendSales]} />
            </div>
          )}
          {dataB?.weekdaySales && dataB.weekendSales && (
            <div>
              <p className="text-[10px] text-red-500 mb-1">B지역</p>
              <DonutChart labels={['월','화','수','목','금','토','일']}
                values={[...dataB.weekdaySales, ...dataB.weekendSales]} />
            </div>
          )}
        </div>
      )}

      {/* 고객 분석 비교 (업종 선택 시) */}
      {isIndustry && (dataA?.malePct != null || dataB?.malePct != null) && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">고객 분석</p>
          {dataA?.malePct != null && (
            <div className="mb-1.5">
              <p className="text-[10px] text-blue-500 mb-1">A 지역 성별</p>
              <GenderBar malePct={dataA.malePct} femalePct={dataA.femalePct} />
            </div>
          )}
          {dataB?.malePct != null && (
            <div>
              <p className="text-[10px] text-red-500 mb-1">B 지역 성별</p>
              <GenderBar malePct={dataB.malePct} femalePct={dataB.femalePct} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
type CompareSummary = {
  recommendation: string
  sections: { title: string; content: string }[]
}

export default function ComparePage() {
  const [markers, setMarkers] = useState<MarkerInfo[]>([])
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [dataMap, setDataMap] = useState<Record<'A' | 'B', DistrictData | null>>({ A: null, B: null })
  const [loadingMap, setLoadingMap] = useState<Record<'A' | 'B', boolean>>({ A: false, B: false })
  const [aiComment, setAiComment] = useState<CompareSummary | null>(null)
  const [commentLoading, setCommentLoading] = useState(false)
  const fetchCache = useRef(new Map<string, DistrictData>())
  const mapRef = useRef<KakaoMapHandle>(null)

  const panelState = markers.length === 0 ? 'idle' : markers.length === 1 ? 'single' : 'comparing'

  // 마커 변경 또는 업종 변경 시 데이터 로드
  useEffect(() => {
    for (const marker of markers) {
      const cacheKey = `${marker.adstrdCd}:${selectedIndustry}`
      const cached = fetchCache.current.get(cacheKey)
      if (cached) {
        setDataMap(prev => {
          const label = marker.label as 'A' | 'B'
          const existing = prev[label]
          const merged = selectedIndustry && existing?.topIndustries?.length
            ? { ...cached, topIndustries: existing.topIndustries }
            : cached
          return { ...prev, [label]: merged }
        })
        continue
      }
      setLoadingMap(prev => ({ ...prev, [marker.label]: true }))
      const url = `/api/district?adstrdCd=${marker.adstrdCd}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}`
      fetch(url)
        .then(r => r.json())
        .then((data: DistrictData) => {
          fetchCache.current.set(cacheKey, data)
          setDataMap(prev => {
            const label = marker.label as 'A' | 'B'
            const existing = prev[label]
            // 업종별 응답은 topIndustries: []로 오므로, 이전 일반 데이터의 topIndustries 보존
            const merged = selectedIndustry && existing?.topIndustries?.length
              ? { ...data, topIndustries: existing.topIndustries }
              : data
            return { ...prev, [label]: merged }
          })
        })
        .catch(() => {})
        .finally(() => setLoadingMap(prev => ({ ...prev, [marker.label]: false })))
    }
  }, [markers, selectedIndustry])

  function handleReset() {
    mapRef.current?.reset()
    setMarkers([])
    setDataMap({ A: null, B: null })
    setLoadingMap({ A: false, B: false })
    setSelectedIndustry('')
    setAiComment(null)
    setCommentLoading(false)
    fetchCache.current.clear()
  }

  function handleIndustryChange(code: string) {
    setSelectedIndustry(code)
    setAiComment(null)
    setCommentLoading(false)
  }

  // 업종 칩에 표시할 산업 목록 (A의 전체 집계 데이터에서 추출)
  const topIndustries: IndustryItem[] =
    (dataMap.A?.topIndustries ?? dataMap.B?.topIndustries ?? [])

  const selectedIndustryName = selectedIndustry
    ? (topIndustries.find(i => i.code === selectedIndustry)?.name ?? '선택 업종')
    : '전체 상권'

  // A·B 모두 로드 완료 시 AI 분석 자동 호출
  useEffect(() => {
    if (!dataMap.A || !dataMap.B || loadingMap.A || loadingMap.B || markers.length < 2) return

    setCommentLoading(true)
    setAiComment(null)
    fetch('/api/compare-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        a: { ...dataMap.A, guName: markers[0].guName, dongName: markers[0].dongName },
        b: { ...dataMap.B, guName: markers[1].guName, dongName: markers[1].dongName },
        industryName: selectedIndustryName,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: CompareSummary | null) => { if (data?.sections) setAiComment(data) })
      .catch(() => {})
      .finally(() => setCommentLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMap.A, dataMap.B, loadingMap.A, loadingMap.B])

  const isLoading = loadingMap.A || loadingMap.B

  const simulatorHref = markers.length >= 1
    ? `/simulator?lat=${markers[0].lat}&lng=${markers[0].lng}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}`
    : '/simulator'

  const chatHref = markers.length >= 1
    ? `/chat?lat=${markers[0].lat}&lng=${markers[0].lng}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}`
    : '/chat'

  const navLinks = (
    <div className="flex gap-2">
      <Link href={simulatorHref}
        className="flex-1 text-center py-2 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity" style={{ background: "#f97316" }}>
        창업 시뮬레이터
      </Link>
      <Link href={chatHref}
        className="flex-1 text-center py-2 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
        AI 상담
      </Link>
    </div>
  )

  return (
    <main className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ background: "#daeaf1" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← 시작페이지로</Link>
          <h1 className="text-lg font-bold text-slate-700"> 창업 입지 비교 분석</h1>
        </div>
        <p className="text-sm text-slate-500">
          {panelState === 'idle' && '지도에서 분석할 지역을 선택하세요'}
          {panelState === 'single' && 'B지역을 추가하면 두 지역을 비교할 수 있어요'}
          {panelState === 'comparing' && 'A·B 두 지역 비교'}
        </p>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* 지도 */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <KakaoMap ref={mapRef} onMarkersChange={setMarkers} />
        </div>

        {/* 분석 패널 */}
        <div className="w-[40rem] border-l flex flex-col bg-white shrink-0">

          {/* idle */}
          {panelState === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="mb-6 text-slate-300"><Search size={80} strokeWidth={1.2} /></div>
              <p className="text-xl font-semibold text-gray-700">지역을 선택하세요</p>
              <p className="text-base text-gray-400 mt-3 leading-relaxed">
                지도를 클릭하면 해당 지역의 상권을 분석합니다.<br />두 곳을 선택하면 비교 분석이 가능합니다.
              </p>
            </div>
          )}

          {/* single / comparing */}
          {panelState !== 'idle' && (
            <div className="flex flex-col h-full">
              {/* 지역 헤더 */}
              <div className="px-5 py-3 border-b shrink-0">
                {panelState === 'single' ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">A지역</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {markers[0].guName} {markers[0].dongName}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div>
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">A</span>
                      <span className="text-xs text-gray-700 ml-1.5">{markers[0].dongName}</span>
                    </div>
                    <span className="text-gray-300 text-sm">vs</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-700 mr-1.5">{markers[1].dongName}</span>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">B</span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">2025년 4분기 기준</p>
              </div>

              {/* 업종 선택기 (데이터 로드 후 표시) */}
              {topIndustries.length > 0 && (
                <div className="px-5 py-2.5 border-b shrink-0">
                  <IndustrySelector
                    industries={topIndustries}
                    selected={selectedIndustry}
                    onChange={handleIndustryChange}
                  />
                </div>
              )}

              {/* 업종 선택 시 뒤로가기 버튼 */}
              {selectedIndustry && !isLoading && (
                <div className="px-5 pt-3 shrink-0">
                  <button
                    onClick={() => setSelectedIndustry('')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
                  >
                    <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                    <span>전체 상권으로 돌아가기</span>
                  </button>
                </div>
              )}

              {/* 분석 내용 (스크롤) */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-sm text-gray-400 animate-pulse">
                      {topIndustries.length === 0 ? '데이터 캐싱 중... (최초 30초 소요)' : '분석 중...'}
                    </p>
                  </div>
                ) : panelState === 'single' ? (
                  dataMap.A ? (
                    <SingleAnalysis data={dataMap.A} label="A" />
                  ) : (
                    <div className="flex items-center justify-center h-40">
                      <p className="text-sm text-gray-400">데이터를 불러올 수 없습니다</p>
                    </div>
                  )
                ) : (
                  <>
                    <CompareAnalysis dataA={dataMap.A} dataB={dataMap.B} />

                    {/* AI 심층 분석 섹션 */}
                    {(commentLoading || aiComment) && (
                      <div className="px-5 py-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-sm font-bold text-gray-700">AI 분석</p>
                          {!commentLoading && aiComment && (
                            <span className="rounded px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "#f97316" }}>AI 생성</span>
                          )}
                          {commentLoading && (
                            <span className="text-[10px] text-[#f97316] animate-pulse">분석 중…</span>
                          )}
                        </div>

                        {commentLoading ? (
                          <div className="space-y-3">
                            {[0, 1, 2, 3].map(i => (
                              <div key={i} className="animate-pulse space-y-1.5">
                                <div className="h-3 w-24 rounded bg-gray-100" />
                                <div className="h-4 w-full rounded bg-gray-100" />
                                <div className="h-4 w-5/6 rounded bg-gray-100" />
                              </div>
                            ))}
                          </div>
                        ) : aiComment && (
                          <div className="space-y-4">
                            {/* 추천 결론 */}
                            <div className="rounded-lg px-3 py-2.5" style={{ background: "#fff7ed" }}>
                              <p className="text-sm font-bold" style={{ color: "#c2410c" }}>✦ {aiComment.recommendation}</p>
                            </div>

                            {/* 섹션별 분석 */}
                            {aiComment.sections.map((section) => (
                              <div key={section.title}>
                                <p className="text-sm font-semibold text-gray-700 mb-1">{section.title}</p>
                                <p className="text-sm font-medium leading-6 text-gray-700">{section.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="p-4 border-t space-y-2 shrink-0">
                {panelState === 'single' && (
                  <p className="text-xs text-gray-400">B지역을 추가하면 비교 분석이 가능합니다</p>
                )}
                {navLinks}
                <button onClick={handleReset}
                  className="w-full py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  초기화
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
