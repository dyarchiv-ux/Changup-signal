'use client'

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import type { MarkerInfo } from '@/types/map'

type KakaoLatLng = {
  getLat: () => number
  getLng: () => number
}

type KakaoMapInstance = object

type KakaoMarker = {
  setMap: (map: KakaoMapInstance | null) => void
}

type KakaoOverlay = {
  setMap: (map: KakaoMapInstance | null) => void
}

type KakaoRegion = {
  region_type: string
  region_3depth_name?: string
  region_2depth_name?: string
  code?: string
}

type KakaoAddressResult = {
  address_name: string
  x: string  // longitude
  y: string  // latitude
}

type KakaoGeocoder = {
  coord2RegionCode: (
    lng: number,
    lat: number,
    callback: (result: KakaoRegion[], status: string) => void
  ) => void
  addressSearch: (
    query: string,
    callback: (result: KakaoAddressResult[], status: string) => void
  ) => void
}

type KakaoClickEvent = {
  latLng: KakaoLatLng
}

type KakaoMaps = {
  load: (callback: () => void) => void
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Marker: new (options: { position: KakaoLatLng; map: KakaoMapInstance }) => KakaoMarker
  CustomOverlay: new (options: { position: KakaoLatLng; content: string; yAnchor: number }) => KakaoOverlay
  services: { Geocoder: new () => KakaoGeocoder }
  event: {
    addListener: (target: KakaoMapInstance, type: 'click', callback: (event: KakaoClickEvent) => void) => void
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

export interface KakaoMapHandle {
  reset: () => void
  setMarker: (lat: number, lng: number) => void
  searchAddress: (query: string) => Promise<{ address: string; lat: number; lng: number }[]>
}

interface Props {
  onMarkersChange: (markers: MarkerInfo[]) => void
  maxMarkers?: 1 | 2
}

const KakaoMap = forwardRef<KakaoMapHandle, Props>(function KakaoMap(
  { onMarkersChange, maxMarkers = 2 },
  ref
) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const markersDataRef = useRef<MarkerInfo[]>([])
  const kakaoObjectsRef = useRef<{ marker: KakaoMarker; overlay: KakaoOverlay }[]>([])
  const callbackRef    = useRef(onMarkersChange)
  const maxMarkersRef  = useRef(maxMarkers)
  const geocoderRef    = useRef<KakaoGeocoder | null>(null)
  const addMarkerAtRef = useRef<((lat: number, lng: number) => void) | null>(null)
  const initializedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { callbackRef.current = onMarkersChange })
  useEffect(() => { maxMarkersRef.current = maxMarkers })

  useImperativeHandle(ref, () => ({
    reset() {
      kakaoObjectsRef.current.forEach(({ marker, overlay }) => {
        marker.setMap(null)
        overlay.setMap(null)
      })
      kakaoObjectsRef.current = []
      markersDataRef.current = []
      callbackRef.current([])
    },
    setMarker(lat: number, lng: number) {
      addMarkerAtRef.current?.(lat, lng)
    },
    searchAddress(query: string) {
      return new Promise((resolve) => {
        const geocoder = geocoderRef.current
        if (!geocoder) { resolve([]); return }
        geocoder.addressSearch(query, (result, status) => {
          if (status !== 'OK') { resolve([]); return }
          resolve(result.slice(0, 5).map(r => ({
            address: r.address_name,
            lat: Number(r.y),
            lng: Number(r.x),
          })))
        })
      })
    },
  }))

  const setupMap = useCallback(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const { maps } = window.kakao!
    const map = new maps.Map(containerRef.current, {
      center: new maps.LatLng(37.5665, 126.978),
      level: 8,
    })
    const geocoder = new maps.services.Geocoder()
    geocoderRef.current = geocoder

    setStatus('ready')

    // 마커 추가 공통 함수 (클릭 & setMarker 공유)
    addMarkerAtRef.current = (lat: number, lng: number) => {
      if (markersDataRef.current.length >= maxMarkersRef.current) return
      const label = markersDataRef.current.length === 0 ? 'A' : 'B'

      geocoder.coord2RegionCode(lng, lat, (result) => {
        const dongInfo = result?.find(r => r.region_type === 'H')
        const info: MarkerInfo = {
          lat, lng, label,
          dongName: dongInfo?.region_3depth_name ?? '',
          guName:   dongInfo?.region_2depth_name ?? '',
          adstrdCd: dongInfo?.code ?? '',
        }

        const pos = new maps.LatLng(info.lat, info.lng)
        const marker = new maps.Marker({ position: pos, map })
        const color = label === 'A' ? '#2563EB' : '#DC2626'
        const overlayLabel = maxMarkersRef.current === 1 ? '선택 위치' : `${label}지역`
        const overlay = new maps.CustomOverlay({
          position: pos,
          content: `<span style="background:${color};color:#fff;padding:2px 10px;border-radius:4px;font:bold 13px/1.6 sans-serif;white-space:nowrap;">${overlayLabel}</span>`,
          yAnchor: 2.8,
        })
        overlay.setMap(map)

        kakaoObjectsRef.current.push({ marker, overlay })
        markersDataRef.current = [...markersDataRef.current, info]
        callbackRef.current(markersDataRef.current)
      })
    }

    maps.event.addListener(map, 'click', (e) => {
      addMarkerAtRef.current?.(e.latLng.getLat(), e.latLng.getLng())
    })
  }, [])

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

    if (!apiKey) {
      setStatus('error')
      setErrorMsg('NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수 없음 — dev 서버를 재시작하세요')
      return
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(setupMap)
      return
    }

    if (document.querySelector('script[src*="dapi.kakao.com"]')) return

    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`
    script.async = true
    script.onload = () => window.kakao?.maps.load(setupMap)
    script.onerror = () => {
      setStatus('error')
      setErrorMsg('카카오맵 스크립트 로드 실패 — 콘솔(F12)을 확인하세요')
    }
    document.head.appendChild(script)
  }, [setupMap])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f3f4f6',
        }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>지도 불러오는 중...</span>
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#fef2f2', gap: 8,
        }}>
          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>지도 로드 실패</span>
          <span style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>{errorMsg}</span>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
})

export default KakaoMap
