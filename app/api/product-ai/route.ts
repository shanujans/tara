import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, sanitizeInput } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface Msg { role: 'user' | 'assistant'; content: string; }
interface Prod { name: string; price: number; description?: string; category?: string; shipping?: string; }

// ---------- Google Gemini (Primary) ----------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const GEMINI_TIMEOUT_MS = 10_000;

// ---------- ZenMux (Fallback) ----------
const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions';
const ZENMUX_MODEL = process.env.ZENMUX_PRODUCT_AI_MODEL ?? 'z-ai/glm-4.7-flash-free';

const ZENMUX_MODEL_CHAIN = Array.from(new Set([
  ZENMUX_MODEL,
  'stepfun/step-3.7-flash-free',
  'z-ai/glm-4.6v-flash-free',
  process.env.ZENMUX_FALLBACK_MODEL,
].filter((m): m is string => Boolean(m))));

const ZENMUX_TIMEOUT_MS = 10_000;

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:PRODUCT-AI]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:PRODUCT-AI] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:PRODUCT-AI] ❌', ...a),
};

// ---------- Static fallback summary (always English) ----------
function generateFallbackSummary(product: Prod): string {
  const price = `LKR ${product.price.toLocaleString()}`;
  const desc = product.description ? product.description.slice(0, 200) : '';
  return [
    `✨ ${product.name}`,
    `📦 ${desc || 'A quality product from Kapruka.'}`,
    `💡 Priced at ${price}.`,
    product.shipping ? `🚚 Shipping: ${product.shipping}` : '',
    '🎁 Perfect for gifting or personal use.',
  ].filter(Boolean).join('\n');
}

// ---------- Build system prompt with improved language instruction ----------
const SYSTEM = (p: Prod, type: 'summary' | 'chat') => {
  const desc = (p.description || 'Premium Kapruka product.');
  const truncatedDesc = desc.length > 500 ? desc.slice(0, 500) + '…' : desc;

  return `You are TARA, a product assistant for Kapruka.

${type === 'summary' ? 'Write a helpful product summary (max 5 sentences).' : 'Live Q&A (max 3 sentences).'}

PRODUCT:
- Name: ${p.name}
- Price: LKR ${p.price.toLocaleString()}
- Category: ${p.category || 'General'}
- Description: ${truncatedDesc}
${p.shipping ? `- Shipping: ${p.shipping}` : ''}

🔤 **LANGUAGE RULE – HIGHEST PRIORITY**
You MUST respond in the EXACT SAME LANGUAGE as the user's LAST question.

- Look at the last user message in the conversation history.
- If it's pure English → respond in English.
- If it's pure Sinhala (සිංහල අකුරු) → respond in Sinhala script.
- If it's pure Tamil (தமிழ் எழுத்துகள்) → respond in Tamil script.
- If it's Sinhalish (Sinhala words typed using English letters, e.g. "meka price eka?", "aye discount kiwa") → respond in Sinhalish (use English letters but keep Sinhala phrasing).
- If it's Tanglish (Tamil words typed using English letters, e.g. "evlo discount?") → respond in Tanglish.

EXAMPLES:
- User: "meka price eka?" → You: "me laptop eka price LKR 244,000. current offers nathi."
- User: "මේකේ වට්ටමක් තියෙනවද?" → You: "මේ ලැප්ටොප් එකේ වට්ටමක් නැහැ, නමුත් අපිගේ website එක බලන්න."
- User: "What's the warranty?" → You: "This laptop comes with a 1-year warranty."

If you are unsure, default to English, but always try to match the user's script.

RULES:
1. Only discuss this product.
2. No politics/medical/legal/personal questions.
3. No competitor comparisons.
4. Be warm and concise.
${type === 'summary' ? 'Format: ✨ highlight, 📦 what it is, 💡 key benefit, 🎁 gift suitability.' : ''}`;
};

