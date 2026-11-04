import { NextRequest } from "next/server";
import { manageWorkshops } from "@/lib/workshops/manage";

export async function GET(request: NextRequest) { return manageWorkshops(request, "list"); }
export async function POST(request: NextRequest) { return manageWorkshops(request, "create"); }
