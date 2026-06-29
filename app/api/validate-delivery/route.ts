/**
 * /api/validate-delivery/route.ts
 *
 * Two-step delivery pre-check before checkout:
 *   1. kapruka_list_delivery_cities  — fuzzy-match user's typed city → canonical name
 *   2. kapruka_check_delivery        — confirm date availability + get rate
 *
 * Called by the checkout form (on city/date change, debounced) and optionally
 * by the chat UI to surface delivery info before the user places an order.
 *
 * Returns a flat, frontend-friendly object so the UI can show status inline
 * and disable the Place Order button when valid: false.
 */
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';
import { mcpSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

const MCP = process.env.MCP_URL ?? 'https://mcp.kapruka.com/mcp';
const H   = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };

// ─── shared MCP call helper ────────────────────────────────────────────────
async function callMCP<T = Record<string, unknown>>(
  sid:    string,
  tool:   string,
  params: Record<string, unknown>,
): Promise<T | null> {
  try {
    const r    = await fetch(MCP, {
      method:  'POST',
      headers: { ...H, 'mcp-session-id': sid },
      body:    JSON.stringify({
        jsonrpc: '2.0',
        id:      `${tool}-${Date.now()}`,
        method:  'tools/call',
        params:  { name: tool, arguments: { params } },
      }),
    });
    const text  = await r.text();
    const match = text.match(/^data:\s*(.+)$/m);
    const outer = JSON.parse(match ? match[1] : text) as {
      result?: { content?: { text?: string }[] };
    };
    const raw   = outer?.result?.content?.[0]?.text ?? '';
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[validate-delivery] MCP call "${tool}" failed:`, e);
    return null;
  }
}

// ─── response types ────────────────────────────────────────────────────────
interface CityResult {
  cities: { name: string; aliases?: string[] }[];
  total_matched: number;
}
interface DeliveryResult {
  available:           boolean;
  rate:                number;
  currency:            string;
  reason:              string | null;
  next_available_date: string | null;
  perishable_warning:  string | null;
}

// ─── POST handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
          ?? 'unknown';

  if (!rateLimit(ip, 60, 60_000)) {
    return NextResponse.json({ valid: false, error: 'Rate limited' }, { status: 429 });
  }

  let body: { city?: string; date?: string; product_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const city    = (body.city ?? '').trim();
  const date    = (body.date ?? '').trim();
  const pids    = body.product_ids ?? [];

  if (!city || !date) {
    return NextResponse.json(
      { valid: false, error: 'city and date are required' },
      { status: 400 },
    );
  }

  // Basic date format guard (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { valid: false, error: 'date must be YYYY-MM-DD' },
      { status: 400 },
    );
  }

  try {
    const sid = await mcpSession();

    // ── Step 1: Fuzzy-match city name ─────────────────────────────────────
    console.log(`[validate-delivery] looking up city: "${city}"`);
    const citiesRes = await callMCP<CityResult>(sid, 'kapruka_list_delivery_cities', {
      query:           city.slice(0, 50),
      limit:           5,
      response_format: 'json',
    });

    const cityList    = citiesRes?.cities ?? [];
    const canonicalCity = cityList[0]?.name ?? null;
    const allSuggestions = cityList.map(c => c.name);

    if (!canonicalCity) {
      // City not found in Kapruka's delivery network
      console.warn(`[validate-delivery] city not found: "${city}"`);

      // Return a few cities as suggestions so the UI can prompt the user
      const fallback = await callMCP<CityResult>(sid, 'kapruka_list_delivery_cities', {
        limit:           6,
        response_format: 'json',
      });

      return NextResponse.json({
        valid:             false,
        city_found:        false,
        canonical_city:    null,
        delivery_available: false,
        rate:              null,
        currency:          'LKR',
        reason:            `"${city}" is not in Kapruka's delivery network.`,
        next_available_date: null,
        perishable_warning: null,
        suggestions:       fallback?.cities?.map(c => c.name) ?? [],
        error:             `We don't deliver to "${city}" yet. Did you mean one of the suggestions?`,
      });
    }

    const cityMatched = canonicalCity.toLowerCase() === city.toLowerCase();
    console.log(
      `[validate-delivery] city resolved: "${city}" → "${canonicalCity}"` +
      (cityMatched ? ' (exact)' : ' (fuzzy)'),
    );

    // ── Step 2: Check delivery availability ──────────────────────────────
    const deliveryParams: Record<string, unknown> = {
      city:            canonicalCity,
      delivery_date:   date,
      response_format: 'json',
    };
    // Pass first product_id if provided — enables perishable freshness warning
    if (pids.length > 0) {
      deliveryParams.product_id = pids[0].replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);
    }

    const deliveryRes = await callMCP<DeliveryResult>(sid, 'kapruka_check_delivery', deliveryParams);

    if (!deliveryRes) {
      // MCP call failed — fail open so checkout can still proceed
      console.warn('[validate-delivery] kapruka_check_delivery returned null, failing open');
      return NextResponse.json({
        valid:              true,
        city_found:         true,
        canonical_city:     canonicalCity,
        city_matched:       cityMatched,
        city_suggestions:   allSuggestions,
        delivery_available: true,
        rate:               null,
        currency:           'LKR',
        reason:             null,
        next_available_date: null,
        perishable_warning: null,
        error:              null,
        warning:            'Could not verify delivery — proceeding anyway.',
      });
    }

    const { available, rate, reason, next_available_date, perishable_warning } = deliveryRes;

    console.log(
      `[validate-delivery] ${canonicalCity} on ${date}: ` +
      `available=${available}, rate=${rate ?? 'n/a'}, reason=${reason ?? 'none'}`,
    );

    if (!available) {
      const errorMsg = next_available_date
        ? `Delivery to ${canonicalCity} isn't available on ${date}. ` +
          `Next available: ${next_available_date}.`
        : `Delivery to ${canonicalCity} isn't available on ${date}. Please choose another date.`;

      return NextResponse.json({
        valid:              false,
        city_found:         true,
        canonical_city:     canonicalCity,
        city_matched:       cityMatched,
        city_suggestions:   allSuggestions,
        delivery_available: false,
        rate:               null,
        currency:           'LKR',
        reason,
        next_available_date,
        perishable_warning: null,
        error:              errorMsg,
        suggestions:        [],
      });
    }

    return NextResponse.json({
      valid:              true,
      city_found:         true,
      canonical_city:     canonicalCity,
      city_matched:       cityMatched,
      city_suggestions:   allSuggestions,
      delivery_available: true,
      rate,
      currency:           'LKR',
      reason:             null,
      next_available_date: null,
      perishable_warning,
      error:              null,
      suggestions:        [],
    });

  } catch (err) {
    console.error('[validate-delivery] unexpected error:', err);
    return NextResponse.json(
      { valid: false, error: 'Delivery check unavailable. Please try again.' },
      { status: 500 },
    );
  }
}
