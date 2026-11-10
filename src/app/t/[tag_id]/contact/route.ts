import { createPublicClient } from "@/lib/supabase/public-client";
import { tagIdSchema } from "@/lib/nfc/tag";
import { createVCard } from "@/modules/public-profile/vcard";

const headers = { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(_request: Request, { params }: { params: Promise<{ tag_id: string }> }) {
  const id = tagIdSchema.safeParse((await params).tag_id);
  if (!id.success) return new Response("명함을 찾을 수 없어요.", { status: 404, headers });
  const { data, error } = await createPublicClient().rpc("get_nfc_contact", { p_tag_id: id.data }).maybeSingle();
  if (error) return new Response("잠시 후 다시 시도해 주세요.", { status: 503, headers });
  if (!data) return new Response("현재 연결된 명함이 없어요. 태그를 다시 스캔해 주세요.", { status: 404, headers });
  return new Response(createVCard({ name: data.display_name, phone: data.phone_number, email: data.email,
    organization: data.organization_name, headline: data.job_title, url: data.website_url }), {
    headers: { ...headers, "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'attachment; filename="contact.vcf"' },
  });
}
