export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:GIFT-CARD]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:GIFT-CARD] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:GIFT-CARD] ❌', ...a),
};

// Try models in order — use HF router first, then Pollinations.ai as free fallback
// HF models: FLUX.1-schnell and SDXL-base-1.0 were deprecated (HTTP 410)
const MODELS = [
  'stabilityai/stable-diffusion-3.5-large',   // newer SD, often available
  'black-forest-labs/FLUX.1-dev',             // FLUX dev (may route to other provider)
  'runwayml/stable-diffusion-v1-5',           // older SD, widely available
];

// Pollinations.ai — free, no API key, good fallback
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

// HuggingFace router endpoint (same base the blueprint uses)
const HF_BASE = 'https://router.huggingface.co/hf-inference/models';

function buildPrompt(occasion: string, recipient: string): string {
  const theme = occasion?.trim()
    ? `${occasion} celebration`
    : 'special gift occasion';
  return (
    `Beautiful greeting card illustration for a ${theme}, ` +
    `warm tropical floral design with hibiscus and lotus flowers, ` +
    `golden accents, soft pastel colors, festive and elegant, ` +
    `professional digital art, no text, no letters, no words`
  );
}

async function tryModel(
  model: string,
  prompt: string,
  hfKey: string,
): Promise<Buffer | null> {
  const url = `${HF_BASE}/${model}`;
  LOG.info(`trying ${model}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${hfKey}`,
        'Content-Type':     'application/json',
        'x-wait-for-model': 'true',          // wait through cold-start
      },
      body:   JSON.stringify({ inputs: prompt }),
      signal: AbortSignal.timeout(40_000),   // 40s — schnell is usually <10s
    });

    if (!res.ok) {
      LOG.warn(`${model} → HTTP ${res.status}:`, (await res.text()).slice(0, 120));
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1_000) {
      LOG.warn(`${model} → response too small (${buf.byteLength}B) — skipping`);
      return null;
    }

    LOG.info(`${model} → OK (${(buf.byteLength / 1024).toFixed(0)} KB)`);
    return buf;
  } catch (e) {
    LOG.warn(`${model} → error:`, String(e).slice(0, 120));
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`gift-card:${ip}`, 5, 60_000))
    return NextResponse.json({ error: 'Rate limited — please wait a minute' }, { status: 429 });

  const hfKey = process.env.HUGGING_FACE_API_KEY;
  if (!hfKey) {
    LOG.error('HUGGING_FACE_API_KEY not set in environment');
    return NextResponse.json({ error: 'Gift card generation not configured' }, { status: 500 });
  }

  let occasion = '', recipient = '';
  try {
    const body = await req.json() as { occasion?: string; recipient?: string };
    occasion  = body.occasion  ?? '';
    recipient = body.recipient ?? '';
  } catch { /* use defaults */ }

  const prompt = buildPrompt(occasion, recipient);
  LOG.info('prompt:', prompt.slice(0, 100));

  // Try each HF model in order, return the first successful image
  for (const model of MODELS) {
    const buf = await tryModel(model, prompt, hfKey);
    if (!buf) continue;

    const base64 = buf.toString('base64');
    // FLUX returns PNG; fall back to jpeg mime if needed
    const image  = `data:image/png;base64,${base64}`;
    return NextResponse.json({ image });
  }

  // ── Pollinations.ai fallback (free, no API key) ──────────────────────────
  try {
    const encoded = encodeURIComponent(prompt);
    const url = `${POLLINATIONS_BASE}/${encoded}?width=1024&height=1024&nologo=true&enhance=true`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString('base64');
      const image = `data:image/png;base64,${base64}`;
      return NextResponse.json({ image });
    }
  } catch (e) {
    LOG.warn('Pollinations.ai fallback failed:', e);
  }

  LOG.error('All models failed including Pollinations.ai');
  return NextResponse.json(
    { error: 'Image generation failed — all models unavailable' },
    { status: 502 },
  );
}