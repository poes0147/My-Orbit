import { connection } from "next/server";
import { Suspense } from "react";
import TagBindingForm from "@/components/nfc/tag-binding-form";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolveTag } from "@/lib/nfc/resolve-tag";
import { tagBindingPath, tagIdSchema } from "@/lib/nfc/tag";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800";

export default function BindTagPage({ params }: { params: Promise<{ tag_id: string }> }) {
  return <section className="mx-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 text-stone-950 [overflow-wrap:anywhere] [word-break:keep-all] sm:p-7">
    <p className="text-sm font-semibold text-amber-800">My Orbit · 나의 별</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight">오브제 연결</h1>
    <Suspense fallback={<p role="status" className="mt-3">오브제 정보를 확인하고 있어요.</p>}>
      <TagBinding params={params} />
    </Suspense>
  </section>;
}

async function TagBinding({ params }: { params: Promise<{ tag_id: string }> }) {
  await connection();
  const parsed = tagIdSchema.safeParse((await params).tag_id);
  if (!parsed.success) return <p className="mt-3">태그 주소를 확인해 주세요.</p>;
  const tagId = parsed.data;
  const tag = await resolveTag(tagId).catch(() => undefined);
  if (tag === undefined) return <div className="mt-3 space-y-3">
    <p role="alert">태그를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.</p>
    <a href={tagBindingPath(tagId)} className={button}>다시 시도</a>
  </div>;
  if (!tag) return <p className="mt-3">등록되지 않은 태그예요. 워크숍 운영진에게 문의해 주세요.</p>;
  if (tag.tag_status === "inactive") return <p className="mt-3">사용이 중단된 태그예요. 워크숍 운영진에게 문의해 주세요.</p>;
  if (tag.tag_status !== "unbound") return <p className="mt-3">이미 연결된 태그예요.</p>;

  await getWorkspaceContext();
  return <>
    <p className="mt-3 text-sm leading-6 text-stone-700">오브제와 별도로 받은 등록 코드를 입력하면 내 계정에 등록돼요. 프로필을 만들거나 공개할 필요는 없어요.</p>
    <dl className="mt-4 space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
      <dt className="font-semibold">태그 ID</dt><dd className="font-mono">{tagId}</dd>
    </dl>
    <TagBindingForm tagId={tagId} />
  </>;
}
