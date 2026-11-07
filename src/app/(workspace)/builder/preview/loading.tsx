export default function PreviewLoading() {
  return (
    <div className="mx-auto w-full max-w-[480px]" role="status">
      <span className="sr-only">프로필 초안을 불러오는 중이에요.</span>
      <div aria-hidden className="rounded-2xl border border-stone-200 p-5 motion-safe:animate-pulse">
        <div className="size-12 rounded-full bg-stone-100" />
        <div className="mt-5 h-6 w-3/4 rounded bg-stone-100" />
        <div className="mt-4 flex gap-2">{[1, 2, 3].map(tag => <div key={tag} className="h-7 w-14 rounded-full bg-stone-100" />)}</div>
        <div className="mt-6 h-24 rounded-lg bg-stone-100" />
      </div>
    </div>
  );
}
