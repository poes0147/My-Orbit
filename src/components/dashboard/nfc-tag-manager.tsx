import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { tagDestinationFields, tagDestinationSchema } from "@/lib/nfc/destination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TagDestinationEditor from "./tag-destination-editor";
import { contactCardFields, contactCardSchema } from "@/lib/nfc/contact-card";

export default async function NfcTagManager({ profilePublished }: { profilePublished: boolean }) {
  await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, cards] = await Promise.all([
    supabase.from("nfc_tags").select(tagDestinationFields).order("updated_at", { ascending: false }),
    supabase.from("contact_cards").select(contactCardFields).order("updated_at", { ascending: false }),
  ]);
  const tags = tagDestinationSchema.array().safeParse(data);
  const parsedCards = contactCardSchema.array().safeParse(cards.data);
  if (error || !tags.success || cards.error || !parsedCards.success) {
    console.error("NFC tags could not be listed", error?.code);
    return <div className="mt-3 space-y-2">
      <p role="alert" className="text-sm text-red-800">등록된 오브제를 불러오지 못했어요.</p>
      <a href="/dashboard" className="inline-flex min-h-11 items-center font-semibold text-amber-900 underline">다시 시도</a>
    </div>;
  }
  if (tags.data.length === 0) return <div className="mt-3 rounded-2xl border border-stone-200 p-4">
    <p className="text-sm font-semibold">등록된 NFC 오브제가 없어요.</p>
    <p className="mt-1 text-sm leading-6 text-stone-600">워크숍에서 받은 오브제나 QR을 먼저 등록해 주세요.</p>
    <Link href="/t/bind" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800">새 오브제 등록하기</Link>
    <Link href="/dashboard/cards" className="ml-3 inline-flex min-h-11 items-center text-sm font-semibold text-amber-900 underline">내 명함 관리</Link>
  </div>;
  return <TagDestinationEditor initialTags={tags.data} cards={parsedCards.data} profilePublished={profilePublished} />;
}
