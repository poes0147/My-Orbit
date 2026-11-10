import Link from "next/link";
import { Suspense } from "react";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactCardFields, contactCardSchema } from "@/lib/nfc/contact-card";
import ContactCardManager from "@/components/nfc/contact-card-manager";

export default function CardsPage() {
  return <section className="mx-auto w-full max-w-4xl text-stone-950">
    <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-900 underline">내 오브제로 돌아가기</Link>
    <h1 className="mt-3 text-2xl font-semibold">내 명함 관리</h1>
    <p className="mt-2 text-sm leading-6 text-stone-600">프로필 없이도 명함을 만들 수 있어요. 저장한 뒤 오브제에서 연결 대상을 선택해 주세요.</p>
    <Suspense fallback={<p role="status" className="mt-6">명함을 불러오고 있어요.</p>}><Cards /></Suspense>
  </section>;
}
async function Cards() {
  await getWorkspaceContext();
  const client = await createSupabaseServerClient();
  const [cards, tags] = await Promise.all([
    client.from("contact_cards").select(contactCardFields).order("updated_at", { ascending: false }),
    client.from("nfc_tags").select("card_id"),
  ]);
  const parsed = contactCardSchema.array().safeParse(cards.data);
  if (cards.error || tags.error || !parsed.success) return <p role="alert" className="mt-6">명함을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.</p>;
  const counts: Record<string, number> = {};
  for (const tag of tags.data ?? []) if (tag.card_id) counts[tag.card_id] = (counts[tag.card_id] ?? 0) + 1;
  return <ContactCardManager initialCards={parsed.data} linkedCounts={counts} />;
}
