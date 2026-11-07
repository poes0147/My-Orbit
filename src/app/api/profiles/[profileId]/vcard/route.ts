import { getPublicProfile } from "@/modules/public-profile/get-public-profile";
import { createVCard } from "@/modules/public-profile/vcard";

export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  // Next.js uses the same parameter name as the sibling profile editing API.
  const { profileId: slug } = await params;
  const profile = await getPublicProfile(slug);
  const headers = { "Cache-Control": "no-store" };
  if (!profile) return new Response(null, { status: 404, headers });

  return new Response(createVCard({
    name: profile.display_name?.trim() || profile.slug,
    headline: profile.headline,
    bio: profile.bio,
    email: profile.contact_email,
    phone: profile.contact_phone,
    url: new URL("/p/" + profile.slug, request.url).href,
  }), {
    headers: {
      ...headers,
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + profile.slug + '.vcf"',
    },
  });
}
