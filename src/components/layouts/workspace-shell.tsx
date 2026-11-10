"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import SignoutForm from "@/components/auth/signout-form";
import { PendingSpinner } from "./pending-indicator";

function MenuLoading() {
  const { pending } = useLinkStatus();
  return pending ? <span className="absolute right-1 top-1 inline-flex" role="status"><PendingSpinner /><span className="sr-only">화면을 불러오고 있어요.</span></span> : null;
}

export type WorkspaceContext = { id: string; name: string; role: string; workshop: { sessionId: string; title: string; organizationName: string; expiresAt: string } | null; workshopUnavailable: boolean };
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider is missing");
  return value;
}
function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
const nav = [{ href: "/builder", label: "만들기", icon: "✦" }, { href: "/dashboard", label: "내 프로필", icon: "◉" }, { href: "/settings", label: "설정", icon: "⚙" }];

export default function WorkspaceShell({ context, children }: { context: WorkspaceContext; children: React.ReactNode }) {
  const pathname = usePathname();
  const isSessionEntry = pathname === "/session";
  const [collapsed, setCollapsed] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const items = context.role === "admin" ? [...nav, { href: "/admin", label: "관리자 공간", icon: "▦" }] : nav;
  return <Context.Provider value={context}><div className="mx-auto flex min-h-dvh w-full max-w-6xl bg-white text-stone-950 shadow-sm">
    {!isSessionEntry && <aside aria-label="작업 공간 탐색" className={`sticky top-0 hidden h-dvh shrink-0 border-r border-stone-200 bg-stone-50 px-3 py-5 md:flex md:flex-col ${collapsed ? "w-20" : "w-56"}`}>
      <button onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"} aria-expanded={!collapsed} className="min-h-11 rounded-lg border border-stone-200 text-sm focus-visible:outline-2 focus-visible:outline-amber-700">{collapsed ? "☰" : "메뉴 접기"}</button>
      <nav className="mt-6 space-y-2" aria-label="PC 주요 메뉴">{items.map(item => <Link key={item.href} title={item.label} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined} href={item.href} className={`relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-700 ${pathname === item.href ? "bg-amber-100 text-amber-950" : "hover:bg-stone-200"}`}><span aria-hidden>{item.icon}</span>{!collapsed && item.label}<MenuLoading /></Link>)}</nav>
    </aside>}
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-white/95 px-4 py-2 backdrop-blur md:px-8">
        <Link href="/dashboard" className="font-semibold">My Orbit <span className="text-amber-700">✦</span></Link>
        <div className="flex min-w-0 items-center gap-2"><span title={context.workshop?.title} className={`${isSessionEntry ? "hidden sm:inline-flex" : ""} max-w-36 truncate rounded-full bg-amber-50 px-3 py-2 text-xs text-amber-900`}>{context.workshopUnavailable ? "워크숍 확인 불가" : context.workshop?.title ?? "세션 미참여"}</span><SignoutForm /></div>
      </header>
      {context.role === "admin" && <div className="border-b border-stone-100 px-4 md:hidden"><Link href="/admin" className="flex min-h-11 items-center text-sm font-semibold text-amber-900">관리자 공간</Link></div>}
      {!online && <p role="alert" className="bg-amber-100 px-5 py-3 text-sm text-amber-950">인터넷 연결이 끊겼어요. 연결 후 다시 시도해 주세요.</p>}
      <main id="main-content" tabIndex={-1} className={isSessionEntry ? "session-entry-main min-w-0 px-5 py-8 sm:px-8 sm:py-12" : "min-w-0 px-4 py-7 md:px-8"}>{children}</main>
      {!isSessionEntry && <nav aria-label="모바일 주요 메뉴" className="sticky bottom-0 z-10 grid grid-cols-3 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">{nav.map(item => <Link key={item.href} href={item.href} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined} className={`relative flex min-h-14 items-center justify-center text-sm font-medium focus-visible:outline-2 focus-visible:outline-amber-700 ${pathname === item.href ? "bg-amber-50 text-amber-950" : "text-stone-600"}`}>{item.label}<MenuLoading /></Link>)}</nav>}
    </div>
  </div></Context.Provider>;
}
