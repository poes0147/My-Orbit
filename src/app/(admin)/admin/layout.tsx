import { Suspense } from "react";
import { requireRole } from "@/lib/auth/workspace-context";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"]);
  return children;
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-8">관리자 권한을 확인하고 있어요.</p>}><AdminGuard>{children}</AdminGuard></Suspense>;
}
