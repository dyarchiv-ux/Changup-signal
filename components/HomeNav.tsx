"use client";

import { useState } from "react";
import Link from "next/link";

const menus = [
  { label: "비교분석", href: "/compare", icon: "📊" },
  { label: "시뮬레이터", href: "/simulator", icon: "🧮" },
  { label: "AI 상담", href: "/chat", icon: "💬" },
];

export default function HomeNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showAlert, setShowAlert] = useState(false);

  function handleClick(e: React.MouseEvent) {
    if (!isLoggedIn) {
      e.preventDefault();
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 2500);
    }
  }

  return (
    <div className="absolute top-5 left-6 z-20 flex flex-row gap-8">
      {menus.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          onClick={handleClick}
          className="flex items-center gap-2 px-5 py-2 text-base font-medium text-slate-600 bg-white/60 border border-slate-200 rounded-lg hover:bg-white transition-colors backdrop-blur-sm"
        >
          <span>{m.icon}</span>
          {m.label}
        </Link>
      ))}

      {showAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 text-sm font-medium text-white bg-slate-700/90 rounded-xl shadow-lg">
          로그인이 필요한 서비스입니다
        </div>
      )}
    </div>
  );
}
