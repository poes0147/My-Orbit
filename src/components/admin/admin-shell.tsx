import Link from "next/link";
import SignoutForm from "@/components/auth/signout-form";
import { AdminMobileNavigation, AdminSidebar } from "./admin-navigation";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-admin-canvas text-admin-text [overflow-wrap:anywhere] [word-break:keep-all]">
    <a href="#admin-content" className="sr-only z-50 rounded-lg bg-admin-surface p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">본문으로 건너뛰기</a>
    <div className="mx-auto flex min-h-dvh max-w-screen-2xl">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-4 py-3 sm:px-8">
          <Link href="/admin" className="flex min-h-11 items-center gap-3 font-semibold">My Orbit<span className="border-l border-admin-border pl-3 text-sm font-normal text-admin-muted">관리자</span></Link>
          <div className="flex items-center gap-2"><AdminMobileNavigation /><SignoutForm /></div>
        </header>
        <main id="admin-content" tabIndex={-1} className="min-w-0 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  </div>;
}
