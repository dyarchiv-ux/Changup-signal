'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import KakaoMap, { type KakaoMapHandle } from '@/components/KakaoMap'
import type { DistrictData, MarkerInfo } from '@/types/map'

// ── 포맷 유틸 ────────────────────────────────────────────────────────────────
const fmtAmt = (n: number | null) => {
  if (n == null) return '-'
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`
  return n.toLocaleString()
}
const fmtPop  = (n: number | null) => n == null ? '-' : `${Math.round(n).toLocaleString()}명`
const fmtRate = (n: number | null) => n == null ? '-' : `${n.toFixed(1)}%`

// ── 타입 ─────────────────────────────────────────────────────────────────────
type Message = { id: string; role: 'user' | 'assistant'; content: string }

const QUICK_QUESTIONS_BASE = ['이 상권 특징이 뭔가요?', '주요 업종은 뭔가요?']
const QUICK_QUESTIONS_INDUSTRY = [
  '이 업종, 경쟁이 심한가요?',
  '주요 고객층은 어떻게 되나요?',
  '매출이 높은 시간대는 언제인가요?',
  '어떤 금융 지원을 받을 수 있나요?',
]

// ── 업종 드롭다운 ─────────────────────────────────────────────────────────────
function IndustrySelect({ industries, value, onChange, disabled }: {
  industries: { code: string; name: string }[]
  value: string
  onChange: (code: string) => void
  disabled: boolean
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="">전체 상권</option>
      {industries.map(i => (
        <option key={i.code} value={i.code}>{i.name}</option>
      ))}
    </select>
  )
}

// ── 메시지 버블 ───────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-1 h-14 w-14 shrink-0 rounded-full overflow-hidden bg-white border border-gray-200">
          <Image src="/ai-marker.png" alt="AI" width={56} height={56} className="object-contain translate-y-2" />
        </div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
        isUser
          ? 'bg-gray-800 text-white rounded-br-sm'
          : 'bg-white border border-gray-200 text-gray-900 font-medium rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
function ChatPageInner() {
  const searchParams = useSearchParams()
  const initLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
  const initLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
  const initIndustryRef = useRef(searchParams.get('industry') ?? '')

  const mapRef = useRef<KakaoMapHandle>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [markers, setMarkers] = useState<MarkerInfo[]>([])
  const [district, setDistrict] = useState<DistrictData | null>(null)
  const [districtLoading, setDistrictLoading] = useState(false)
  const [selectedIndustryCode, setSelectedIndustryCode] = useState('')
  const [industryData, setIndustryData] = useState<DistrictData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ address: string; lat: number; lng: number }[]>([])
  const [showResults, setShowResults] = useState(false)

  const marker = markers[0] ?? null
  const industries = district?.topIndustries ?? []
  const activeData = industryData ?? district
  const selectedIndustry = industries.find(i => i.code === selectedIndustryCode) ?? null

  // URL 파라미터로 전달된 위치를 지도가 준비되는 즉시 마커로 배치
  useEffect(() => {
    if (!initLat || !initLng || markers.length > 0) return
    const interval = setInterval(() => {
      mapRef.current?.setMarker(initLat, initLng)
    }, 300)
    return () => clearInterval(interval)
  }, [initLat, initLng, markers.length])

  // 외부 클릭 시 검색 드롭다운 닫기
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node))
        setShowResults(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // 검색어 디바운스 처리
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

  // 위치 선택 시 상권 데이터 로드
  useEffect(() => {
    if (!marker?.adstrdCd) return
    setDistrictLoading(true)
    setDistrict(null)
    setIndustryData(null)
    setSelectedIndustryCode('')
    setMessages([])
    fetch(`/api/district?adstrdCd=${marker.adstrdCd}`)
      .then(r => r.json())
      .then((data: DistrictData) => {
        setDistrict(data)
        const preferred = initIndustryRef.current && data.topIndustries.some((i) => i.code === initIndustryRef.current)
          ? initIndustryRef.current
          : (data.topIndustries[0]?.code ?? '')
        initIndustryRef.current = ''
        if (preferred) setSelectedIndustryCode(preferred)
      })
      .catch(() => {})
      .finally(() => setDistrictLoading(false))
  }, [marker])

  // 업종 변경 시 업종별 데이터 로드
  useEffect(() => {
    if (!marker?.adstrdCd || !selectedIndustryCode) {
      setIndustryData(null)
      return
    }
    fetch(`/api/district?adstrdCd=${marker.adstrdCd}&industry=${selectedIndustryCode}`)
      .then(r => r.json())
      .then((data: DistrictData) => setIndustryData(data))
      .catch(() => {})
  }, [marker, selectedIndustryCode])

  // 위치+업종 준비되면 웰컴 메시지 자동 트리거
  useEffect(() => {
    if (!marker || !district || messages.length > 0 || districtLoading) return
    const industryName = selectedIndustry?.name ?? null
    const firstQ = industryName
      ? `${marker.guName} ${marker.dongName}에서 ${industryName} 창업에 대해 분석해줘.`
      : `${marker.guName} ${marker.dongName} 상권을 분석해줘.`
    sendMessage(firstQ)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, selectedIndustry])

  // 메시지 추가 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleMarkersChange(next: MarkerInfo[]) {
    setMarkers(next)
    if (next.length === 0) {
      setDistrict(null)
      setIndustryData(null)
      setSelectedIndustryCode('')
      setMessages([])
    }
  }

  function handleIndustryChange(code: string) {
    setSelectedIndustryCode(code)
    setMessages([])
    setIndustryData(null)
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
    setMessages([])
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const aiMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, aiMsg])
    setInput('')
    setStreaming(true)

    const historyForApi = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
    const context = marker && activeData ? {
      guName: marker.guName,
      dongName: marker.dongName,
      industryName: selectedIndustry?.name ?? null,
      district: activeData,
    } : null

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, context }),
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`${res.status}: ${errBody}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        // OpenAI SSE 파싱: "data: {...}\n\n" 형태
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
            if (delta) {
              setMessages(prev =>
                prev.map(m => m.id === aiMsg.id ? { ...m, content: m.content + delta } : m)
              )
            }
          } catch { /* JSON 파싱 실패 무시 */ }
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setMessages(prev =>
        prev.map(m => m.id === aiMsg.id ? { ...m, content: `오류: ${detail}` } : m)
      )
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickQuestions = selectedIndustry ? QUICK_QUESTIONS_INDUSTRY : QUICK_QUESTIONS_BASE

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ background: "#daeaf1" }}>
        <div className="flex items-center gap-4">
          <Link href="/compare" className="text-sm text-slate-500 hover:text-slate-700">← 상권 비교</Link>
          <h1 className="text-lg font-bold text-slate-700">AI 상담</h1>
        </div>
        <p className="text-sm text-slate-500">창업 전문 AI가 상담해드립니다</p>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* 사이드바 */}
        <aside className="w-[28rem] border-r bg-white flex flex-col shrink-0">
          {/* 지도 */}
          <div className="relative h-96 border-b shrink-0">
            <KakaoMap ref={mapRef} maxMarkers={1} onMarkersChange={handleMarkersChange} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 위치 */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">위치</h2>
                {marker && (
                  <button onClick={resetLocation} className="text-xs text-gray-400 hover:text-gray-700">
                    다시 선택
                  </button>
                )}
              </div>

              {/* 검색 박스 */}
              <div ref={searchWrapRef} className="relative">
                <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-rose-400">
                  <span className="text-gray-400 text-sm mr-2">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
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

              {/* 선택된 위치 표시 */}
              {marker ? (
                <div className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800 font-semibold">
                  {marker.guName} {marker.dongName}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-400 text-center">또는 지도를 직접 클릭해 선택</p>
              )}
            </section>

            {/* 업종 */}
            {district && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">업종</h2>
                <IndustrySelect
                  industries={industries}
                  value={selectedIndustryCode}
                  onChange={handleIndustryChange}
                  disabled={districtLoading}
                />
              </section>
            )}

            {/* 상권 요약 */}
            {districtLoading && (
              <p className="text-sm text-gray-400 animate-pulse text-center py-4">
                데이터 불러오는 중... (최초 30초 소요)
              </p>
            )}

            {activeData && !districtLoading && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">상권 요약</h2>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['생활인구', fmtPop(activeData.population)],
                    ['유동인구', fmtPop(activeData.flowPopulation)],
                    ['월 소비지출', `${fmtAmt(activeData.consumptionAmt)}원`],
                    ...(selectedIndustry ? [
                      ['월매출', `${fmtAmt(activeData.monthlySales)}원`],
                      ['점포 수', `${activeData.storeCount?.toLocaleString() ?? '-'}개`],
                      ['개업률', fmtRate(activeData.openRate)],
                      ['폐업률', fmtRate(activeData.closeRate)],
                      ['프랜차이즈', fmtRate(activeData.franchiseRate)],
                    ] : [
                      ['전체 월매출', `${fmtAmt(activeData.totalSales)}원`],
                      ['전체 점포', `${activeData.totalStores?.toLocaleString() ?? '-'}개`],
                    ]),
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* 채팅 영역 */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {messages.length === 0 && !districtLoading && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-4xl font-black text-gray-100">AI</p>
                  <p className="mt-3 text-gray-500 font-semibold">
                    {marker ? '데이터를 불러오는 중입니다...' : '왼쪽 지도에서 창업 후보 위치를 선택하세요'}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    위치와 업종을 선택하면 AI가 자동으로 상권을 분석해드립니다
                  </p>
                </div>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {streaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 h-7 w-7 shrink-0 rounded-full overflow-hidden bg-white border border-gray-200">
                  <Image src="/ai-marker.png" alt="AI" width={28} height={28} className="object-contain" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 빠른 질문 + 입력창 */}
          <div className="border-t bg-white px-6 py-4 space-y-3 shrink-0">
            {/* 빠른 질문 칩 */}
            {messages.length > 0 && !streaming && (
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 입력창 */}
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={marker ? '궁금한 점을 입력하세요' : '위치를 먼저 선택해주세요'}
                disabled={!marker || streaming || districtLoading}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-400 disabled:bg-gray-50 disabled:text-gray-400 leading-5"
                style={{ maxHeight: 120 }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || !marker || streaming || districtLoading}
                className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-200 transition-colors"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">로딩 중...</div>}>
      <ChatPageInner />
    </Suspense>
  )
}
