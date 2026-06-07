import OpenAI from 'openai';
import { NextRequest } from 'next/server';

const ai = new OpenAI({
  baseURL: 'https://api.aimlapi.com/v1',
  apiKey: process.env.AIML_API_KEY,
});

const MODEL = 'anthropic/claude-sonnet-4';

const SYSTEM_PROMPT = `You are TARA (The AI Retail Agent), a friendly multilingual shopping assistant for Kapruka, Sri Lanka's leading e-commerce platform.

You help customers find products, compare prices, and make purchasing decisions. You respond in the same language the user writes in — Sinhala (සිංහල), Tamil (தமிழ்), Sri Lankan English/Tok Pisin slang, or standard English.

When a user asks about products, extract a clean search query and output it in a special tag at the END of your message:
<search_query>the product search term</search_query>

Guidelines:
- Be warm, helpful, and culturally aware of Sri Lankan context
- Mention prices in LKR (Sri Lankan Rupees)
- If the user writes in Sinhala, respond in Sinhala
- If the user writes in Tamil, respond in Tamil  
- If the user uses Sri Lankan slang (machang, aiyo, oneda, la), match that casual energy
- Keep responses concise and friendly
- When recommending products, let the search results speak for themselves`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const stream = await ai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    max_tokens: 1024,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        console.error('Stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
