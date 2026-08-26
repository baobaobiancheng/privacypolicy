"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { resolveAnalyticsSessionId, type AnalyticsSessionStorage } from "@/src/analytics/client-session";
import { explicitAnalyticsAction, normalizeAnalyticsPagePath, type ClientAnalyticsEvent } from "@/src/analytics/contract";

const PERSONA_ID = "client-editor";
const FLUSH_DELAY_MS = 2_000;
let inMemorySessionId: string | null = null;

function sessionId(): string {
  let storage: AnalyticsSessionStorage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  inMemorySessionId = resolveAnalyticsSessionId(storage, inMemorySessionId, () => crypto.randomUUID());
  return inMemorySessionId;
}

function projectIdFromPath(path: string): string | undefined {
  return path.match(/^\/projects\/(prj_[a-f0-9-]{36})(?:\/|$)/i)?.[1];
}

function safeClickAction(element: HTMLElement): string | null {
  return explicitAnalyticsAction(element.dataset.analyticsId);
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const queueRef = useRef<ClientAnalyticsEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPageFinishRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flush = useCallback(function flushQueue() {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    const events = queueRef.current.splice(0, 25);
    if (!events.length) return;
    void fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-persona-id": PERSONA_ID },
      body: JSON.stringify({ events }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
    if (queueRef.current.length) flushTimerRef.current = setTimeout(flushQueue, FLUSH_DELAY_MS);
  }, []);

  const enqueue = useCallback((event: ClientAnalyticsEvent, immediate = false) => {
    queueRef.current.push(event);
    if (queueRef.current.length >= 20 || immediate) flush();
    else if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const pendingFinishes = pendingPageFinishRef.current;
    const pendingFinish = pendingFinishes.get(pathname);
    if (pendingFinish) {
      clearTimeout(pendingFinish);
      pendingFinishes.delete(pathname);
    }

    let visibleStartedAt = document.visibilityState === "visible" ? performance.now() : null;
    let visibleDurationMs = 0;
    let finished = false;
    const common = {
      sessionId: sessionId(),
      pagePath: normalizeAnalyticsPagePath(pathname),
      projectId: projectIdFromPath(pathname),
    };
    let referrerHost: string | undefined;
    try {
      referrerHost = document.referrer ? new URL(document.referrer).host : undefined;
    } catch {
      referrerHost = undefined;
    }
    // Deferring one task lets React Strict Mode discard its development-only probe mount.
    const pageViewTimer = setTimeout(() => {
      enqueue({ ...common, eventName: "PAGE_VIEW", occurredAt: new Date().toISOString(), properties: { referrerHost } });
    }, 0);

    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("button,a,[role='button']") : null;
      if (!element) return;
      const action = safeClickAction(element);
      if (!action) return;
      const target = element instanceof HTMLAnchorElement ? "link" : element.getAttribute("role") === "button" ? "role-button" : "button";
      enqueue({
        ...common,
        eventName: "BUTTON_CLICK",
        occurredAt: new Date().toISOString(),
        properties: { action, target },
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && visibleStartedAt !== null) {
        visibleDurationMs += performance.now() - visibleStartedAt;
        visibleStartedAt = null;
      } else if (document.visibilityState === "visible" && visibleStartedAt === null) {
        visibleStartedAt = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const finishPageView = () => {
      if (finished) return;
      finished = true;
      if (visibleStartedAt !== null) {
        visibleDurationMs += performance.now() - visibleStartedAt;
        visibleStartedAt = null;
      }
      enqueue({
        ...common,
        eventName: "PAGE_DURATION",
        occurredAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(visibleDurationMs)),
        properties: {},
      }, true);
    };
    window.addEventListener("pagehide", finishPageView);
    return () => {
      clearTimeout(pageViewTimer);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finishPageView);
      const finishTimer = setTimeout(() => {
        pendingFinishes.delete(pathname);
        finishPageView();
      }, 0);
      pendingFinishes.set(pathname, finishTimer);
    };
  }, [enqueue, pathname]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flush();
  }, [flush]);

  return null;
}
