import Link from "next/link";
import SessionManager from "@/components/instructor/session-manager";
import SignoutForm from "@/components/auth/signout-form";

export default function AdminWorkshopsPage() {
  return <main lang="ko" className="min-h-dvh bg-[#f6f2e9] text-stone-950">
    <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link href="/admin/workshops" className="font-semibold">My Orbit <span className="text-amber-700">✦</span><span className="ml-3 text-sm font-normal text-stone-600">관리자 공간</span></Link><SignoutForm /></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[12rem_minmax(0,1fr)]"><aside className="hidden lg:block"><nav aria-label="관리자 메뉴"><Link href="/admin/workshops" aria-current="page" className="block rounded-xl bg-white px-4 py-3 font-semibold">워크숍 코드 관리</Link><Link href="/dashboard" className="mt-3 block px-4 py-3 text-sm">참여자 공간</Link></nav></aside><section className="min-w-0"><Link href="/admin/clay-materials" className="mb-4 inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-4 text-sm font-semibold">클레이 재료 관리</Link><SessionManager /><Link href="/session" className="mt-10 inline-flex min-h-11 items-center text-sm underline underline-offset-4">참여자 화면으로 이동</Link></section></div>
  </main>;
}
