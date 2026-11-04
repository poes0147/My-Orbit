"use client";

export default function SignoutForm({ className = "min-h-11 rounded-lg px-2 text-xs font-semibold hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-700" }: { className?: string }) {
  return <form action="/api/auth/signout" method="post" onSubmit={() => {
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith("orbit.wizard:") || key.startsWith("orbit.editable:")) sessionStorage.removeItem(key); } catch { /* Disabled browser storage. */ }
  }}><button type="submit" className={className}>로그아웃</button></form>;
}
