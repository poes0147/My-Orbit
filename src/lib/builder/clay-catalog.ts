import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type ClayMaterial = {
  id: string; name: string; code: string; color_code: string; type: "base" | "premixed";
  description: string; is_active: boolean; display_order: number;
};
export type ClayRecipe = {
  id: string; result_name: string; result_color_code: string; description: string; is_active: boolean;
  clay_recipe_items: { material_id: string; parts: number }[];
};

export async function readClayCatalog(client: Client, activeOnly: boolean) {
  let materials = client.from("clay_materials").select("id,name,code,color_code,type,description,is_active,display_order");
  let recipes = client.from("clay_recipes").select("id,result_name,result_color_code,description,is_active,clay_recipe_items(material_id,parts)");
  if (activeOnly) {
    materials = materials.eq("is_active", true);
    recipes = recipes.eq("is_active", true);
  }
  const [m, r] = await Promise.all([materials.order("display_order").order("name"), recipes.order("result_name")]);
  if (m.error || r.error) throw new Error("클레이 재료 목록을 불러오지 못했어요.");
  return { materials: m.data as ClayMaterial[], recipes: r.data as ClayRecipe[] };
}

export async function readAvailableClay(client: Client) {
  const { materials, recipes } = await readClayCatalog(client, true);
  const base = new Map(materials.filter(item => item.type === "base").map(item => [item.id, item]));
  return [
    ...materials.map(item => ({ id: item.id, kind: "material" as const, name: item.name, hex: item.color_code })),
    ...recipes.flatMap(recipe => {
      const parts = recipe.clay_recipe_items;
      if (parts.length < 2 || parts.some(item => !base.has(item.material_id))) return [];
      return [{
        id: recipe.id, kind: "recipe" as const, name: recipe.result_name, hex: recipe.result_color_code,
        mix: parts.map(item => `${base.get(item.material_id)?.name} ${item.parts}조각`).join(" + "),
      }];
    }),
  ];
}
