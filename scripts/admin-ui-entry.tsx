// Isolated UI harness: actual components, no auth cookies or hosted data.
import { createRoot } from "react-dom/client";
import AdminShell from "../src/components/admin/admin-shell";
import AdminHomePage from "../src/app/(admin)/admin/page";
import WorkshopsPage from "../src/app/(admin)/admin/workshops/page";
import ClayPage from "../src/app/(admin)/admin/clay-materials/page";
import WorkspaceShell from "../src/components/layouts/workspace-shell";

const pathname = location.pathname;
const role = new URLSearchParams(location.search).get("role") ?? "admin";
const context = { id: "fixture-user", name: "테스트 관리자", role, workshop: null, workshopUnavailable: false };
createRoot(document.getElementById("root")!).render(pathname === "/dashboard"
  ? <WorkspaceShell context={context}><h1>참여자 대시보드 테스트</h1></WorkspaceShell>
  : <AdminShell>{pathname === "/admin/workshops" ? <WorkshopsPage /> : pathname === "/admin/clay-materials" ? <ClayPage /> : <AdminHomePage />}</AdminShell>);
