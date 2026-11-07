import type { NextRequest } from "next/server";
import { handleWorkshopCode } from "@/lib/workshops/api";

export function POST(request: NextRequest) {
  return handleWorkshopCode(request, "join");
}
