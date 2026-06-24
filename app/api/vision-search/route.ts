import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MAX_B64 = 2.5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64 || !mimeType)
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  if (imageBase64.length > MAX_B64)
    return NextResponse.json({ error: 'Image too large (max 2 MB)' }, { status: 413 });

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(mimeType))
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });

  /* Lazy-init client — avoids module-level credential error at build time */
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey:  process.env.AIML_API_KEY ?? '',
    baseURL: 'https://api.aimlapi.com/v1',
  });

  try {
    const completion = await client.chat.completions.create({
      model: 'google/gemini-3-5-flash',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: `You are a product-search assistant for Kapruka, a Sri Lankan e-commerce platform.
Identify the main product in this image.
Respond ONLY with valid JSON (no markdown, no backticks):
{"query":"<2–5 word search query for Kapruka>","description":"<one-sentence description>","category":"<flowers|cakes|gifts|electronics|fashion|groceries|books|toys|jewellery|chocolates|other>"}` },
        ],
      }],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed: { query: string; description: string; category: string };
    try { parsed = JSON.parse(clean); }
    catch {
      const qm = clean.match(/"query"\s*:\s*"([^"]+)"/);
      const dm = clean.match(/"description"\s*:\s*"([^"]+)"/);
      parsed = { query: qm?.[1] ?? 'gift', description: dm?.[1] ?? raw.slice(0, 80), category: 'other' };
    }
    return NextResponse.json({ query: parsed.query || 'gift', description: parsed.description || '', category: parsed.category || 'other' });
  } catch (err) {
    console.error('vision-search error:', err);
    return NextResponse.json({ error: 'Vision analysis failed' }, { status: 500 });
  }
}