// ---------- Gemini call ----------
async function callGemini(model: string, systemPrompt: string, messages: Msg[], maxTokens: number, apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ---------- ZenMux call ----------
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

// ---------- Main POST handler ----------
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'local';
  if (!rateLimit(`product-ai:${ip}`, 80, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const body = await req.json();
  const { product, messages, type = 'chat' } = body as {
    product: Prod;
    messages: Msg[];
    type: 'summary' | 'chat';
  };

  if (!product?.name) return NextResponse.json({ error: 'Missing product' }, { status: 400 });

  if (!GEMINI_API_KEY) {
    LOG.error('GEMINI_API_KEY is not set');
    return NextResponse.json({ error: 'AI request misconfigured' }, { status: 500 });
  }

  const zenmuxApiKey = process.env.ZENMUX_API_KEY;
  if (!zenmuxApiKey) {
    LOG.warn('ZENMUX_API_KEY is not set – fallback will not work');
  }

  const safeMessages: Msg[] = (messages || []).slice(-8).map(m => ({
    role: m.role,
    content: sanitizeInput(m.content).slice(0, 500),
  }));

  if (type === 'summary') {
    safeMessages.push({ role: 'user', content: 'Give me a helpful product summary.' });
  }

  const maxTokens = type === 'summary' ? 1536 : 450;
  const systemPrompt = SYSTEM(product, type);

  let finalAnswer: string | null = null;
  let modelUsed = '';
  let lastStatus = 500;
  let lastErrBody = 'No models tried';
  let lastWasTimeout = false;

  // ----- 1. Try Gemini (Primary) -----
  try {
    LOG.info(`Attempting Gemini (${GEMINI_MODEL})`);
    const geminiAttempt = await callGemini(GEMINI_MODEL, systemPrompt, safeMessages, maxTokens, GEMINI_API_KEY!);

    if (geminiAttempt.ok) {
      const data = await geminiAttempt.json().catch(() => null);
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (content) {
        LOG.info(`✅ Gemini ${GEMINI_MODEL} succeeded with ${content.length} chars`);
        finalAnswer = content;
        modelUsed = `Gemini (${GEMINI_MODEL})`;
      } else {
        LOG.warn('Gemini returned empty content – falling back to ZenMux');
        lastStatus = 200;
        lastErrBody = 'Empty content';
      }
    } else {
      lastStatus = geminiAttempt.status;
      lastErrBody = await geminiAttempt.text().catch(() => '');
      lastWasTimeout = false;
      LOG.warn(`Gemini failed (${geminiAttempt.status}): ${lastErrBody.slice(0, 300)} – falling back to ZenMux`);
      const isTransient = geminiAttempt.status === 429 || geminiAttempt.status >= 500;
      if (!isTransient) {
        LOG.warn('Gemini returned a non‑transient error – still attempting ZenMux fallback');
      }
    }
  } catch (geminiErr) {
    if (geminiErr instanceof Error && geminiErr.name === 'AbortError') {
      lastWasTimeout = true;
      LOG.warn(`Gemini timed out after ${GEMINI_TIMEOUT_MS}ms – falling back to ZenMux`);
    } else {
      LOG.error('Gemini error:', geminiErr);
      lastErrBody = String(geminiErr);
    }
  }

  // ----- 2. If Gemini failed, try ZenMux models -----
  if (!finalAnswer && zenmuxApiKey) {
    LOG.info('Falling back to ZenMux models');
    for (const model of ZENMUX_MODEL_CHAIN) {
      try {
        LOG.info(`Attempting ZenMux model: ${model}`);
        const attempt = await callZenMux(model, systemPrompt, safeMessages, maxTokens, zenmuxApiKey);

        if (attempt.ok) {
          const data = await attempt.json().catch(() => null);
          const content = data?.choices?.[0]?.message?.content?.trim() || '';
          const finishReason = data?.choices?.[0]?.finish_reason;

          if (content && finishReason === 'stop') {
            LOG.info(`✅ ZenMux ${model} succeeded with ${content.length} chars`);
            finalAnswer = content;
            modelUsed = model;
            break;
          }

          LOG.warn(
            `${model} returned OK but content ${content ? 'is truncated' : 'empty'} ` +
            `(finish_reason: ${finishReason}, tokens: ${data?.usage?.completion_tokens ?? '?'}). Moving to next.`
          );
          lastStatus = 200;
          lastErrBody = `Empty/truncated (${finishReason})`;
          continue;
        }

        lastStatus = attempt.status;
        lastErrBody = await attempt.text().catch(() => '');
        lastWasTimeout = false;
        LOG.warn(`${model} failed (${attempt.status}): ${lastErrBody.slice(0, 300)}`);

        const isTransient = attempt.status === 429 || attempt.status >= 500;
        if (!isTransient) break;
      } catch (attemptErr) {
        if (attemptErr instanceof Error && attemptErr.name === 'AbortError') {
          lastWasTimeout = true;
          LOG.warn(`${model} timed out after ${ZENMUX_TIMEOUT_MS}ms, trying next`);
          continue;
        }
        LOG.error(`Unexpected error from ${model}:`, attemptErr);
        throw attemptErr;
      }
    }
  } else if (!finalAnswer && !zenmuxApiKey) {
    LOG.warn('ZenMux API key missing – no fallback available');
  }

  // ----- 3. Return final answer or fallback -----
  if (finalAnswer) {
    LOG.info('Final model used:', modelUsed);
    return NextResponse.json({ answer: finalAnswer });
  }

  LOG.error('All models exhausted. Last status:', lastWasTimeout ? 'timeout' : lastStatus, lastErrBody);
  if (type === 'summary') {
    LOG.info('Returning static fallback summary (English)');
    return NextResponse.json({ answer: generateFallbackSummary(product) });
  }

  if (lastWasTimeout) {
    return NextResponse.json({ error: 'AI request timed out' }, { status: 504 });
  }
  if (lastStatus === 429) {
    return NextResponse.json(
      { error: "TARA's AI is getting a lot of requests right now — please try again in a moment." },
      { status: 429 }
    );
  }
  return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
}