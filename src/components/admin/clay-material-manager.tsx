"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ClayMaterial, ClayRecipe } from "@/lib/builder/clay-catalog";
import PendingIndicator from "@/components/layouts/pending-indicator";

type Tab = "base" | "premixed" | "recipe";
type Item = { material_id: string; parts: number };
type Catalog = { materials: ClayMaterial[]; recipes: ClayRecipe[] };
type Form = { id?: string; name: string; code: string; hex: string; description: string; active: boolean; order: number; items: Item[] };
const tabs: Record<Tab, string> = { base: "기본색", premixed: "준비된 조합색", recipe: "검증된 배합 레시피" };
const button = "inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-3 text-sm font-semibold disabled:opacity-50";
const field = "mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2";
const blank: Form = { name: "", code: "", hex: "#FFFFFF", description: "", active: true, order: 0, items: [{ material_id: "", parts: 1 }, { material_id: "", parts: 1 }] };

async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch("/api/admin/clay", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("재료 목록을 불러오지 못했어요.");
  return response.json();
}

function materialForm(row: ClayMaterial): Form {
  return { ...blank, id: row.id, name: row.name, code: row.code, hex: row.color_code, description: row.description, active: row.is_active, order: row.display_order };
}
function recipeForm(row: ClayRecipe): Form {
  return { ...blank, id: row.id, name: row.result_name, hex: row.result_color_code, description: row.description, active: row.is_active, items: row.clay_recipe_items };
}

