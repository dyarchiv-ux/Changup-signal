"use client";

import Link from "next/link";

const menus = [
  { label: "비교분석", href: "/compare", icon: "📊" },
  { label: "시뮬레이터", href: "/simulator", icon: "🧮" },
  { label: "AI 상담", href: "/chat", icon: "💬" },
];

export default function HomeNav() {
  return (
    <div className="absolute top-5 left-6 z-20 flex flex-row gap-8">
      {menus.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex items-center gap-2 px-5 py-2 text-base font-medium text-slate-600 bg-white/60 border border-slate-200 rounded-lg hover:bg-white transition-colors backdrop-blur-sm"
        >
          <span>{m.icon}</span>
          {m.label}
        </Link>
      ))}
    </div>
  );
}
