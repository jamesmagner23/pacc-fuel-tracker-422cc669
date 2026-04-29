import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight analytics for the demo client portal.
 *
 * Fires only when the app is running in `?demo=true` mode. Writes to
 * `demo_analytics_events` with anon-insert RLS so unauthenticated demo
 * visitors (e.g. email recipients) can be tracked.
 */

const SESSION_KEY = "demo_analytics_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (globalThis.crypto && "randomUUID" in globalThis.crypto)
          ? globalThis.crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export interface DemoEventInput {
  eventType: string;
  section?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logDemoEvent(input: DemoEventInput) {
  // Fire-and-forget; never throw into the UI
  try {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "true") return;

    const payload = {
      event_type: input.eventType,
      source: params.get("source"),
      section: input.section ?? null,
      brand: params.get("brand"),
      accent_color: params.get("color"),
      session_id: getSessionId(),
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      path: window.location.pathname,
      search_params: window.location.search || null,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    };

    await supabase.from("demo_analytics_events").insert(payload);
  } catch {
    /* swallow — analytics must never break the demo */
  }
}