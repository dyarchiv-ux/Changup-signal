"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showAlert, setShowAlert] = useState(false);
  const router = useRouter();

  function handleClick() {
    if (!isLoggedIn) {
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 2500);
      return;
    }
    router.push("/compare");
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="mt-8 inline-block px-12 py-4 text-xl text-white font-semibold rounded-xl transition-opacity hover:opacity-90 cursor-pointer"
        style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
      >
        상권 분석 시작하기 →
      </button>

      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 text-sm font-medium text-white bg-slate-700/90 rounded-xl shadow-lg z-50">
          로그인이 필요한 서비스입니다
        </div>
      )}
    </>
  );
}
