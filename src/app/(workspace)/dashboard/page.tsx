"use client";

import Link from "next/link";
import { useState } from "react";

const steps = ["AI 인터뷰 작성", "프로필 검토 및 발행", "나의 별 오브제와 NFC 연결"];

export default function DashboardPage() {
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyProfileLink() {
    const url = `${window.location.origin}/p/my-orbit`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="space-y-7 pb-8" aria-labelledby="dashboard-title">
      <header>
        <p className="text-sm font-semibold text-amber-700">나만의 궤도</p>
        <h1 id="dashboard-title" className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">내 프로필</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">나를 소개하는 이야기와 오브제의 연결 상태를 확인해요.</p>
      </header>

      <div className="rounded-3xl bg-stone-900 p-6 text-white">
        <p className="text-sm text-stone-300">프로필을 아직 완성하지 않았어요</p>
        <h2 className="mt-2 text-xl font-semibold">AI 인터뷰로 나만의 소개를 만들어보세요</h2>
        <Link href="/builder" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">인터뷰 시작하기 <span aria-hidden="true" className="ml-2">→</span></Link>
      </div>

      <div className="grid grid-cols-3 gap-3" aria-label="프로필 요약">
        <article className="rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-500">외부 조회</p><p className="mt-2 text-xl font-semibold">—</p><p className="mt-1 text-[11px] text-stone-400">프로필 발행 후 집계</p></article>
        <article className="rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-500">프로필</p><p className="mt-2 text-sm font-semibold text-stone-700">작성 전</p><p className="mt-1 text-[11px] text-stone-400">아직 발행되지 않음</p></article>
        <article className="rounded-2xl border border-stone-200 p-4"><p className="text-xs text-stone-500">내 오브제</p><p className="mt-2 text-sm font-semibold text-stone-700">미연결</p><p className="mt-1 text-[11px] text-stone-400">태그 등록 후 표시</p></article>
      </div>

      <section aria-labelledby="progress-title">
        <div className="flex items-end justify-between"><div><p className="text-xs font-semibold text-amber-700">나의 여정</p><h2 id="progress-title" className="mt-1 text-lg font-semibold">프로필 완성까지</h2></div><span className="text-sm text-stone-500">0 / 3</span></div>
        <ol className="mt-4 space-y-3">{steps.map((step, i) => <li key={step} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-500">{i + 1}</span><span className="flex-1 text-sm font-medium text-stone-700">{step}</span>{i === 0 && <Link href="/builder" aria-label="AI 인터뷰 시작" className="text-sm font-semibold text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-600">시작 →</Link>}</li>)}</ol>
      </section>

      <section aria-labelledby="actions-title"><h2 id="actions-title" className="text-lg font-semibold">빠른 작업</h2><div className="mt-3 grid grid-cols-2 gap-3"><Link href="/builder" className="rounded-2xl border border-stone-200 p-4 text-sm font-semibold transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-600">✦ <span className="ml-2">프로필 편집</span></Link><button type="button" onClick={() => setGuideOpen(true)} className="rounded-2xl border border-stone-200 p-4 text-left text-sm font-semibold transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-600">◈ <span className="ml-2">나의 별 가이드</span></button><button type="button" onClick={copyProfileLink} disabled className="cursor-not-allowed rounded-2xl border border-stone-200 p-4 text-left text-sm font-semibold text-stone-400" title="프로필 발행 후 사용할 수 있어요">↗ <span className="ml-2">프로필 링크 복사</span></button><Link href="/t/bind" className="rounded-2xl border border-stone-200 p-4 text-sm font-semibold transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-600">⌁ <span className="ml-2">NFC 오브제 연결</span></Link></div></section>

      {copied && <p role="status" className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white">프로필 링크가 복사되었습니다!</p>}
      {guideOpen && <div role="presentation" onClick={() => setGuideOpen(false)} className="fixed inset-0 z-30 grid place-items-end bg-stone-950/40 p-3 sm:place-items-center"><section role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-amber-700">나의 별</p><h2 id="guide-title" className="mt-1 text-xl font-semibold">오브제 제작 가이드</h2></div><button type="button" onClick={() => setGuideOpen(false)} aria-label="닫기" className="rounded-full px-3 py-1 text-stone-500 focus-visible:outline-2 focus-visible:outline-amber-600">닫기</button></div><p className="mt-4 text-sm leading-6 text-stone-600">AI 인터뷰를 마치면 당신의 이야기에서 영감을 받은 색상 배합과 상징 형태를 확인할 수 있어요.</p><button type="button" disabled className="mt-5 min-h-11 w-full cursor-not-allowed rounded-xl bg-stone-100 text-sm text-stone-500">인터뷰 완료 후 확인 가능</button></section></div>}
    </section>
  );
}
