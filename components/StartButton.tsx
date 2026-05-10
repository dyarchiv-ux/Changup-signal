"use client";

import Link from "next/link";

export default function StartButton() {
  return (
    <Link
      href="/compare"
      className="mt-6 inline-block px-7 py-3 text-base text-white font-semibold rounded-xl transition-opacity hover:opacity-90 cursor-pointer sm:mt-8 sm:px-12 sm:py-4 sm:text-xl"
      style={{ background: "linear-gradient(135deg, #d5d4f5, #88bde7)" }}
    >
      상권 분석 시작하기 →
    </Link>
  );
}
