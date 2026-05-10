export interface MarkerInfo {
  lat: number
  lng: number
  label: 'A' | 'B'
  dongName: string
  guName: string
  adstrdCd: string  // Kakao 'H' type 10자리
}

export interface IndustryItem {
  code: string
  name: string
  sales: number
  stores: number
}

export interface DistrictData {
  // 공통
  population: number | null
  flowPopulation: number | null
  flowByDay: number[] | null        // [월,화,수,목,금,토,일]
  flowByTime: number[] | null       // [00-06,06-11,11-14,14-17,17-21,21-24]
  flowMalePct: number | null
  flowFemalePct: number | null
  flowAgePct: number[] | null       // [10대,20대,30대,40대,50대,60+]
  consumptionAmt: number | null
  // 전체 집계 모드
  totalSales: number | null
  totalStores: number | null
  topIndustries: IndustryItem[]
  // 업종 선택 모드 (industry 파라미터 지정 시)
  industryName: string | null
  monthlySales: number | null
  storeCount: number | null
  similarStores: number | null
  openRate: number | null
  closeRate: number | null
  franchiseRate: number | null
  weekdaySales: number[] | null   // [월,화,수,목,금]
  weekendSales: number[] | null   // [토,일]
  timeSales: number[] | null      // [00-06,06-11,11-14,14-17,17-21,21-24]
  malePct: number | null
  femalePct: number | null
  agePct: number[] | null         // [10대,20대,30대,40대,50대,60+]
}
