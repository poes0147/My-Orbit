import Link from "next/link";
import { redirect } from "next/navigation";
import { tagBindingPath, tagIdSchema } from "@/lib/nfc/tag";

export const instant = false;

export default async function BindTagPage({ searchParams }: PageProps<"/t/bind">) {
  const params = await searchParams;
  const rawTag = params.tag;
  const tag = tagIdSchema.safeParse(rawTag);
  if (tag.success) redirect(tagBindingPath(tag.data));
  return <section className="mx-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 text-stone-950">
    <h1 className="text-2xl font-semibold">오브제 연결</h1>
    <p className="mt-3 leading-7 text-stone-600">오브제를 태깅하거나 동봉된 QR을 스캔해 주세요.</p>
    <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-4 text-sm font-semibold">대시보드로 이동</Link>
  </section>;
}
