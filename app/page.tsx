import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import HomeNav from "@/components/HomeNav";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  async function signOut() {
    "use server";
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return (
    <main
      className="relative flex flex-col items-center justify-center min-h-screen p-8 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f1f7f8, #abc6db)" }}
    >
      <HomeNav isLoggedIn={!!user} />

      {/* 상단 로그인 버튼 */}
      <div className="absolute top-5 right-6 z-20 flex items-center gap-3">
        {user ? (
          <>
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/80 border border-slate-200 rounded-xl shadow-sm backdrop-blur-sm">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
              >
                {user.email?.[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700">{user.email}</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="px-5 py-2 text-base font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors"
              >
                로그아웃
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="px-5 py-2 text-base font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-5 py-2 text-base font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors"
            >
              회원가입
            </Link>
          </>
        )}
      </div>

      <Image
        src="/building.png"
        alt=""
        width={600}
        height={600}
        className="absolute left-0 -bottom-24 w-[46%] min-w-[320px] max-w-[600px] object-contain pointer-events-none select-none"
        style={{ mixBlendMode: "multiply", opacity: 0.88 }}
        priority
      />
      <Image
        src="/map.png"
        alt=""
        width={600}
        height={600}
        className="absolute right-[2%] -bottom-8 w-[44%] min-w-[320px] max-w-[580px] object-contain pointer-events-none select-none"
        style={{ mixBlendMode: "multiply", opacity: 0.88 }}
        priority
      />

      <div className="relative z-10 text-center max-w-2xl">
        <div className="flex justify-center mb-2">
          <Image src="/logo_nobg.png" alt="창업시그널 로고" width={480} height={300} priority />
        </div>

        <p className="mt-4 text-xl text-slate-600">
          서울시 상권 데이터 기반 창업 입지 분석 서비스
        </p>
        <p className="mt-2 text-lg text-slate-400">
          지역을 선택하면 매출·유동인구·업종 분석과 금융지원 매칭까지 한번에
        </p>

        <Link
          href="/compare"
          className="mt-8 inline-block px-12 py-4 text-xl text-white font-semibold rounded-xl transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
        >
          상권 분석 시작하기 →
        </Link>
      </div>
    </main>
  );
}
