"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminNavigation, isAdminRouteActive } from "@/lib/admin/navigation";
import { PendingSpinner } from "@/components/layouts/pending-indicator";

function MenuPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" className="ml-auto inline-flex"><PendingSpinner /><span className="sr-only">화면을 불러오고 있어요.</span></span> : null;
}

function MenuLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="관리자 메뉴" className="space-y-2">
    {adminNavigation.map(item => <Link key={item.href} href={item.href} onClick={onNavigate}
      aria-current={isAdminRouteActive(pathname, item.href) ? "page" : undefined}
      className={`flex min-h-12 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${isAdminRouteActive(pathname, item.href) ? "bg-admin-selected text-admin-accent" : "text-admin-muted hover:bg-admin-hover"}`}>
      {item.label}<MenuPending />
    </Link>)}
  </nav>;
}

function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return <div className="lg:hidden">
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="admin-mobile-menu"
      className="min-h-11 rounded-lg border border-admin-border px-3 text-sm font-semibold hover:bg-admin-hover"
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>관리 메뉴</button>
    <dialog ref={dialog} id="admin-mobile-menu" aria-labelledby="admin-menu-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-80 max-w-[calc(100%-1rem)] overflow-y-auto border-l border-admin-border bg-admin-surface p-4 text-admin-text backdrop:bg-stone-950/40">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 id="admin-menu-title" className="font-semibold">관리자 메뉴</h2>
        <button type="button" autoFocus className="min-h-11 rounded-lg px-3 text-sm hover:bg-admin-hover" onClick={() => dialog.current?.close()}>닫기</button>
      </div>
      <MenuLinks onNavigate={() => dialog.current?.close()} />
      <Link href="/dashboard" onClick={() => dialog.current?.close()} className="mt-6 flex min-h-11 items-center border-t border-admin-border px-4 py-3 text-sm underline underline-offset-4">참여자 화면으로 돌아가기</Link>
    </dialog>
  </div>;
}

export function AdminMobileNavigation() {
  const pathname = usePathname();
  return <MobileMenu key={pathname} />;
}

export function AdminSidebar() {
  return <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-admin-border bg-admin-surface px-4 py-8 lg:flex">
    <p className="mb-5 px-4 text-sm font-medium text-admin-muted">운영 메뉴</p>
    <MenuLinks />
    <Link href="/dashboard" className="mt-auto flex min-h-11 items-center rounded-lg px-4 py-3 text-sm underline underline-offset-4 hover:bg-admin-hover">참여자 화면으로 돌아가기</Link>
  </aside>;
}
