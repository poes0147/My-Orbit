import Link from "next/link";
import SkipLink from "./skip-link";

const navItems = [
  { href: "/builder", label: "만들기" },
  { href: "/dashboard", label: "내 프로필" },
  { href: "/settings", label: "설정" },
];

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <><SkipLink /><div className="mx-auto flex min-h-dvh w-full max-w-md flex-col border-x border-stone-200 bg-white shadow-sm">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-stone-100 bg-white/95 px-5 backdrop-blur">
        <Link href="/session" className="font-semibold tracking-tight text-stone-900">My Orbit<span className="ml-1 text-amber-500">✦</span></Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">세션 미참여</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">로그아웃</button>
          </form>
        </div>
      </header>
      <div id="main-content" tabIndex={-1} className="flex-1 px-5 py-6">{children}</div>
      <nav aria-label="주요 메뉴" className="sticky bottom-0 z-10 grid grid-cols-3 border-t border-stone-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {navItems.map((item) => <Link key={item.href} href={item.href} className="flex min-h-14 items-center justify-center text-sm font-medium text-stone-600 transition hover:bg-amber-50 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-amber-600">{item.label}</Link>)}
      </nav>
    </div></>
  );
}
