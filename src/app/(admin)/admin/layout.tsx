import { Suspense } from "react";
import { requireRole } from "@/lib/auth/workspace-context";
import AdminShell from "@/components/admin/admin-shell";
import PendingIndicator from "@/components/layouts/pending-indicator";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"]);
  return <AdminShell>{children}</AdminShell>;
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PendingIndicator message="관리자 권한을 확인하고 있어요." />}><AdminGuard>{children}</AdminGuard></Suspense>;
}
