import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-2">
          <Image src="/logo.png" alt="창업시그널 로고" width={320} height={200} priority />
        </div>

        <p className="mt-4 text-base text-slate-600">
          서울시 상권 데이터 기반 창업 입지 분석 서비스
        </p>
        <p className="mt-2 text-sm text-slate-400">
          지역을 선택하면 매출·유동인구·업종 분석과 금융지원 매칭까지 한번에
        </p>

        <Link
          href="/compare"
          className="mt-8 inline-block px-8 py-3 text-white font-semibold rounded-xl transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563eb, #0d9488)" }}
        >
          상권 분석 시작하기 →
        </Link>
      </div>
    </main>
  );
}
