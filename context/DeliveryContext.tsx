/**
 * context/DeliveryContext.tsx
 *
 * Shared delivery state that bridges TARA chat → checkout form auto-fill.
 *
 * HOW IT WORKS:
 *   1. chat/route.ts emits <delivery_context>{...JSON...}</delivery_context>
 *      in the AI response when the user mentions a city and/or date.
 *   2. ChatPanel.tsx calls parseDeliveryContext() on each assistant message
 *      and dispatches setDelivery() to update this context.
 *   3. The checkout form reads from this context to auto-fill city, date,
 *      show delivery rate, and surface unavailability errors.
 *
 * USAGE:
 *   Wrap your app in <DeliveryProvider> (add to app/layout.tsx alongside CartProvider).
 *   In any component: const { delivery, setDelivery, clearDelivery } = useDelivery();
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface DeliveryInfo {
  /** Canonical city name from Kapruka MCP (e.g. "Colombo 07", "Kandy") */
  city:                string | null;
  /** ISO date string YYYY-MM-DD */
  date:                string | null;
  /** null = not yet checked, true/false = checked result */
  available:           boolean | null;
  /** Delivery fee in LKR */
  rate:                number | null;
  currency:            string;
  /** If unavailable, the next date that IS available */
  next_available_date: string | null;
  /** Freshness warning for perishable items (cakes, flowers) */
  perishable_warning:  string | null;
  /** false = city not in Kapruka delivery network */
  city_found:          boolean | null;
}

interface DeliveryContextValue {
  delivery:      DeliveryInfo | null;
  setDelivery:   (info: DeliveryInfo) => void;
  clearDelivery: () => void;
  /** Merge partial updates (e.g. user edits city in form after auto-fill) */
  updateDelivery: (partial: Partial<DeliveryInfo>) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────
const DeliveryContext = createContext<DeliveryContextValue | null>(null);

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [delivery, setDeliveryState] = useState<DeliveryInfo | null>(null);

  const setDelivery = useCallback((info: DeliveryInfo) => {
    setDeliveryState(info);
  }, []);

  const clearDelivery = useCallback(() => {
    setDeliveryState(null);
  }, []);

  const updateDelivery = useCallback((partial: Partial<DeliveryInfo>) => {
    setDeliveryState(prev =>
      prev ? { ...prev, ...partial } : { ...emptyDelivery(), ...partial }
    );
  }, []);

  return (
    <DeliveryContext.Provider value={{ delivery, setDelivery, clearDelivery, updateDelivery }}>
      {children}
    </DeliveryContext.Provider>
  );
}

export function useDelivery(): DeliveryContextValue {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error('useDelivery must be used inside <DeliveryProvider>');
  return ctx;
}

// ─── Parser — call this on every assistant message ──────────────────────────
/**
 * Parses the <delivery_context>{...}</delivery_context> tag injected by
 * chat/route.ts after it calls kapruka_check_delivery via MCP.
 *
 * Returns null if the tag is absent or malformed.
 *
 * Usage in ChatPanel.tsx:
 *   const dc = parseDeliveryContext(assistantMessageText);
 *   if (dc) setDelivery(dc);
 */
export function parseDeliveryContext(text: string): DeliveryInfo | null {
  const match = text.match(/<delivery_context>([\s\S]*?)<\/delivery_context>/i);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]) as Partial<DeliveryInfo>;
    return {
      city:                raw.city                ?? null,
      date:                raw.date                ?? null,
      available:           raw.available           ?? null,
      rate:                raw.rate                ?? null,
      currency:            raw.currency            ?? 'LKR',
      next_available_date: raw.next_available_date ?? null,
      perishable_warning:  raw.perishable_warning  ?? null,
      city_found:          raw.city_found          ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Strips the <delivery_context> tag from the visible chat text.
 * Call this before rendering the assistant message bubble.
 *
 * Usage in ChatPanel.tsx:
 *   const displayText = stripDeliveryContext(assistantMessageText);
 */
export function stripDeliveryContext(text: string): string {
  return text.replace(/<delivery_context>[\s\S]*?<\/delivery_context>/gi, '').trim();
}

/** Blank delivery state (used as a fallback base in updateDelivery) */
function emptyDelivery(): DeliveryInfo {
  return {
    city: null, date: null, available: null, rate: null,
    currency: 'LKR', next_available_date: null,
    perishable_warning: null, city_found: null,
  };
}
