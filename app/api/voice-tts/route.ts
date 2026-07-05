import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Gemini (fallback for si/ta only — NOT used for en, see note below) ─────
const GEMINI_PRIMARY_KEY = process.env.GEMINI_API_KEY;
const GEMINI_FALLBACK_KEYS = process.env.GEMINI_FALLBACK_API_KEYS
  ? process.env.GEMINI_FALLBACK_API_KEYS.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const GEMINI_ALL_KEYS = GEMINI_PRIMARY_KEY ? [GEMINI_PRIMARY_KEY, ...GEMINI_FALLBACK_KEYS] : GEMINI_FALLBACK_KEYS;
const GEMINI_MODEL = 'gemini-3.1-flash-tts-preview';
const GEMINI_VOICE = 'Kore';

// ── Speechmatics (English primary; NO server-side fallback — client falls
//    back to the Web Speech API instead, see lib/useVoiceMode.ts) ───────────
const SPEECHMATICS_API_KEY = process.env.SPEECHMATICS_API_KEY;
const SPEECHMATICS_VOICE = process.env.SPEECHMATICS_VOICE || 'sarah'; // sarah|theo|megan|jack
const SPEECHMATICS_URL = (voice: string) => `https://preview.tts.speechmatics.com/generate/${voice}`;

// ── Azure Neural TTS (Sinhala + Tamil primary; free F0 tier is fine, but
//    note its 1-concurrent-request cap if you see 429s under load) ──────────
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const AZURE_SI_VOICE = 'si-LK-SameeraNeural';
const AZURE_TA_VOICE = process.env.AZURE_TA_VOICE || 'ta-LK-SaranyaNeural';
// Default voice speed reads too fast for conversational replies — slow both
// down slightly. Overridable per-language via env without a code change.
const AZURE_SI_RATE = process.env.AZURE_SI_RATE || '-12%';
const AZURE_TA_RATE = process.env.AZURE_TA_RATE || '-12%';

const MAX_CHARS = 600;

