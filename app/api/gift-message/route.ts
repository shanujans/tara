import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new OpenAI({ baseURL: 'https://api.aimlapi.com/v1', apiKey: process.env.AIML_API_KEY });

export async function POST(req: NextRequest) {
  const { occasion, lang, items } = await req.json();

  const langInstr = {
    si: 'Write only in Sinhala. Warm and heartfelt.',
    ta: 'Write only in Tamil. Warm and heartfelt.',
    tl: 'Write in casual Sri Lankan English slang. Friendly.',
    en: 'Write in warm friendly English.',
  }[lang as string] ?? 'Write in warm friendly English.';

  const productNames = (items as {name:string}[]).map(i => i.name).join(', ');

  const res = await ai.chat.completions.create({
    model: 'anthropic/claude-sonnet-4',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `${langInstr} Write a short gift message (max 2 sentences) for someone sending: ${productNames}. Occasion: ${occasion || 'general gift'}. Only the message text, nothing else.`,
    }],
  });

  const message = res.choices[0]?.message?.content?.trim() ?? '';
  return NextResponse.json({ message });
}