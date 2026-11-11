// Actual UI components against an isolated PostgreSQL fixture, no hosted accounts.
import { createRoot } from "react-dom/client";
import ContactCardManager from "../src/components/nfc/contact-card-manager";
import TagDestinationEditor from "../src/components/dashboard/tag-destination-editor";
import TagBindingForm from "../src/components/nfc/tag-binding-form";
import WorkspaceShell from "../src/components/layouts/workspace-shell";
import AdminShell from "../src/components/admin/admin-shell";
import NfcTagsPage from "../src/app/(admin)/admin/nfc-tags/page";

fetch("/fixture-state").then(response => response.json()).then(state => {
  const context = { id: state.owner, name: "로컬 테스트", role: "participant", workshop: null, workshopUnavailable: false };
  createRoot(document.getElementById("root")!).render(location.pathname === '/admin/nfc-tags' ? <AdminShell><NfcTagsPage /></AdminShell> : <WorkspaceShell context={context}>
    <h1 className="text-2xl font-semibold">NFC 독립 명함 · 로컬 검증</h1>
    {location.pathname === "/dashboard/cards" ? <ContactCardManager initialCards={state.cards} linkedCounts={state.counts} />
      : location.pathname.startsWith("/tags/bind/") ? <TagBindingForm tagId={location.pathname.split("/").pop()!} />
      : <TagDestinationEditor initialTags={state.tags} cards={state.cards} profilePublished={false} />}
  </WorkspaceShell>);
});