// Stay under maxDuration (30s)
const TOTAL_BUDGET_MS = 25_000;
const FAST_PROVIDER_TIMEOUT_MS = 8_000;  // Speechmatics/Azure — should be fast; generous ceiling
const GEMINI_MAX_PER_KEY_MS = 15_000;

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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Shared SSML builder — wraps the voice in <prosody rate="..."> to slow down
// the default (too-fast) reading pace for Sinhala/Tamil neural voices.
function buildAzureSsml(text: string, voice: string, locale: string, rate: string): string {
  return `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;
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

// ── Provider: Speechmatics (English) — wav_16000 default is already a WAV ───
async function synthesizeSpeechmatics(text: string): Promise<Buffer> {
  if (!SPEECHMATICS_API_KEY) throw new Error('SPEECHMATICS_API_KEY not set');
  const res = await fetch(SPEECHMATICS_URL(SPEECHMATICS_VOICE), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SPEECHMATICS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Speechmatics ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Speechmatics returned empty audio');
  return buf;
}

// ── Provider: Azure Neural TTS (Sinhala / Tamil) — riff-24khz is already a
//    full WAV container, no manual header needed ────────────────────────────
async function synthesizeAzure(text: string, voice: string, locale: string, rate: string): Promise<Buffer> {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) throw new Error('AZURE_SPEECH_KEY/REGION not set');
  const ssml = buildAzureSsml(text, voice, locale, rate);
  const res = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
      'User-Agent': 'TARA',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Azure returned empty audio');
  return buf;
}

// ── Provider: Gemini (fallback for si/ta only — tries each key in order) ───
async function synthesizeGeminiPcm(key: string, text: string): Promise<Buffer> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: key });
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
    },
  });
  const part = response.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data;
  if (!b64) throw new Error('No audio data from Gemini');
  return Buffer.from(b64, 'base64');
}

async function runGeminiChain(text: string, budgetMs: number, start: number): Promise<Buffer | null> {
  for (const key of GEMINI_ALL_KEYS) {
    const remaining = budgetMs - (Date.now() - start);
    if (remaining < 2_000) { LOG.warn('Gemini chain: out of budget, stopping'); break; }
    const timeout = Math.min(GEMINI_MAX_PER_KEY_MS, remaining);
    LOG.info(`Gemini fallback: trying key ${key.slice(0, 4)}… with ${timeout}ms timeout`);
    try {
      const pcm = await withTimeout(synthesizeGeminiPcm(key, text), timeout);
      LOG.info(`Gemini fallback: succeeded with key ${key.slice(0, 4)}…`);
      return pcmToWav(pcm);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      LOG.warn(`Gemini fallback: key ${key.slice(0, 4)}… failed: ${msg}`);
    }
  }
  return null;
}

// ── Streaming GET — en (Speechmatics) and si/ta (Azure) ─────────────────────
// Both providers stream their response as it's generated rather than only
// returning it once complete, but the old POST path buffered the full
// response with `arrayBuffer()` server-side, then the client buffered it
// AGAIN with `arrayBuffer()` + `decodeAudioData()` before any audio could
// play. This GET route pipes upstream bytes straight through so an
// `<audio src=...>` element can start playing progressively.
// sl/tl only have Gemini here, which isn't used as a chunked stream in this
// setup — those still go through the POST path below.
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`voice-tts:${ip}`, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const text = req.nextUrl.searchParams.get('text') ?? '';
  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  const clean = sanitizeInput(text).slice(0, MAX_CHARS);
  if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  type StreamProvider = {
    label: string;
    streamFn: () => Promise<ReadableStream<Uint8Array> | null>;
    bufferedFn: () => Promise<Buffer>;
  };

  let provider: StreamProvider | null = null;

  if (lang === 'en' && SPEECHMATICS_API_KEY) {
    provider = {
      label: 'speechmatics',
      streamFn: async () => {
        const upstream = await fetch(SPEECHMATICS_URL(SPEECHMATICS_VOICE), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SPEECHMATICS_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
        });
        if (!upstream.ok || !upstream.body) throw new Error(`Speechmatics ${upstream.status}`);
        return upstream.body;
      },
      bufferedFn: () => synthesizeSpeechmatics(clean),
    };
  } else if ((lang === 'si' || lang === 'ta') && AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) {
    const voice  = lang === 'si' ? AZURE_SI_VOICE : AZURE_TA_VOICE;
    const locale = lang === 'si' ? 'si-LK' : 'ta-LK';
    const rate   = lang === 'si' ? AZURE_SI_RATE : AZURE_TA_RATE;
    provider = {
      label: 'azure',
      streamFn: async () => {
        const ssml = buildAzureSsml(clean, voice, locale, rate);
        const upstream = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
            'User-Agent': 'TARA',
          },
          body: ssml,
        });
        if (!upstream.ok || !upstream.body) throw new Error(`Azure TTS ${upstream.status}`);
        return upstream.body;
      },
      bufferedFn: () => synthesizeAzure(clean, voice, locale, rate),
    };
  }

  if (!provider) {
    return NextResponse.json({ error: 'Streaming TTS not available for this language' }, { status: 400 });
  }

  // Try streaming twice (transient blips happen), then fall back to the
  // buffered call for the SAME provider — so the user still gets the
  // correct voice/language, just without the streaming speed benefit.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const body = await provider.streamFn();
      if (!body) throw new Error('No stream body');
      LOG.info(`[stream] ${provider.label} GET pass-through started (lang=${lang}, attempt ${attempt}, ${clean.length} chars)`);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'audio/wav',
          'X-Tara-TTS-Source': `${provider.label}-stream`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      const cause = (err as { cause?: unknown })?.cause;
      LOG.warn(
        `[stream] ${provider.label} attempt ${attempt} failed: ${(err as Error).message}`,
        cause ? `cause: ${String(cause)}` : '(no cause attached)'
      );
      if (attempt === 1) await new Promise(r => setTimeout(r, 300));
    }
  }

  try {
    const buf = await provider.bufferedFn();
    LOG.info(`[stream] ${provider.label} streaming failed twice, buffered fallback succeeded (lang=${lang}, ${clean.length} chars)`);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(buf.length),
        'X-Tara-TTS-Source': `${provider.label}-buffered-fallback`,
      },
    });
  } catch (err) {
    const cause = (err as { cause?: unknown })?.cause;
    LOG.warn(`[stream] ${provider.label} buffered fallback also failed: ${(err as Error).message}`, cause ? `cause: ${String(cause)}` : '');
    return NextResponse.json({ error: 'Voice reply unavailable.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`voice-tts:${ip}`, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { text, lang } = await req.json().catch(() => ({ text: '', lang: 'en' }));
  const clean = sanitizeInput(String(text || '')).slice(0, MAX_CHARS);
  if (!clean) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

  const start = Date.now();
  let wavBuffer: Buffer | null = null;
  let source = 'none';

  // en → Speechmatics only. No server fallback here — if this fails, the
  // client (lib/useVoiceMode.ts) falls back to the browser's Web Speech API.
  // si / ta → Azure primary, Gemini fallback.
  // sl / tl (Sinhalish / Tanglish, romanized script) → Gemini only; neither
  // Azure's native-script voice nor Speechmatics' English voice can read
  // romanized Sinhala/Tamil correctly.
  //
  // NOTE: the client no longer calls this POST path for lang === 'en',
  // 'si', or 'ta' — it uses the streaming GET handler above instead. This
  // branch is kept as a safety net (e.g. if GET streaming errors out before
  // any bytes arrive, or for any caller that still posts here directly).
  const fastAttempt: { name: string; fn: () => Promise<Buffer> } | null =
    lang === 'en' ? { name: 'speechmatics', fn: () => synthesizeSpeechmatics(clean) } :
    lang === 'si' ? { name: 'azure', fn: () => synthesizeAzure(clean, AZURE_SI_VOICE, 'si-LK', AZURE_SI_RATE) } :
    lang === 'ta' ? { name: 'azure', fn: () => synthesizeAzure(clean, AZURE_TA_VOICE, 'ta-LK', AZURE_TA_RATE) } :
    null;

  if (fastAttempt) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
    if (remaining >= 2_000) {
      const timeout = Math.min(FAST_PROVIDER_TIMEOUT_MS, remaining);
      LOG.info(`Trying ${fastAttempt.name} (lang=${lang}) with ${timeout}ms timeout`);
      try {
        wavBuffer = await withTimeout(fastAttempt.fn(), timeout);
        source = fastAttempt.name;
        LOG.info(`${fastAttempt.name} succeeded in ${Date.now() - start}ms`);
      } catch (err) {
        const msg = (err as Error).message || String(err);
        const cause = (err as { cause?: unknown })?.cause;
        LOG.warn(`${fastAttempt.name} failed: ${msg}`, cause ? `cause: ${String(cause)}` : '');
      }
    }
  }

  // Gemini fallback only applies to si/ta (and the sl/tl direct path above).
  // English intentionally has no server fallback — see note above.
  if (!wavBuffer && lang !== 'en') {
    const result = await runGeminiChain(clean, TOTAL_BUDGET_MS, start);
    if (result) { wavBuffer = result; source = 'gemini'; }
  }

  if (!wavBuffer) {
    LOG.warn(`No server-side audio produced for lang=${lang} — client should fall back locally`);
    return NextResponse.json({ error: 'Voice reply unavailable.' }, { status: 503 });
  }

  LOG.info(`Done in ${Date.now() - start}ms via ${source}`);
  return new NextResponse(new Uint8Array(wavBuffer), {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(wavBuffer.length),
      'X-Tara-TTS-Source': source,
    },
  });
}