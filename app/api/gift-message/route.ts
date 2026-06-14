import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';

// ASCII-safe fallback templates when AI call fails
const FALLBACKS: Record<string, string[]> = {
  Birthday:    ['Happy birthday! Hope your special day is filled with joy and laughter.', 'Wishing you a wonderful birthday and a year full of happiness!'],
  Anniversary: ['Congratulations on your special day! Wishing you many more wonderful years together.', 'Happy anniversary! May your love continue to grow stronger each day.'],
  Wedding:     ['Congratulations on your wedding! Wishing you a lifetime of love and happiness.', 'Best wishes on this beautiful day — may your journey together be wonderful!'],
  general:     ['Sending you warm wishes and lots of love!', 'Hope this brings a big smile to your face. Thinking of you!'],
};

function getFallback(occasion: string): string {
  const key = Object.keys(FALLBACKS).find(k => k.toLowerCase() === occasion?.toLowerCase()) ?? 'general';
  const opts = FALLBACKS[key];
  return opts[Math.floor(Math.random() * opts.length)];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ message: getFallback('general') }, { status: 429 });
  }

  if (!process.env.AIML_API_KEY) {
    return NextResponse.json({ message: getFallback('general') });
  }

  let body: { occasion?: string; lang?: string; items?: { name: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ message: getFallback('general') }); }

  const { occasion = '', lang = 'en', items = [] } = body;
  const safeOccasion   = sanitizeInput(String(occasion)).slice(0, 50);
  const productNames   = items
    .slice(0, 5)
    .map(i => sanitizeInput(String(i?.name ?? '')).slice(0, 60))
    .filter(Boolean)
    .join(', ') || 'a gift';

  // Kapruka's personal message field is Latin-1 — Unicode (Tamil/Sinhala) becomes mojibake.
  // Always generate ASCII-safe text regardless of UI language.
  const toneMap: Record<string, string> = {
    si: 'Warm Sihalish (romanized Sinhala + English). Example: "Bohoma sthuthi! Subha pathum!"',
    sl: 'Warm Sihalish (romanized Sinhala + English). Example: "Oyage special dawasakata subha pathum!"',
    ta: 'Warm English with Sri Lankan warmth.',
    tl: 'Casual Tanglish. Example: "Aiyo machang, happy birthday la! Hope you love it neh!"',
    en: 'Warm friendly English.',
  };
  const tone = toneMap[lang] ?? toneMap.en;

  try {
    const ai = new OpenAI({ baseURL: 'https://api.aimlapi.com/v1', apiKey: process.env.AIML_API_KEY });

    const res = await ai.chat.completions.create({
      model:      'google/gemini-3-5-flash',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          `Write a short gift message (1-2 sentences, max 80 words) in this style: ${tone}`,
          `Items being gifted: ${productNames}`,
          safeOccasion ? `Occasion: ${safeOccasion}` : 'Occasion: general gift',
          'STRICT RULE: Use ONLY printable ASCII characters (a-z A-Z 0-9 spaces punctuation).',
          'NO Tamil letters, NO Sinhala Unicode, NO emoji, NO accented characters.',
          'Return only the message text — no quotes, no labels.',
        ].join('\n'),
      }],
    });

    let msg = (res.choices?.[0]?.message?.content ?? '').trim();

    // Strip any non-ASCII that slipped through (safety net)
    msg = msg.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();

    // If AI returned empty/garbage after stripping, use template
    if (!msg || msg.length < 10) msg = getFallback(safeOccasion || 'general');

    return NextResponse.json({ message: msg.slice(0, 250) });
  } catch (err) {
    console.error('gift-message AI error:', err);
    // Return a working template — never leave the user with a broken button
    return NextResponse.json({ message: getFallback(safeOccasion || 'general') });
  }
}
