import Link from "next/link";
import ClayMaterialManager from "@/components/admin/clay-material-manager";

export default function ClayMaterialsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-7 text-stone-950 sm:px-6">
      <Link href="/admin/workshops" className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-900 underline">워크숍 코드 관리로 돌아가기</Link>
      <h1 className="mt-3 text-2xl font-semibold">클레이 재료 및 배합 레시피 관리</h1>
      <p className="mt-2 text-sm text-stone-600">실습에 준비된 색과 확인한 배합만 등록해 주세요.</p>
      <ClayMaterialManager />
    </main>
  );
}
