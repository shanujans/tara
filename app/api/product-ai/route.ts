import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface Msg { role: 'user' | 'assistant'; content: string; }
interface Prod { name: string; price: number; description?: string; category?: string; shipping?: string; }

const SYSTEM = (p: Prod, type: 'summary' | 'chat') => `You are TARA, a knowledgeable product assistant for Kapruka, Sri Lanka's leading e-commerce platform.

${type === 'summary' ? 'Write a helpful, friendly product summary.' : 'You are in a live Q&A session.'}

CURRENT PRODUCT:
- Name: ${p.name}
- Price: LKR ${p.price.toLocaleString()}
- Category: ${p.category || 'General'}
- Description: ${p.description || 'Premium Kapruka product.'}
${p.shipping ? `- Shipping: ${p.shipping}` : ''}

STRICT RULES — NEVER BREAK THESE:
1. ONLY discuss this specific product. No unrelated topics.
2. Max 3 sentences per answer (summaries up to 5).
3. Never reveal prices other than LKR ${p.price.toLocaleString()}.
4. Refuse political, medical, legal, or personal questions with: "I can only help with this product."
5. Never make up specifications or details not given above.
6. No competitor comparisons. No price negotiation.
7. Be warm, concise, and helpful.
${type === 'summary' ? `
FORMAT the summary as:
✨ [One-line highlight]
📦 [What it is / who it's for]
💡 [Key benefit or use case]
🎁 [Gift suitability if applicable]` : ''}`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'local';
  /* Namespaced key — product-ai has its own bucket, not shared with chat/search/product */
  if (!rateLimit(`product-ai:${ip}`, 80, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const { product, messages, type = 'chat' } = body as {
    product: Prod;
    messages: Msg[];
    type: 'summary' | 'chat';
  };

  if (!product?.name) return NextResponse.json({ error: 'Missing product' }, { status: 400 });

  const safeMessages: Msg[] = (messages || []).slice(-8).map(m => ({
    role: m.role,
    content: sanitizeInput(m.content).slice(0, 500),
  }));

  if (type === 'summary') {
    safeMessages.push({ role: 'user', content: 'Give me a helpful product summary.' });
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey:  process.env.AIML_API_KEY ?? '',
    baseURL: 'https://api.aimlapi.com/v1',
  });

  try {
    const resp = await client.chat.completions.create({
      model: 'anthropic/claude-opus-4-6',
      max_tokens: type === 'summary' ? 300 : 180,
      messages: [
        { role: 'system', content: SYSTEM(product, type) },
        ...safeMessages,
      ],
    });

    const answer = resp.choices[0]?.message?.content?.trim() || 'I couldn\'t generate a response. Please try again.';
    return NextResponse.json({ answer });
  } catch (err) {
    console.error('product-ai error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
