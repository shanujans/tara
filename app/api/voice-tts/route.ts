import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Primary key (first in list)
const PRIMARY_KEY = process.env.GEMINI_API_KEY;

// Additional fallback keys – comma‑separated in env var
const FALLBACK_KEYS = process.env.GEMINI_FALLBACK_API_KEYS
  ? process.env.GEMINI_FALLBACK_API_KEYS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

// All keys: primary first, then fallbacks
const ALL_KEYS = PRIMARY_KEY ? [PRIMARY_KEY, ...FALLBACK_KEYS] : FALLBACK_KEYS;

const MODEL       = 'gemini-3.1-flash-tts-preview';
const MAX_CHARS   = 600;
const VOICE       = 'Kore';

// Stay under maxDuration (30s) – reserve some time for network and processing
const TOTAL_BUDGET_MS    = 25_000; // 25s total for all attempts, 5s safety margin under maxDuration
const MAX_PER_KEY_MS     = 15_000; // each key gets at most 15s (but may be less if budget runs low)

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:VOICE-TTS]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:VOICE-TTS] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:VOICE-TTS] ❌', ...a),
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

// Gemini TTS returns raw 16-bit PCM @ 24kHz mono. Wrap it in WAV.
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesizePcm(key: string, text: string): Promise<Buffer> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: key });
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error('No audio data from Gemini');
  return Buffer.from(b64, 'base64');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`voice-tts:${ip}`, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { text } = await req.json().catch(() => ({ text: '' }));
  const clean = sanitizeInput(String(text || '')).slice(0, MAX_CHARS);
  if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  const start = Date.now();
  let wavBuffer: Buffer | null = null;

  // Try each API key in order until one succeeds or we run out of time
  for (const key of ALL_KEYS) {
    const elapsed = Date.now() - start;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining < 2_000) {
      LOG.warn('Not enough time left, stopping attempts');
      break;
    }

    const timeout = Math.min(MAX_PER_KEY_MS, remaining);
    LOG.info(`Trying key ${key.slice(0,4)}… with ${timeout}ms timeout`);

    try {
      const pcm = await withTimeout(synthesizePcm(key, clean), timeout);
      wavBuffer = pcmToWav(pcm);
      LOG.info(`Succeeded with key ${key.slice(0,4)}… in ${Date.now() - start}ms`);
      break; // success – exit loop
    } catch (err) {
      // If it's a quota error (429), we'll just log and move to next key
      const errorMessage = (err as Error).message || String(err);
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        LOG.warn(`Key ${key.slice(0,4)}… quota exhausted, trying next`);
      } else if (errorMessage.includes('timed out')) {
        LOG.warn(`Key ${key.slice(0,4)}… timed out after ${timeout}ms, trying next`);
      } else {
        LOG.warn(`Key ${key.slice(0,4)}… failed:`, errorMessage);
      }
      // continue to next key
    }
  }

  if (!wavBuffer) {
    return NextResponse.json({ error: 'Voice reply unavailable.' }, { status: 503 });
  }

  // Return raw WAV
  return new NextResponse(new Uint8Array(wavBuffer), {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(wavBuffer.length),
    },
  });
}