/**
 * components/DeliveryStatusBadge.tsx
 *
 * Inline badge shown in the checkout form beneath the city/date fields.
 * Reads from DeliveryContext — auto-updates whenever chat updates delivery state.
 *
 * Shows:
 *   🟢 Available    — "Delivery to Kandy on Jun 30 — LKR 1,090"
 *   🔴 Unavailable  — "Not available Jun 29 · Next: Jun 30 →"  (clickable to auto-set)
 *   ⚠️ Perishable  — "⚠️ Someone must be home on Jun 30 to receive"
 *   🔵 City only    — "Kapruka delivers to Kandy ✓"  (no date checked yet)
 */

'use client';

import { useDelivery } from '@/context/DeliveryContext';

interface Props {
  /** Called when user clicks "Use Jun 30 →" on an unavailability badge */
  onUseNextDate?: (date: string) => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}

function fmtRate(rate: number, currency = 'LKR'): string {
  return `${currency} ${rate.toLocaleString('si-LK')}`;
}

export default function DeliveryStatusBadge({ onUseNextDate }: Props) {
  const { delivery } = useDelivery();
  if (!delivery || (!delivery.city && !delivery.date)) return null;

  const { city, date, available, rate, next_available_date, perishable_warning, city_found } = delivery;

  // ── City not in Kapruka network ──────────────────────────────────────────
  if (city_found === false) {
    return (
      <div className="delivery-badge delivery-badge--error">
        <span>❌</span>
        <span>Kapruka doesn&apos;t deliver to &quot;{city}&quot; yet. Try a nearby city.</span>
      </div>
    );
  }

  // ── City confirmed, no date yet ───────────────────────────────────────────
  if (city && available === null && !date) {
    return (
      <div className="delivery-badge delivery-badge--info">
        <span>📦</span>
        <span>Kapruka delivers to <strong>{city}</strong> ✓ — add a date to see availability</span>
      </div>
    );
  }

  // ── Delivery unavailable ──────────────────────────────────────────────────
  if (available === false) {
    return (
      <div className="delivery-badge delivery-badge--error">
        <span>❌</span>
        <div>
          <span>Not available {date ? fmtDate(date) : ''} to <strong>{city}</strong></span>
          {next_available_date && (
            <button
              type="button"
              className="delivery-badge__next-date"
              onClick={() => onUseNextDate?.(next_available_date)}
            >
              Use {fmtDate(next_available_date)} →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Delivery confirmed ────────────────────────────────────────────────────
  if (available === true) {
    return (
      <div className="delivery-badge delivery-badge--success">
        <div className="delivery-badge__main">
          <span>✅</span>
          <span>
            Delivery to <strong>{city}</strong>
            {date ? ` on ${fmtDate(date)}` : ''} — {rate ? fmtRate(rate) : 'fee at checkout'}
          </span>
        </div>
        {perishable_warning && (
          <div className="delivery-badge__warning">
            <span>⚠️</span>
            <span>{perishable_warning}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
