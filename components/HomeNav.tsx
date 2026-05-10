"use client";

import Link from "next/link";

const menus = [
  { label: "비교분석", href: "/compare", icon: "📊" },
  { label: "시뮬레이터", href: "/simulator", icon: "🧮" },
  { label: "AI 상담", href: "/chat", icon: "💬" },
];

export default function HomeNav() {
  return (
    <div className="absolute left-3 right-3 top-3 z-20 flex flex-row flex-wrap justify-center gap-2 sm:left-6 sm:right-auto sm:top-5 sm:flex-nowrap sm:justify-start sm:gap-8">
      {menus.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white/60 border border-slate-200 rounded-lg hover:bg-white transition-colors backdrop-blur-sm sm:gap-2 sm:px-5 sm:py-2 sm:text-base"
        >
          <span>{m.icon}</span>
          {m.label}
        </Link>
      ))}
    </div>
  );
}
