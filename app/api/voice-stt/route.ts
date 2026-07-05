import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // keep at 30s total

// Reuses the SAME two keys already used by /api/chat and /api/vision-search.
// No new env vars, no new SDK — @google/genai is already a dependency.
const PRIMARY_KEY = process.env.GEMINI_API_KEY;
const BACKUP_KEY  = process.env.GEMINI_FALLBACK_API_KEY;
const MODEL       = 'gemini-3.1-flash-lite';
const MAX_BYTES   = 8 * 1024 * 1024; // ~60s of webm/opus, well under this

// Timeout budget: stay below maxDuration (30s) with a safety margin
const TOTAL_BUDGET_MS    = 25_000; // 25s total for all attempts
const PRIMARY_TIMEOUT_MS = 18_000; // primary gets up to 18s
const BACKUP_TIMEOUT_MS  = 12_000; // backup gets up to 12s (but we'll use remaining)

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:VOICE-STT]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:VOICE-STT] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:VOICE-STT] ❌', ...a),
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

const PROMPT = `Transcribe the spoken audio exactly as said. The speaker may use Sinhala,
Tamil, English, Sinhalish (romanized Sinhala), or Tanglish (romanized Tamil) — transcribe
in whatever script/script-mix was actually spoken (do not translate). Respond with ONLY the
raw transcript text, no quotes, no commentary, no labels. If the audio is silent or
unintelligible, respond with an empty string.`;

async function transcribeWithKey(key: string, base64: string, mimeType: string): Promise<string | null> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: key });
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: PROMPT },
      ],
    }],
    config: { maxOutputTokens: 300 },
  });
  const text = (response.text ?? '').trim();
  return text.length > 0 ? text : null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`voice-stt:${ip}`, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get('audio');
  if (!audio || !(audio instanceof Blob))
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 });
  if (audio.size > MAX_BYTES)
    return NextResponse.json({ error: 'Audio too long (max ~60s)' }, { status: 413 });

  const mimeType = audio.type || 'audio/webm';
  const buf = Buffer.from(await audio.arrayBuffer());
  const base64 = buf.toString('base64');

  LOG.info('incoming audio', { mimeType, bytes: buf.length });

  const start = Date.now();

  // Try primary key
  if (PRIMARY_KEY) {
    try {
      const primaryTimeout = Math.min(PRIMARY_TIMEOUT_MS, TOTAL_BUDGET_MS);
      const text = await withTimeout(transcribeWithKey(PRIMARY_KEY, base64, mimeType), primaryTimeout);
      if (text) {
        LOG.info('transcribed with primary key in', Date.now() - start, 'ms');
        return NextResponse.json({ text, source: 'gemini' });
      }
      LOG.warn('primary key returned empty transcript, trying backup');
    } catch (err) {
      LOG.warn('primary key failed/timed out, trying backup', err);
    }
  }

  // Try backup key if time remains
  if (BACKUP_KEY) {
    const elapsed = Date.now() - start;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining > 2_000) { // only try if at least 2s left
      const backupTimeout = Math.min(BACKUP_TIMEOUT_MS, remaining);
      try {
        const text = await withTimeout(transcribeWithKey(BACKUP_KEY, base64, mimeType), backupTimeout);
        if (text) {
          LOG.info('transcribed with backup key in', Date.now() - start, 'ms');
          return NextResponse.json({ text, source: 'gemini-backup' });
        }
      } catch (err) {
        LOG.error('backup key also failed/timed out', err);
      }
    } else {
      LOG.warn('not enough time left for backup key');
    }
  }

  return NextResponse.json(
    { error: 'Voice recognition unavailable. Please type your message.' },
    { status: 503 }
  );
}