import { NextRequest } from "next/server";
import { manageAdminNfc } from "@/lib/admin/nfc-api";
export function GET(request: NextRequest) { return manageAdminNfc(request, "list"); }
