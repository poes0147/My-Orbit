import Link from "next/link";
import { Suspense } from "react";

export const metadata = { title: "오브제를 열 수 없어요", robots: { index: false } };

export default function UnavailableTagPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  return <main className="mx-auto w-full max-w-lg px-6 py-20 text-stone-950 [overflow-wrap:anywhere] [word-break:keep-all]">
    <p className="text-sm font-semibold text-amber-800">My Orbit · 나의 별</p>
    <Suspense fallback={<h1 className="mt-3 text-2xl font-semibold">오브제를 열 수 없어요</h1>}>
      <Notice searchParams={searchParams} />
    </Suspense>
    <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800">My Orbit 홈</Link>
  </main>;
}

async function Notice({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  const reason = (await searchParams).reason;
  const isPrivate = reason === "private";
  const isPaused = reason === "paused";
  return <>
    <h1 className="mt-3 text-2xl font-semibold">{isPaused ? "연결이 잠시 중지된 오브제예요" : isPrivate ? "현재 비공개 상태인 프로필이에요" : "오브제를 열 수 없어요"}</h1>
    <p className="mt-3 leading-7 text-stone-700">{isPaused ? "소유자가 연결 대상을 선택하면 같은 태그와 QR로 다시 이용할 수 있어요." : isPrivate ? "소유자가 프로필을 다시 공개하면 같은 태그와 QR로 볼 수 있어요." : "사용할 수 없는 태그예요. 오브제에 적힌 QR 주소를 확인해 주세요."}</p>
  </>;
}
