import Link from "next/link";

export const instant = false;

export default async function BindTagPage({ searchParams }: PageProps<"/t/bind">) {
  const params = await searchParams;
  const rawTag = params.tag;
  const tag = Array.isArray(rawTag) ? rawTag[0] : rawTag;
  return <section className="flex min-h-[65dvh] flex-col justify-center"><p className="text-sm font-semibold text-amber-700">나의 별 오브제</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">태그 연결</h1><p className="mt-3 leading-7 text-stone-600">태그를 프로필에 연결하려면 먼저 로그인해야 합니다.</p>{tag && <p className="mt-5 rounded-xl bg-stone-100 p-4 text-sm">태그 코드: <strong>{tag}</strong></p>}<Link href={`/session${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-900 px-5 font-medium text-white">로그인 후 계속하기</Link></section>;
}
