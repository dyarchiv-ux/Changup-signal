"use client";

import Link from "next/link";

export default function StartButton() {
  return (
    <Link
      href="/compare"
      className="mt-8 inline-block px-12 py-4 text-xl text-white font-semibold rounded-xl transition-opacity hover:opacity-90 cursor-pointer"
      style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
    >
      상권 분석 시작하기 →
    </Link>
  );
}
