"use client";
import { createContext, useContext, useEffect, useState } from "react";

const FeedbackContext = createContext<(message: string) => void>(() => {});
export function useFeedback() { return useContext(FeedbackContext); }
export default function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 4000); return () => clearTimeout(timer); }, [message]);
  return <FeedbackContext.Provider value={setMessage}>{children}<div role="status" aria-live="polite" className={message ? "pointer-events-none fixed bottom-32 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-stone-900 px-5 py-3 text-sm text-white shadow-lg md:bottom-8" : "sr-only"}>{message}</div></FeedbackContext.Provider>;
}
