import Link from "next/link";
import { adminNavigation } from "@/lib/admin/navigation";

export default function AdminHomePage() {
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">관리자 홈</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-admin-muted">워크숍을 준비하고, 나의 별 만들기에 사용할 재료를 관리하세요.</p>
    <div className="mt-8 grid gap-5 xl:grid-cols-2">
      {adminNavigation.slice(1).map(item => <Link key={item.href} href={item.href}
        className="flex flex-col items-start rounded-2xl border border-admin-border bg-admin-surface p-6 hover:border-admin-accent sm:p-8">
        <h2 className="text-xl font-semibold">{item.label}</h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-admin-muted">{item.description}</p>
        <span className="mt-8 text-sm font-semibold text-admin-accent underline underline-offset-4">{item.href === "/admin/workshops" ? "코드 관리 열기" : "클레이 관리 열기"}</span>
      </Link>)}
    </div>
  </>;
}
