import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per IP per 60 seconds
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ message: '' }, { status: 429 });
  }

  const ai = new OpenAI({
    baseURL: 'https://api.aimlapi.com/v1',
    apiKey: process.env.AIML_API_KEY,
  });

  const { occasion, lang, items } = await req.json();

  const langInstr = (
    {
      si: 'Write only in Sinhala. Warm and heartfelt.',
      ta: 'Write only in Tamil. Warm and heartfelt.',
      tl: 'Write in casual Sri Lankan English slang. Friendly.',
      en: 'Write in warm friendly English.',
    } as Record<string, string>
  )[lang] ?? 'Write in warm friendly English.';

  // Sanitise and limit product list to 10 items, each name max 50 chars
  const productNames = (items as { name: string }[])
    .slice(0, 10)
    .map(i => sanitizeInput(i.name).slice(0, 50))
    .join(', ');

  const safeOccasion = sanitizeInput(String(occasion ?? '')).slice(0, 50);

  const res = await ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4',
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: `${langInstr} Write a short gift message (max 2 sentences) for someone sending: ${productNames}. Occasion: ${safeOccasion || 'general gift'}. Only the message text, nothing else.`,
      },
    ],
  });

  const message = res.choices[0]?.message?.content?.trim() ?? '';
  return NextResponse.json({ message: message.slice(0, 300) });
}