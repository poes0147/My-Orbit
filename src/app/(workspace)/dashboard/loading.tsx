export default function DashboardLoading() {
  return (
    <section className="motion-safe:animate-pulse space-y-8 pb-8" aria-label="대시보드 불러오는 중">
      <div className="space-y-3"><div className="h-4 w-32 rounded bg-stone-200" /><div className="h-8 w-56 rounded bg-stone-200" /><div className="h-4 w-64 rounded bg-stone-100" /></div>
      <div className="h-56 rounded-[1.75rem] bg-stone-200" />
      <div className="space-y-4"><div className="h-6 w-32 rounded bg-stone-200" /><div className="h-24 rounded-2xl bg-stone-100" /></div>
      <div className="space-y-3"><div className="h-6 w-32 rounded bg-stone-200" /><div className="h-20 rounded-2xl bg-stone-100" /><div className="h-20 rounded-2xl bg-stone-100" /></div>
    </section>
  );
}
