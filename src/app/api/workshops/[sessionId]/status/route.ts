import { NextRequest } from "next/server";
import { manageWorkshops } from "@/lib/workshops/manage";

export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  return manageWorkshops(request, "status", sessionId);
}
