import ClayMaterialManager from "@/components/admin/clay-material-manager";

export default function ClayMaterialsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight">클레이 재료 및 배합 레시피 관리</h1>
      <p className="mt-2 text-sm text-stone-600">실습에 준비된 색과 확인한 배합만 등록해 주세요.</p>
      <ClayMaterialManager />
    </div>
  );
}
