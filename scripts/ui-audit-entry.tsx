// Browser-only component harness. Never included in src/app or a production route.
import { createRoot } from "react-dom/client";
import WorkspaceShell from "../src/components/layouts/workspace-shell";
import ProfileWizard from "../src/components/builder/profile-wizard";
import AdminWorkshopsPage from "../src/app/(admin)/admin/workshops/page";
const admin = new URLSearchParams(location.search).get("view") === "admin";
const userId = new URLSearchParams(location.search).get("user") ?? "test-user-a";
const context = { id: userId, name: "검증 사용자", role: "participant", workshop: { sessionId: "test-workshop", title: "검증 워크숍", organizationName: "테스트 기관", expiresAt: "2099-01-01T00:00:00Z" }, workshopUnavailable: false };
createRoot(document.getElementById("root")!).render(admin ? <AdminWorkshopsPage /> : <WorkspaceShell context={context}><ProfileWizard onSubmitDraft={payload => {
  const audit = window as unknown as { auditPayloads: unknown[] };
  audit.auditPayloads = [...(audit.auditPayloads ?? []), payload];
}} /></WorkspaceShell>);
