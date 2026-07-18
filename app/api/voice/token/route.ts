import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`voice-token:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const key = process.env.GEMINI_LIVE_API ?? process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_CHAT01;
  if (!key) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });

  const expire = new Date(Date.now() + 10 * 60_000).toISOString();

  try {
    // Unlocked token (Case 1) — client controls full LiveConnectConfig at connect time.
    // This avoids constraint mismatches that silently hang the WSS handshake.
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expire,
      },
    });

    if (!token.name) {
      return NextResponse.json({ error: 'Token creation returned empty' }, { status: 502 });
    }

    return NextResponse.json({ token: token.name, model: LIVE_MODEL, expiresAt: expire });
  } catch (err) {
    console.error('[voice-token] failed:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
