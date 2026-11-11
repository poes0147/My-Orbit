import { NextRequest } from "next/server";
import { manageAdminNfc } from "@/lib/admin/nfc-api";
export function POST(request: NextRequest) { return manageAdminNfc(request, "issue"); }
