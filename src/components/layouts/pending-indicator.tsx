export function PendingSpinner() {
  return <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-amber-200 border-t-amber-800 motion-safe:animate-spin" />;
}

export default function PendingIndicator({ message, overlay = false }: { message: string; overlay?: boolean }) {
  const status = (
    <div role="status" className={`flex items-center justify-center gap-3 text-center text-sm font-semibold text-stone-800 ${overlay ? "rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-lg" : "py-3"}`}>
      <PendingSpinner />
      <span>{message}</span>
    </div>
  );
  return overlay ? (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-stone-950/15 px-4">{status}</div>
  ) : status;
}
