# TARA ✦ The AI Retail Agent

> **Kapruka Agent Challenge submission** — Built on Kapruka.lk, Sri Lanka's leading online shopping platform.

**Live demo:** [tara-green.vercel.app](https://tara-green.vercel.app)

---

## What is TARA?

TARA is a multilingual AI shopping agent that replaces the traditional Kapruka website experience with a warm, conversational interface. Instead of browsing menus and filling forms, customers just talk — in any of 5 Sri Lankan languages — and TARA handles everything from product discovery to checkout.

The goal: reduce a 7-minute order to under 2 minutes, while feeling like shopping with a knowledgeable friend.

---

## Key features

### 🌐 5-language support
Auto-detects language from first message using Unicode scripts and a word-scoring system across ~135 Singlish + Tanglish keyword tokens. No UI toggle needed.

| Language | Detection | Model |
|---|---|---|
| English | Default fallback | claude-sonnet-4.6 |
| Sinhala (සිංහල) | Unicode U+0D80–U+0DFF | claude-sonnet-4.6 |
| Singlish | Word scoring (~55 tokens) | claude-sonnet-4.6 |
| Tamil (தமிழ்) | Unicode U+0B80–U+0BFF | gemini-3-1-pro-preview |
| Tanglish | Word scoring (~80 tokens) | gemini-3-1-pro-preview |

Detection is sticky — order numbers, product names, and short replies don't reset the language mid-conversation.

### 🛍️ Natural language checkout
Type delivery details in any format and TARA fills the entire checkout form automatically:

```
"Send birthday cake to Priya at 23 Galle Road Colombo 7,
 her phone is 0771234567, deliver tomorrow, House, shanu@gmail.com"
```

TARA parses: recipient name + phone, city (normalized to "Colombo 07"), street address, delivery date, location type, email, and occasion — then opens the pre-filled cart drawer.

### 🎁 Gift chain upselling
TARA builds gift bundles naturally across 8 product pair chains:

```
User: "show me roses"
TARA: Shows roses + "Want chocolates to go with it?"
User: "yes"
TARA: Shows chocolates + "Should I find a greeting card to complete the gift?"
User: "ok"
TARA: Shows cards → chain ends
```

Chains run for 2 follow-up steps. Recognises affirmatives in all 5 languages (awa/ஆமா/aama/ඔව்).

### 📅 Occasion awareness
System prompt is injected with today's date and the current month's occasion hint at request time. In June, TARA proactively mentions Father's Day when gifting comes up. 8 occasions covered.

### 🔍 Smart 3-tier search
1. **TIER-1**: Full params (keyword + category + price filters)
2. **TIER-2**: Drop category, keep keyword — handles MCP quirks where category filter returns nothing
3. **TIER-3**: Single broad keyword retry

Cakes and flowers always skip to TIER-2 (MCP category filter doesn't work for these).

### 📸 Vision search
Paste or upload any image — TARA uses Gemini Vision (gemini-3-5-flash) to extract a product search query and finds matching items on Kapruka.

### 👍 / 👎 Quality feedback loop
Every TARA response has a thumbs-up / thumbs-down pill. Thumbs-down opens a modal (7 categories + free text), submits to `/api/feedback`, and appends a structured entry to `mistakes.md` for developer debugging.

### 📦 Order history
All orders saved to `localStorage` as a full array (up to 20 entries). The History panel in the sidebar shows collapsible order rows with ID, date, city, recipient, and item images. Reorder in one tap.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Next.js)              │
│  ChatPanel ← → ProductPanel ← → CartDrawer     │
│       ↕              ↕                          │
│  app/api/chat    app/api/search    app/api/*    │
└────────┬────────────────┬────────────────┬──────┘
         │                │                │
    AIML API         Kapruka MCP      /api/img proxy
  (claude / gemini)  (7 MCP tools)   (image CDN relay)
```

### API routes

| Route | Purpose |
|---|---|
| `/api/chat` | Streaming AI chat, lang routing, upsell, checkout_fill tag |
| `/api/search` | 3-tier product search with AI validator |
| `/api/product` | Single product details + image gallery |
| `/api/product-ai` | AI product summary + Ask AI Q&A |
| `/api/checkout` | 3-step order: city validate → delivery check → create order |
| `/api/validate-delivery` | Fuzzy city match + delivery date pre-check |
| `/api/track` | Order tracking by order number |
| `/api/gift-message` | AI-generated gift message (2 variants) |
| `/api/feedback` | 👎 issue reports → mistakes.md |
| `/api/img` | Image proxy (Kapruka CDN requires Referer header) |
| `/api/vision-search` | Gemini image → search query |
| `/api/categories` | Live category tree (60-min cache) |

---

## Kapruka MCP tools used

All 7 tools wired, all with `response_format: 'json'`:

- `kapruka_search_products` — product search with filters
- `kapruka_get_product` — full product details + images
- `kapruka_list_categories` — category tree
- `kapruka_list_delivery_cities` — city fuzzy matching
- `kapruka_check_delivery` — date + city availability + perishable warnings
- `kapruka_create_order` — order placement
- `kapruka_track_order` — order status

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 (App Router, TypeScript strict) |
| Styling | Tailwind CSS v4 + custom Lumina design system |
| 3D / WebGL | Three.js r184 (splash screen sprite), custom GLSL shaders |
| AI models | claude-sonnet-4.6 + gemini-3-1-pro-preview via AIML API |
| Shopping data | Kapruka MCP (7 tools) |
| Deployment | Vercel |

---

## Design system — Lumina palette

```css
--c-background:           #151024   /* deepest base */
--c-surface-container:    #221c31   /* TARA bubbles */
--c-primary:              #d7baff   /* lavender accents */
--c-primary-container:    #bd93f9   /* user bubbles, buttons */
--c-secondary:            #c5cd65   /* yellow-green prices */
--c-on-surface:           #e8defb   /* body text */
```

Fonts: Manrope (headings) + Hanken Grotesk (body). No external icon fonts — all icons are inline SVG from `components/Icons.tsx`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `AIML_API_KEY` | ✅ | AIML API key for claude-sonnet-4.6 + gemini-3.1-pro |
| `MCP_URL` | ✅ | Kapruka MCP endpoint |
| `GEMINI_API_KEY` | ✅ | GEMINI API (Google AI Studio) key for vision search |

---

## Running locally

```bash
git clone https://github.com/shanujans/tara
cd tara
npm install
cp .env.example .env.local   # add your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Chrome extension

The `chrome-extension/` folder contains a content script that injects TARA into kapruka.com as a floating assistant. Load it via `chrome://extensions` → Developer mode → Load unpacked.

---

## Embed / widget

- `/widget` — embeddable iframe widget
- `/embed-demo` — demo page showing the widget integration

---

## Feedback & quality loop

Every 👎 report from users is saved to `mistakes.md` with:
- Category (Wrong products / Wrong language / Didn't understand / etc.)
- The exact TARA response that triggered it
- Full conversation context (last 4 messages)
- Timestamp and detected language

This file is the debugging foundation for continuous improvement.

---

*Built for GMEU6 — Kapruka AI Agent Challenge*