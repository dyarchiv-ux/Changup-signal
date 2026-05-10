import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeNav from "@/components/HomeNav";
import StartButton from "@/components/StartButton";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  async function signOut() {
    "use server";
    const { createClient } = await import("@/lib/supabase/server");
    const { redirect } = await import("next/navigation");
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    <main
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden px-5 py-8 sm:p-8"
      style={{ background: "linear-gradient(135deg, #f1f7f8, #abc6db)" }}
    >
      <HomeNav />

      {/* 상단 로그인 버튼 */}
      <div className="absolute left-3 right-3 top-16 z-20 flex max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2 sm:left-auto sm:right-6 sm:top-5 sm:max-w-none sm:justify-end sm:gap-3">
        {user ? (
          <>
            <div className="flex min-w-0 items-center gap-2 px-3 py-1.5 bg-white/80 border border-slate-200 rounded-xl shadow-sm backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
              >
                {user.email?.[0].toUpperCase()}
              </div>
              <span className="truncate text-xs font-medium text-slate-700 sm:text-sm">{user.email}</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors sm:px-5 sm:py-2 sm:text-base"
              >
                로그아웃
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors sm:px-5 sm:py-2 sm:text-base"
            >
              로그인
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white/70 border border-slate-300 rounded-lg hover:bg-white transition-colors sm:px-5 sm:py-2 sm:text-base"
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
        className="absolute left-0 -bottom-24 w-[72%] min-w-[220px] max-w-[600px] object-contain opacity-45 pointer-events-none select-none sm:-bottom-24 sm:w-[46%] sm:min-w-[320px] sm:opacity-[0.88]"
        style={{ mixBlendMode: "multiply" }}
        priority
      />
      <Image
        src="/map.png"
        alt=""
        width={600}
        height={600}
        className="absolute right-0 -bottom-20 w-[72%] min-w-[220px] max-w-[580px] object-contain opacity-45 pointer-events-none select-none sm:right-[2%] sm:-bottom-8 sm:w-[44%] sm:min-w-[320px] sm:opacity-[0.88]"
        style={{ mixBlendMode: "multiply" }}
        priority
      />

      <div className="relative z-10 mt-28 max-w-2xl text-center sm:mt-0">
        <div className="flex justify-center mb-2">
          <Image src="/logo_nobg.png" alt="창업시그널 로고" width={480} height={300} className="h-auto w-[280px] sm:w-[480px]" priority />
        </div>

        <p className="mt-4 text-base text-slate-600 sm:text-xl">
          서울시 상권 데이터 기반 창업 입지 분석 서비스
        </p>
        <p className="mt-2 text-sm text-slate-400 sm:text-lg">
          지역을 선택하면 매출·유동인구·업종 분석과 금융지원 매칭까지 한번에
        </p>

        <StartButton />
      </div>
    </main>
  );
}
