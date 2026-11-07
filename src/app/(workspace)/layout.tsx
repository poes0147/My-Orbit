import { Suspense } from "react";
import SkipLink from "./skip-link";
import LoadingWorkspace from "./loading";
import WorkspaceShell from "@/components/layouts/workspace-shell";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";

async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  const context = await getWorkspaceContext();
  return <WorkspaceShell context={context}>{children}</WorkspaceShell>;
}
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <><SkipLink /><Suspense fallback={<LoadingWorkspace />}><AuthenticatedWorkspace>{children}</AuthenticatedWorkspace></Suspense></>;
}
