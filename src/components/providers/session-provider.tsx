"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_SESSION, type CurrentSessionContext } from "@/types/session";

const SessionContext = createContext<CurrentSessionContext>(EMPTY_SESSION);

export function SessionProvider({ children, value = EMPTY_SESSION }: { children: ReactNode; value?: CurrentSessionContext }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
