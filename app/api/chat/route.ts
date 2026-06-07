import OpenAI from 'openai';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function detectLang(text: string): 'si'|'ta'|'tl'|'en' {
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/\b(machang|machan|aiyo|oneda|aney|la$|ne\b)\b/i.test(text)) return 'tl';
  return 'en';
}

const langPrompts = {
  si: 'Reply fully in Sinhala. Be warm like a helpful younger sibling (malli/nangi).',
  ta: 'Reply fully in Tamil. Be warm like a trusted elder (anna/akka).',
  tl: 'Reply in casual Tanglish — natural Sri Lankan English + local slang mix.',
  en: 'Reply in friendly English.',
};

export async function POST(req: NextRequest) {
  if (!process.env.AIML_API_KEY) {
    return new Response('AIML_API_KEY not set', { status: 500 });
  }

  const ai = new OpenAI({ baseURL: 'https://api.aimlapi.com/v1', apiKey: process.env.AIML_API_KEY });
  const MODEL = 'anthropic/claude-sonnet-4';

  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  const lang = detectLang(lastUser?.content ?? '');

  const systemPrompt = `You are TARA — The AI Retail Agent for Kapruka.lk.
${langPrompts[lang]}
Help users find products, build carts, add gift messages, pick delivery dates, and checkout.
TARA's primary user is an everyday Sri Lankan shopper buying for themselves — groceries, electronics, fashion, home essentials. Gifting is one mode, not the only one. Always read the emotional context of the message. If someone is stressed, heartbroken, celebrating, or in a rush — acknowledge it first, then shop. Have opinions. Say "trust me, get this one" not "here are your options." Speak like a smart Sri Lankan friend, not a search engine.
Always show products as visual cards, never as plain text lists.
When a user asks about products, output a search tag at the END of your message: <search_query>term</search_query>
Tools: search_products, quote_delivery, create_order via Kapruka MCP.`;

  const completion = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 1024,
  });

  let fullText = '';
  for await (const chunk of completion) {
    fullText += chunk.choices[0]?.delta?.content ?? '';
  }

  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Detected-Lang': lang,
  });

  return new Response(fullText, { headers });
}