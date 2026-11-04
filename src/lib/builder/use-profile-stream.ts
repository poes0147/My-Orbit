"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { profileGenerationSchema, readPartialProfile, type PartialGeneratedProfile } from "@/lib/builder/profile-generation";
import type { WizardPayload } from "@/lib/builder/draft";

type StreamState = {
  status: "idle" | "streaming" | "complete" | "fallback" | "error";
  profile: PartialGeneratedProfile;
  message: string;
  saved: boolean;
};

const initialState: StreamState = { status: "idle", profile: {}, message: "", saved: false };

export function useProfileStream() {
  const [state, setState] = useState<StreamState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState((current) => current.status === "streaming" ? { ...initialState, message: "생성을 취소했어요." } : current);
  }, []);

  const generate = useCallback(async (payload: WizardPayload) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "streaming", profile: {}, message: "AI 초안을 준비하고 있어요.", saved: false });
    let raw = "";
    try {
      const response = await fetch("/api/builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = "초안을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.";
        try {
          const body: unknown = await response.json();
          if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string") message = body.error.message;
        } catch { /* The safe default message remains visible. */ }
        setState({ ...initialState, status: "error", message, saved: false });
        return;
      }
      if (!response.body) {
        setState({ ...initialState, status: "error", message: "실시간 응답을 받지 못했어요. 다시 시도해 주세요.", saved: false });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleEvent = (block: string) => {
        let eventName = "message";
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (!data.length) return;
        let event: unknown;
        try { event = JSON.parse(data.join("\n")); } catch { return; }
        if (typeof event !== "object" || event === null) return;
        if (eventName === "token" && "type" in event) {
          if (event.type === "status" && "message" in event && typeof event.message === "string") {
            const message = event.message;
            setState((current) => ({ ...current, status: "streaming", message }));
          } else if (event.type === "reset") {
            raw = "";
            setState((current) => ({ ...current, profile: {} }));
          } else if (event.type === "partial" && "delta" in event && typeof event.delta === "string") {
            raw += event.delta;
            const profile = readPartialProfile(raw);
            setState((current) => ({ ...current, profile, status: "streaming", message: "프로필 내용을 정리하고 있어요." }));
          }
          return;
        }
        if ((eventName === "done" || eventName === "error") && "payload" in event) {
          const parsed = profileGenerationSchema.safeParse(event.payload);
          if (!parsed.success) {
            setState({ ...initialState, status: "error", message: "생성된 초안 형식이 올바르지 않아요. 다시 생성해 주세요.", saved: false });
            return;
          }
          if (eventName === "done") {
            setState({ status: "complete", profile: parsed.data, message: "AI 초안을 계정에 저장했어요.", saved: "saved" in event && event.saved === true });
          } else {
            const saveFailed = "type" in event && event.type === "save_failed";
            setState({ status: saveFailed ? "error" : "fallback", profile: parsed.data, message: "message" in event && typeof event.message === "string" ? event.message : "AI 응답을 사용하지 못해 입력 내용을 바탕으로 기본 초안을 만들었어요.", saved: "saved" in event && event.saved === true });
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) handleEvent(block);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleEvent(buffer);
      setState((current) => current.status === "streaming" ? { ...initialState, status: "error", message: "응답이 중간에 끊겼어요. 다시 시도해 주세요.", saved: false } : current);
    } catch {
      if (!controller.signal.aborted) setState({ ...initialState, status: "error", message: "네트워크 연결을 확인하고 다시 시도해 주세요.", saved: false });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);
  return { ...state, generate, cancel };
}
