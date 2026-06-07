import OpenAI from 'openai';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function detectLang(text: string): 'si'|'ta'|'tl'|'en' {
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/\b(machang|machan|aiyo|oneda|aney|la$|ne\b)\b/i.test(text)) return 'tl';
  return 'en';
}

async function mcpSearch(query: string) {
  try {
    const r = await fetch(process.env.MCP_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'search_products', params: { query, limit: 8 } }),
    });
    const data = await r.json();
    return (data.products || data.results || data.data || []) as Record<string, unknown>[];
  } catch { return []; }
}

function scoreProduct(p: Record<string, unknown>, budget?: number) {
  const relevance = Number(p.relevance ?? 0.7);
  const rating    = Math.min(Number(p.rating ?? 3.5) / 5, 1);
  const speed     = Number(p.delivery_days ?? 3) <= 2 ? 1 : 0.5;
  const price     = Number(p.price ?? 0);
  const budgetFit = budget ? Math.max(0, 1 - Math.abs(price - budget) / budget) : 0.7;
  return (relevance * 0.4) + (budgetFit * 0.3) + (rating * 0.2) + (speed * 0.1);
}

async function quantumSearch(primary: string, alternative: string, creative: string, budget?: number) {
  const [r1, r2, r3] = await Promise.all([
    mcpSearch(primary), mcpSearch(alternative), mcpSearch(creative),
  ]);
  const seen = new Set<string>();
  const merged = [...r1, ...r2, ...r3].filter(p => {
    const id = String(p.id ?? p.product_id ?? '');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return merged
    .map(p => ({ ...p, _score: scoreProduct(p, budget) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);
}

const langPrompts = {
  si: 'Reply fully in Sinhala. Be warm like a helpful younger sibling (malli/nangi).',
  ta: 'Reply fully in Tamil. Be warm like a trusted elder (anna/akka).',
  tl: 'Reply in casual Tanglish — natural Sri Lankan English + local slang mix.',
  en: 'Reply in friendly English.',
};

export async function POST(req: NextRequest) {
  // Temporary debug check
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

  const qMatch = fullText.match(/<quantum_search primary="([^"]+)" alt="([^"]+)" creative="([^"]+)"(?:\s+budget="(\d+)")?/);
  let products: Record<string, unknown>[] = [];
  let cleanedText = fullText;

  if (qMatch) {
    const [, primary, alternative, creative, budget] = qMatch;
    products = await quantumSearch(primary, alternative, creative, budget ? Number(budget) : undefined);
    cleanedText = fullText.replace(qMatch[0], '').trim();
  }

  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Detected-Lang': lang,
  });
  if (products.length) headers.set('X-Products', JSON.stringify(products));

  return new Response(cleanedText, { headers });
}