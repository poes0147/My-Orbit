import type { SavedDraft } from "@/lib/builder/editable-draft";
import { defaultShapingSteps } from "@/lib/builder/profile-generation";

const roleLabel = { primary: "주조색", secondary: "보조색", accent: "포인트색" } as const;

export default function StarObjectGuideViewer({ guide }: { guide: NonNullable<SavedDraft["objectGuide"]> }) {
  const match = /^\s*(\d{1,3})\s*%?\s*[:：]\s*(\d{1,3})\s*%?\s*$/.exec(guide.color_ratio);
  const primary = match && Number(match[1]) + Number(match[2]) === 100 ? Number(match[1]) : null;

  return (
    <details className="rounded-xl border border-stone-200 bg-white px-4">
      <summary className="min-h-11 cursor-pointer rounded py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-amber-700">
        나의 별 조형 가이드 보기
      </summary>
      <div className="grid min-w-0 gap-5 border-t border-stone-200 py-5 lg:grid-cols-2">
        <section className="min-w-0">
          <h3 className="font-semibold">형태와 의미</h3>
          {guide.shape_name && <p className="mt-2 text-sm font-semibold text-stone-900">{guide.shape_name}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-stone-700">{guide.shape_metaphor}</p>
          <h4 className="mt-4 text-sm font-semibold">{guide.shaping_steps ? "성형 3단계" : "기본 성형 3단계"}</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-stone-700">
            {(guide.shaping_steps ?? defaultShapingSteps).map((step, index) => <li key={index} className="break-words">{step}</li>)}
          </ol>
        </section>
        <section className="min-w-0">
          <h3 className="font-semibold">행성에 사용할 색상</h3>
          {guide.colors !== undefined ? (guide.colors.length ? (
            <ul className="mt-2 space-y-3">
              {guide.colors.map(color => (
                <li key={color.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="size-7 shrink-0 rounded-full border border-stone-300" style={{ backgroundColor: color.hex }} />
                    <p className="min-w-0 break-words font-semibold">{color.name} <span className="font-normal text-stone-600">{color.hex}</span></p>
                  </div>
                  <p className="mt-2 text-stone-700">{roleLabel[color.role]} · 완성품 사용 {color.usage_ratio}%</p>
                  <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full bg-stone-700" style={{ width: `${color.usage_ratio}%` }} />
                  </div>
                  <p className="mt-2 break-words text-stone-700">{color.placement} · {color.recommendation_reason}</p>
                  {color.mix && <p className="mt-2 break-words rounded bg-amber-50 p-2 text-amber-950"><strong>점토 혼합 비율</strong> · {color.mix}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-stone-600">사용 가능한 등록 재료가 없어 색상 추천을 준비하지 못했어요.</p>) : <>
          <p className="mt-2 text-xs text-stone-600">이전에 저장된 색상 제안이에요. 실습에 있는 재료를 확인해 주세요.</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 break-words text-sm">
            <div className="min-w-0"><dt className="text-stone-500">주조색</dt><dd className="font-medium">{guide.primary_color}</dd></div>
            <div className="min-w-0"><dt className="text-stone-500">보조색</dt><dd className="font-medium">{guide.secondary_color}</dd></div>
          </dl>
          <p className="mt-3 break-words text-sm text-stone-700">추천 배합비 {guide.color_ratio}</p>
          {primary !== null && (
            <div aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-stone-200">
              <span className="bg-stone-700" style={{ width: `${primary}%` }} />
            </div>
          )}
          </>}
        </section>
        <fieldset className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 px-3 pb-2 lg:col-span-2">
          <legend className="px-1 text-sm font-semibold text-amber-950">NFC 오브제 제작 체크리스트</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm leading-6 text-stone-800">
            <input type="checkbox" className="size-5 shrink-0 accent-amber-800" />
            <span>칩 주변을 감싸는 점토 두께를 3mm 이하로 유지해요.</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm leading-6 text-stone-800">
            <input type="checkbox" className="size-5 shrink-0 accent-amber-800" />
            <span>완충 실리콘 캡슐을 사용하고 칩과 안테나를 꺾지 않아요.</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm leading-6 text-stone-800">
            <input type="checkbox" className="size-5 shrink-0 accent-amber-800" />
            <span>비상용 QR 스티커를 받았다면 오브제 바닥에 붙여요.</span>
          </label>
        </fieldset>
      </div>
    </details>
  );
}
