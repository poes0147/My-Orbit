"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-xl border border-admin-border bg-admin-surface p-6 text-admin-text">
    <h1 className="text-xl font-semibold">관리 화면을 불러오지 못했어요.</h1>
    <p className="mt-3 text-sm leading-6 text-admin-muted">연결을 확인하고 다시 시도해 주세요.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button onClick={reset} className="min-h-11 rounded-lg border border-admin-border px-4 text-sm font-semibold">다시 시도</button>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center px-3 text-sm underline underline-offset-4">참여자 화면으로 돌아가기</Link>
    </div>
  </section>;
}