export default function ClayMaterialManager() {
  const [tab, setTab] = useState<Tab>("base");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then(setCatalog)
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [revision]);

  function reload() {
    setLoadError(false);
    setCatalog(null);
    setRevision(value => value + 1);
  }
  function update(patch: Partial<Form>) {
    setForm(value => value && ({ ...value, ...patch }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setMessage("");
    const isRecipe = tab === "recipe";
    const common = { description: form.description, is_active: form.active };
    const body = isRecipe
      ? { ...common, result_name: form.name, result_color_code: form.hex, items: form.items }
      : { ...common, name: form.name, color_code: form.hex, code: form.code, type: tab, display_order: form.order };
    const collection = isRecipe ? "recipes" : "materials";
    try {
      const response = await fetch(`/api/admin/clay/${collection}${form.id ? `/${form.id}` : ""}`, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "저장하지 못했어요.");
      setForm(null);
      setMessage("저장했어요.");
      try { setCatalog(await fetchCatalog()); }
      catch { setMessage("저장했어요. 목록을 다시 보려면 새로고침해 주세요."); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  const bases = catalog?.materials.filter(row => row.type === "base") ?? [];
  const rows = tab === "recipe" ? catalog?.recipes.map(recipeForm) : catalog?.materials.filter(row => row.type === tab).map(materialForm);
  return (
    <div className="mt-6 min-w-0 space-y-4">
      {saving && <PendingIndicator message={tab === "recipe" ? "배합 레시피를 저장하고 있어요." : "클레이 재료를 저장하고 있어요."} overlay />}
      <div role="group" aria-label="재료 종류" className="flex flex-wrap gap-2">
        {(Object.keys(tabs) as Tab[]).map(value => (
          <button key={value} type="button" aria-pressed={value === tab} disabled={saving}
            className={`${button} ${value === tab ? "bg-stone-900 text-white" : "bg-white"}`}
            onClick={() => { setTab(value); setForm(null); setMessage(""); }}>{tabs[value]}</button>
        ))}
      </div>
      {loadError ? <div role="alert"><p>재료 목록을 불러오지 못했어요.</p><button className={button} onClick={reload}>다시 시도</button></div> :
        !catalog ? <div role="status" className="space-y-2"><span className="sr-only">재료를 불러오는 중이에요.</span>{[1, 2, 3, 4, 5].map(row => <div key={row} className="h-12 rounded-lg bg-stone-100 motion-safe:animate-pulse" />)}</div> :
        <>
          <button className={button} disabled={saving} onClick={() => { setForm(blank); setMessage(""); }}>
            {tab === "recipe" ? "새 배합 레시피 등록" : `${tabs[tab]} 등록`}
          </button>
          {rows?.length ? <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200">
            {rows.map(row => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                <span aria-hidden className="size-8 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: row.hex }} />
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-stone-600">{row.hex} · {row.active ? "사용 가능" : "사용 중지"}</p>
                  {row.description && <p className="mt-1 text-sm text-stone-700">{row.description}</p>}
                  {tab === "recipe" && <p className="mt-1 text-xs text-stone-600">{row.items.map(item => `${bases.find(base => base.id === item.material_id)?.name ?? "기본색"} ${item.parts}조각`).join(" + ")}</p>}
                </div>
                <button className={button} disabled={saving} aria-label={`${row.name} 수정`} onClick={() => { setForm(row); setMessage(""); }}>수정</button>
              </li>
            ))}
          </ul> : <p className="text-sm text-stone-600">등록된 {tabs[tab]}이 없어요. 현장에서 제공할 재료를 등록해 주세요.</p>}
        </>}
      {form && <form onSubmit={save} className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <h2 className="font-semibold">{tabs[tab]} {form.id ? "수정" : "등록"}</h2>
        <fieldset disabled={saving} className="space-y-3">
          <label className="block text-sm">색상 이름<input required maxLength={50} className={field} value={form.name} onChange={e => update({ name: e.target.value })} /></label>
          {tab !== "recipe" && <label className="block text-sm">재료 코드 (영문 소문자, 숫자, 하이픈)<input required maxLength={50} className={field} value={form.code} onChange={e => update({ code: e.target.value })} /></label>}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">색상 선택<input type="color" className="mt-1 block size-11" value={/^#[0-9a-f]{6}$/i.test(form.hex) ? form.hex : "#ffffff"} onChange={e => update({ hex: e.target.value.toUpperCase() })} /></label>
            <label className="min-w-0 flex-1 text-sm">HEX 코드<input required maxLength={7} className={field} value={form.hex} onChange={e => update({ hex: e.target.value })} /></label>
          </div>
          <label className="block text-sm">메모<textarea maxLength={300} className={field} value={form.description} onChange={e => update({ description: e.target.value })} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => update({ active: e.target.checked })} />추천에 사용</label>
          {tab === "recipe" && <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">기본색 혼합 비율</legend>
            {form.items.map((item, index) => (
              <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem_auto] items-end gap-2">
                <label className="min-w-0 text-sm">기본색 {index + 1}<select required className={field} value={item.material_id}
                  onChange={e => update({ items: form.items.map((row, i) => i === index ? { ...row, material_id: e.target.value } : row) })}>
                  <option value="">선택</option>{bases.map(base => <option key={base.id} value={base.id}>{base.name}{base.is_active ? "" : " (사용 중지)"}</option>)}
                </select></label>
                <label className="text-sm">조각 수<input required type="number" min={1} max={100} className={field} value={item.parts}
                  onChange={e => update({ items: form.items.map((row, i) => i === index ? { ...row, parts: Number(e.target.value) } : row) })} /></label>
                <button type="button" className={button} disabled={form.items.length <= 2} onClick={() => update({ items: form.items.filter((_, i) => i !== index) })}>빼기</button>
              </div>
            ))}
            <button type="button" className={button} disabled={form.items.length >= 20} onClick={() => update({ items: [...form.items, { material_id: "", parts: 1 }] })}>기본색 추가</button>
          </fieldset>}
          <div className="flex flex-wrap gap-2">
            <button className={`${button} bg-stone-900 text-white`}>{saving ? "저장 중…" : "저장"}</button>
            <button type="button" className={button} onClick={() => { setForm(null); setMessage(""); }}>취소</button>
          </div>
        </fieldset>
      </form>}
      {message && <p role={form ? "alert" : "status"} className="text-sm">{message}</p>}
    </div>
  );
}
