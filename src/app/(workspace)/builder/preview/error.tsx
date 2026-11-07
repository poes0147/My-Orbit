"use client";

export default function PreviewError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[480px] rounded-2xl border border-stone-200 p-5">
      <h1 className="text-lg font-semibold">프로필 초안을 불러오지 못했어요.</h1>
      <button type="button" onClick={unstable_retry} className="mt-4 min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">다시 시도</button>
    </section>
  );
}
