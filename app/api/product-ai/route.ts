import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // give the fallback chain room to run past Vercel's 10s default

interface Msg { role: 'user' | 'assistant'; content: string; }
interface Prod { name: string; price: number; description?: string; category?: string; shipping?: string; }

/* ZenMux — OpenAI-compatible gateway. https://zenmux.ai/docs
   Default is ZenMux's free z-ai/glm-4.6v-flash-free — confirmed working.
   (anthropic/claude-sonnet-5-free hit a credits issue despite being listed
   free, so parked for now.) Override via env any time. */
const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions';
const ZENMUX_MODEL = process.env.ZENMUX_PRODUCT_AI_MODEL ?? 'z-ai/glm-4.6v-flash-free';
/* Free models get "too much traffic" 429s during peak load — that's not an
   error in our code, it's the shared pool being busy. Instead of failing the
   request outright, walk down a chain of models until one responds.

   Only these free models are actually available on this account:
     - z-ai/glm-4.6v-flash-free   (primary)
     - z-ai/glm-4.7-flash-free    (same provider pool as primary — still worth
                                    a shot, but won't help if z-ai itself is down)
     - stepfun/step-3.7-flash-free (different provider — best bet when z-ai
                                    is the one that's congested)
   google/gemini-3.1-flash-lite-image-free is excluded: it's an image
   generation model, not a text chat model, so it won't work for this route.
   Order below puts the different-provider option second for the best chance
   of dodging a z-ai-wide outage before falling back to the same pool again. */
const MODEL_CHAIN = Array.from(new Set([
  ZENMUX_MODEL,
  'stepfun/step-3.7-flash-free',
  'z-ai/glm-4.7-flash-free',
  process.env.ZENMUX_FALLBACK_MODEL, // optional, e.g. a paid model — unset by default, no surprise spend
].filter((m): m is string => Boolean(m))));
const ZENMUX_TIMEOUT_MS = 20_000; // fail fast per-attempt instead of hanging (was the cause of the 12.6s/no-response bug)

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:PRODUCT-AI]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:PRODUCT-AI] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:PRODUCT-AI] ❌', ...a),
};

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

/** Single ZenMux chat-completions call. Thrown errors carry `status` when it's an HTTP error. */
async function callZenMux(model: string, systemPrompt: string, messages: Msg[], maxTokens: number, apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ZENMUX_TIMEOUT_MS);

  try {
    const res = await fetch(ZENMUX_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // Reasoning models (GLM, etc.) default to thinking=on via ZenMux, which
        // can eat the entire max_tokens budget on invisible chain-of-thought and
        // leave nothing for the actual answer (finish_reason: "length", empty
        // content). We want fast, direct answers here, not chain-of-thought —
        // ignored harmlessly by models that don't support it.
        reasoning: { enabled: false },
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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

  const apiKey = process.env.ZENMUX_API_KEY;
  if (!apiKey) {
    LOG.error('ZENMUX_API_KEY is not set');
    return NextResponse.json({ error: 'AI request misconfigured' }, { status: 500 });
  }

  const safeMessages: Msg[] = (messages || []).slice(-8).map(m => ({
    role: m.role,
    content: sanitizeInput(m.content).slice(0, 500),
  }));

  if (type === 'summary') {
    safeMessages.push({ role: 'user', content: 'Give me a helpful product summary.' });
  }

  // GLM still spends some tokens on reasoning even with reasoning:{enabled:false}
  // for longer prompts (bigger product descriptions) — extra headroom here so the
  // visible answer doesn't get cut off (finish_reason: "length") before it's written.
  const maxTokens = type === 'summary' ? 700 : 450;
  const systemPrompt = SYSTEM(product, type);

  try {
    let res: Response | null = null;
    let modelUsed = '';
    let lastStatus = 500;
    let lastErrBody = '';
    let lastWasTimeout = false;

    for (const model of MODEL_CHAIN) {
      try {
        const attempt = await callZenMux(model, systemPrompt, safeMessages, maxTokens, apiKey);
        modelUsed = model;

        if (attempt.ok) { res = attempt; break; }

        lastStatus = attempt.status;
        lastErrBody = await attempt.text().catch(() => '');
        lastWasTimeout = false;
        LOG.warn(`${model} failed (${attempt.status}): ${lastErrBody.slice(0, 300)}`);

        const isTransient = attempt.status === 429 || attempt.status >= 500;
        if (!isTransient) break; // a real bug (bad auth, bad request) won't fix itself on another model
      } catch (attemptErr) {
        modelUsed = model;
        if (attemptErr instanceof Error && attemptErr.name === 'AbortError') {
          lastWasTimeout = true;
          LOG.warn(`${model} timed out after ${ZENMUX_TIMEOUT_MS}ms, trying next model in chain`);
          continue; // stuck model — move on rather than failing the whole request
        }
        throw attemptErr; // genuinely unexpected (network down, etc.) — bail out entirely
      }
    }

    if (!res) {
      LOG.error('all models in chain exhausted, last status:', lastWasTimeout ? 'timeout' : lastStatus, lastErrBody.slice(0, 500));
      if (lastWasTimeout) {
        return NextResponse.json({ error: 'AI request timed out' }, { status: 504 });
      }
      if (lastStatus === 429) {
        return NextResponse.json(
          { error: "TARA's AI is getting a lot of requests right now — please try again in a moment." },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    }

    const data = await res.json();
    LOG.info('model used:', modelUsed, '| finish_reason:', data?.choices?.[0]?.finish_reason, '| usage:', data?.usage);

    const answer = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!answer) {
      const reasoningTokens = data?.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      LOG.warn(
        `${modelUsed} returned empty content (finish_reason: ${data?.choices?.[0]?.finish_reason}). ` +
        `reasoning_tokens=${reasoningTokens} — model may be ignoring reasoning:{enabled:false} and needs ` +
        `more max_tokens headroom, or a non-reasoning model.`
      );
    }
    return NextResponse.json({ answer: answer || 'I couldn\'t generate a response. Please try again.' });
  } catch (err) {
    LOG.error('product-ai error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}