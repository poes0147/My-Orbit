import Link from "next/link";
import SignoutForm from "@/components/auth/signout-form";

export default function SettingsPage() {
  return <section className="text-stone-950">
    <p className="text-sm font-semibold text-amber-700">내 공간</p>
    <h1 className="mt-2 text-2xl font-semibold">설정</h1>
    <p className="mt-3 text-stone-600">현재 기기에서 로그아웃할 수 있어요. 프로필 공개·해제는 대시보드의 프로필 편집에서 변경할 수 있어요.</p>
    <Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-amber-800 underline">대시보드에서 내 프로필 열기</Link>
    <p className="mt-5"><Link href="/admin/workshops" className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-800 underline">관리자 코드 관리</Link><span className="block text-xs text-stone-500">관리자로 지정된 계정만 이용할 수 있어요.</span></p>
    <div className="mt-8"><SignoutForm className="min-h-12 rounded-xl border border-stone-300 px-5 text-sm font-semibold hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" /></div>
  </section>;
}
