/**
 * app/api/chat/route.ts
 *
 * Agentic chat endpoint — AIML API only (OpenAI-compatible).
 * Drives the full Kapruka order flow via MCP tool calls.
 *
 * SSE event stream to ChatPanel:
 *   data: {"t":"text",     "v":"Hello…"}      ← text delta
 *   data: {"t":"products", "v":[…]}           ← product cards
 *   data: {"t":"order",    "v":{url,…}}       ← pay link + order details
 *   data: {"t":"done"}                         ← stream complete
 *   data: {"t":"error",    "v":"…"}            ← recoverable error
 */

import { NextRequest } from 'next/server';
import OpenAI          from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall }
  from 'openai/resources/chat/completions';
import { mcp }                            from '@/lib/mcp';
import { KAPRUKA_TOOLS, buildSystemPrompt } from '@/lib/kapruka-tools';

export const runtime     = 'nodejs';
export const maxDuration = 60;

// AIML API — OpenAI-compatible endpoint
const ai = new OpenAI({
  apiKey:  process.env.AIML_API_KEY ?? '',
  baseURL: 'https://api.aimlapi.com/v1',
});

// Model string as used on AIML API
const MODEL = process.env.AIML_MODEL ?? 'anthropic/claude-sonnet-4.5';

// ── Helpers ───────────────────────────────────────────────────────────────────

const enc    = new TextEncoder();
const sse    = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);

// ── Execute a single MCP tool call ───────────────────────────────────────────

async function runTool(
  name: string,
  args: Record<string, unknown>,
  emit: (chunk: Uint8Array) => void,
): Promise<string> {
  try {
    switch (name) {

      case 'kapruka_search_products': {
        const results = await mcp.searchProducts(args as Parameters<typeof mcp.searchProducts>[0]);
        // Emit product cards immediately so the UI renders while Claude narrates
        emit(sse({ t: 'products', v: results }));
        const count = Array.isArray(results) ? results.length : 0;
        return JSON.stringify({ found: count, products: results });
      }

      case 'kapruka_get_product':
        return JSON.stringify(
          await mcp.getProduct(args.product_id as string, args.currency as string | undefined)
        );

      case 'kapruka_list_categories':
        return JSON.stringify(await mcp.listCategories(args.depth as number | undefined));

      case 'kapruka_list_delivery_cities':
        return JSON.stringify(
          await mcp.listDeliveryCities(args.query as string, args.limit as number | undefined)
        );

      case 'kapruka_check_delivery':
        return JSON.stringify(
          await mcp.checkDelivery(args as Parameters<typeof mcp.checkDelivery>[0])
        );

      case 'kapruka_create_order': {
        const order = await mcp.createOrder(args as Parameters<typeof mcp.createOrder>[0]);
        // Emit order event so ChatPanel can render a dedicated pay-link card
        emit(sse({ t: 'order', v: order }));
        return JSON.stringify(order);
      }

      case 'kapruka_track_order':
        return JSON.stringify(await mcp.trackOrder(args.order_number as string));

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[TARA] Tool "${name}" failed:`, msg);
    // Return the error to Claude so it can respond gracefully
    return JSON.stringify({ error: msg });
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as {
    messages: ChatCompletionMessageParam[];
  };

  const stream = new ReadableStream({
    async start(controller) {
      const emit  = (chunk: Uint8Array) => controller.enqueue(chunk);

      try {
        // ── Agentic loop ──────────────────────────────────────────────────
        // Claude decides which tools to call; we execute them against the
        // Kapruka MCP and feed results back. Loop until Claude stops calling tools.

        let loopMessages: ChatCompletionMessageParam[] = [
          { role: 'system', content: buildSystemPrompt() },
          ...messages,
        ];

        const MAX_ROUNDS = 8;

        for (let round = 0; round < MAX_ROUNDS; round++) {

          // Non-streaming request so we can handle tool calls cleanly
          const response = await ai.chat.completions.create({
            model:       MODEL,
            messages:    loopMessages,
            tools:       KAPRUKA_TOOLS,
            tool_choice: 'auto',
            max_tokens:  1024,
            stream:      false,
          });

          const choice     = response.choices[0];
          const message    = choice.message;
          const toolCalls  = message.tool_calls ?? [];
          const textContent = message.content ?? '';

          // Stream any text Claude produced this round word-by-word
          if (textContent) {
            for (const word of textContent.split(/(\s+)/)) {
              emit(sse({ t: 'text', v: word }));
            }
          }

          // If no tool calls, Claude is done
          if (toolCalls.length === 0 || choice.finish_reason === 'stop') break;

          // Execute all tool calls in parallel
          const toolResults = await Promise.all(
            toolCalls.map(async (tc: ChatCompletionMessageToolCall) => {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(tc.function.arguments); } catch { /* ok */ }

              const result = await runTool(tc.function.name, args, emit);

              return {
                role:         'tool' as const,
                tool_call_id: tc.id,
                content:      result,
              };
            }),
          );

          // Feed Claude the tool results for the next iteration
          loopMessages = [
            ...loopMessages,
            { role: 'assistant' as const, content: message.content, tool_calls: toolCalls },
            ...toolResults,
          ];
        }

        emit(sse({ t: 'done' }));

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        console.error('[TARA] Chat error:', msg);
        emit(sse({ t: 'error', v: msg }));
        emit(sse({ t: 'done' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
