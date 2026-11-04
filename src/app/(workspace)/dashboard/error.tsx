"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-[50dvh] flex-col justify-center" aria-labelledby="dashboard-error-title">
      <p className="text-sm font-medium text-amber-800">내 작업 공간</p>
      <h1 id="dashboard-error-title" className="mt-2 text-2xl font-semibold">대시보드를 불러오지 못했어요</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">로그인 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
      <button type="button" onClick={reset} className="mt-5 min-h-12 w-fit rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">다시 불러오기</button>
    </section>
  );
}
