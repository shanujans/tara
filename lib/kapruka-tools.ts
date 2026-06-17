/**
 * lib/kapruka-tools.ts
 *
 * Tool definitions in OpenAI SDK format (used by AIML API).
 * Names match exactly what mcp.kapruka.com exposes.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  const now = new Date().toLocaleString('en-LK', {
    timeZone:  'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return `You are TARA (The AI Retail Agent) — a warm, clever, emotionally
intelligent Sri Lankan shopping companion for Kapruka.com, Sri Lanka's most
trusted online shopping platform.

## WHO YOU ARE
You are the customer's most helpful friend who happens to know the entire
Kapruka catalogue, every delivery cutoff, and every Sri Lankan occasion worth
celebrating. You are NOT a search bar. You are a personal shopping companion
with genuine personality.

## LANGUAGE — auto-detect and match exactly
- Sinhala (සිංහල): reply fully in Sinhala script — this is a BONUS SEPARATOR
- Tamil (தமிழ்): reply fully in Tamil
- Singlish / Tanglish: match their casual mixed style naturally
- English: warm and conversational, never robotic

## YOUR GOAL — GOLD STANDARD
Complete the ENTIRE shopping journey without the customer touching kapruka.com.
Never say "go to the website". Full flow:
1. Understand what they truly need
2. Search → kapruka_search_products
3. Show 2-3 options with prices (use kapruka_get_product for details if needed)
4. When customer chooses, check delivery → kapruka_check_delivery
5. Collect: recipient name, phone, address, city, delivery date
6. Confirm → kapruka_create_order → share the click-to-pay link
7. Warm closing message with order details

## PERSONALITY (this scores 15/100 — make it count)
- **Proactive**: suggest cake + flowers + a gift combo when someone says birthday
- **Think deeper**: "If I send flowers to her office, the delivery SMS spoils the
  surprise — should I send to your address so you can present them?"
- **Sri Lankan context**: mention Avurudu, Vesak, Poya delivery delays,
  outstation timing, same-day Colombo cutoffs (~12PM)
- **Price options**: budget / mid / premium unless they specify
- **Gifts**: always ask — direct delivery or to your address first?
- **Short and warm** — one paragraph max, then the question or products

## PAYMENT
kapruka_create_order returns a click-to-pay URL. Share it like:
"Here's your secure payment link — it's valid for 60 minutes: [url]"
No login needed, works on any browser.

## IMPORTANT
- Use tools silently — never say "I'm calling a tool now"
- Show products visually through the onProductsFound UI handler (the backend
  emits them as a products event automatically)
- For perishables (cakes, flowers) always run kapruka_check_delivery first

Current Sri Lanka time: ${now}`;
}

// ── Tool definitions — OpenAI SDK format ─────────────────────────────────────

export const KAPRUKA_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'kapruka_search_products',
      description:
        'Search the Kapruka catalogue by keyword. Use whenever the customer asks for a product, gift, or category. Always call this before suggesting anything.',
      parameters: {
        type: 'object',
        properties: {
          q:             { type: 'string',  description: 'Search keyword e.g. "chocolate birthday cake", "Samsung phone"' },
          category:      { type: 'string',  description: 'Optional category: Cakes, Flowers, Electronics, Groceries, Fashion, Gifts' },
          min_price:     { type: 'number',  description: 'Min price in LKR' },
          max_price:     { type: 'number',  description: 'Max price in LKR' },
          in_stock_only: { type: 'boolean', description: 'Only return in-stock items (default true)' },
          sort:          { type: 'string',  enum: ['relevance', 'price_asc', 'price_desc', 'newest'] },
          limit:         { type: 'number',  description: 'Max results (default 6, max 18)' },
        },
        required: ['q'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_get_product',
      description: 'Get full details, stock, variants, and images for a specific product by ID.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Kapruka product ID from search results' },
          currency:   { type: 'string', description: 'Price currency (default LKR)' },
        },
        required: ['product_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_list_categories',
      description: 'List top-level Kapruka categories. Use when the customer is browsing or unsure what category to search.',
      parameters: {
        type: 'object',
        properties: {
          depth: { type: 'number', description: 'Category depth (1 = top-level only)' },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_list_delivery_cities',
      description: 'Search for a valid Kapruka delivery city by name or local alias. Use to validate the customer\'s city before checking delivery or placing an order.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'City name in English, Sinhala, or Tamil e.g. "Kandy", "කොළඹ", "யாழ்ப்பாணம்"' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
        required: ['query'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_check_delivery',
      description:
        'Check if delivery is available to a city on a date. Returns the flat LKR delivery rate and a perishable warning for cakes/flowers. ALWAYS call this before kapruka_create_order.',
      parameters: {
        type: 'object',
        properties: {
          city:          { type: 'string', description: 'Validated city name from kapruka_list_delivery_cities' },
          delivery_date: { type: 'string', description: 'Requested delivery date YYYY-MM-DD' },
          product_id:    { type: 'string', description: 'Product ID (required for perishable check on cakes/flowers)' },
        },
        required: ['city', 'delivery_date'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_create_order',
      description:
        'Create a guest-checkout order. Returns a click-to-pay URL valid for 60 minutes. Call ONLY after collecting all delivery details and the customer confirms they want to proceed.',
      parameters: {
        type: 'object',
        properties: {
          cart: {
            type: 'array',
            description: 'Items in the order',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' },
                quantity:   { type: 'number' },
                variant:    { type: 'string', description: 'Optional variant e.g. "1kg", "Red"' },
              },
              required: ['product_id', 'quantity'],
            },
          },
          recipient: {
            type: 'object',
            description: 'Who receives the order',
            properties: {
              name:    { type: 'string' },
              phone:   { type: 'string', description: 'Sri Lankan mobile e.g. 0771234567' },
              address: { type: 'string', description: 'Street address' },
              city:    { type: 'string', description: 'Validated delivery city' },
            },
            required: ['name', 'phone', 'address', 'city'],
          },
          delivery: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'YYYY-MM-DD' },
            },
            required: ['date'],
          },
          sender: {
            type: 'object',
            description: 'Sender details for gift card (optional)',
            properties: {
              name:  { type: 'string' },
              phone: { type: 'string' },
            },
          },
          gift_message: { type: 'string', description: 'Message to print on gift card (optional)' },
          currency:     { type: 'string', description: 'Default LKR' },
        },
        required: ['cart', 'recipient', 'delivery'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'kapruka_track_order',
      description: 'Track the status of an existing Kapruka order by order number.',
      parameters: {
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'Kapruka order number from the confirmation email' },
        },
        required: ['order_number'],
      },
    },
  },
];
