import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";

function validSlug(slug: string) {
  return slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function hasPublicProfile(slug: string) {
  if (!validSlug(slug)) return false;
  const { data, error } = await createPublicClient().from("profiles")
    .select("id").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw new Error("공개 프로필을 불러오지 못했어요.");
  return data !== null;
}

export const getPublicProfile = cache(async (slug: string) => {
  if (!validSlug(slug)) return null;
  const { data, error } = await createPublicClient().from("profiles")
    .select("id,slug,display_name,headline,bio,avatar_url,competency_tags,theme_preset,contact_email,contact_phone,project_items(id,title,description,link_url,star_card)")
    .eq("slug", slug)
    .eq("is_published", true)
    .order("sort_order", { referencedTable: "project_items" })
    .order("id", { referencedTable: "project_items" })
    .maybeSingle();

  if (error) throw new Error("공개 프로필을 불러오지 못했어요.");
  return data;
});

export function webUrl(value: string | null, httpsOnly = false) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || (!httpsOnly && url.protocol === "http:")) return url.href;
  } catch {
    return undefined;
  }
}
