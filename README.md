# TARA ✦ — The AI Retail Agent for Kapruka

TARA is a conversational AI shopping agent built on top of Kapruka.lk — Sri Lanka's largest e-commerce platform. Instead of the traditional 7-minute browse-filter-form workflow, TARA lets customers order anything on Kapruka in under 2 minutes through natural conversation — in English, Sinhala, Singlish, Tamil, or Tanglish. It runs as a standalone web app, an embeddable iframe widget, and a Chrome Extension that injects directly into kapruka.com.

---

## Live demos

| Link | Description |
|------|-------------|
| [tara-green.vercel.app](https://tara-green.vercel.app) | Full standalone app |
| [tara-green.vercel.app/embed-demo](https://tara-green.vercel.app/embed-demo) | Judge demo — widget embedded in mock Kapruka page |
| [tara-green.vercel.app/widget](https://tara-green.vercel.app/widget) | Embeddable iframe widget |

---

## What makes TARA different

### Gold standard: customer never needs to return to kapruka.com
TARA handles discovery, delivery checking, checkout, and order creation. The only redirect is to Kapruka's payment page — by design, not limitation.

### 7 minutes → under 2 minutes
From first message to order placed. TARA collects recipient details, checks delivery options, and creates the order inside the conversation.

### 5 languages — a true differentiator
Auto-detected from the first message. No language selection required.

| Code | Language | Detection method |
|------|----------|-----------------|
| `EN` | 🇬🇧 English | Default |
| `SI` / `සිං` | 🇱🇰 Sinhala script | Unicode U+0D80–U+0DFF |
| `SL` | 🇱🇰 Singlish (romanised Sinhala) | Keywords: mama, koheda, puluwan, hari, neda… |
| `TA` / `த` | 🇱🇰 Tamil script | Unicode U+0B80–U+0BFF |
| `TL` | 🇱🇰 Tanglish (Tamil-English mix) | Keywords: naan, romba, seri, thambi… |

### Human-like gifting personality
Before searching for any gift, TARA gives one creative, personal suggestion — not a product list. Examples:

- **Flowers for wife:** "Order them to YOUR address and hand-deliver — showing up at the door beats any courier."
- **Gift for boss:** "Safe: premium hamper. Memorable: tell me what they're into."
- **Anniversary:** "Flowers timed for morning delivery + a cake = unforgettable 'wait, what?' moment."

### Expat / diaspora use case
"Ordering from abroad?" chip surfaces TARA's expat mode — reassures that Kapruka delivers door-to-door across Sri Lanka, international cards accepted, same quality.

### Proactive occasion awareness
TARA surfaces relevant events without being asked:

| Month | Occasion |
|-------|----------|
| January | New Year |
| February | Valentine's Day |
| April | Sinhala & Tamil New Year (Avurudu) |
| May | Vesak |
| June | Father's Day |
| August | Friendship Day |
| October | Deepavali |
| December | Christmas + New Year |

---

## All 7 Kapruka MCP tools

| Tool | What TARA uses it for |
|------|-----------------------|
| `kapruka_search_products` | Catalog search — runs 2–3 calls with different terms, dedupes by ID, shows max 20 results |
| `kapruka_get_product` | Full product details, images, variants, stock status before recommending |
| `kapruka_list_categories` | Discovery for broad/vague requests ("show me gifts") |
| `kapruka_list_delivery_cities` | City autocomplete in checkout (400ms debounce) |
| `kapruka_check_delivery` | Delivery fee + availability before confirming a date |
| `kapruka_create_order` | Guest checkout — creates order and returns click-to-pay URL |
| `kapruka_track_order` | Order status lookup by 8-digit order number |

---

## Feature list

- **Full agentic loop** — multi-round tool calling, up to 8 rounds per request
- **Streaming responses** — SSE-based word-by-word streaming
- **Product cards** — lazy image loading with IntersectionObserver, staggered fetch, image proxy (`/api/img`) to bypass Kapruka hotlink protection
- **Product detail modal** — full gallery, variant selection, add to cart
- **Cart drawer** — gift / self / pickup order types, express / standard delivery, location type (house / apartment / office / hotel), voucher code, price summary
- **Delivery fee parser** — handles `flat rate LKR 300` markdown format
- **Checkout validation** — skips district/date for pickup, accepts `94X` / `+94X` / `0X` phone formats
- **Pickup locations** — Mirihana HQ, Java Lounge Barnes Place / Kandy / Fort
- **AI gift message generation** — ASCII-safe, 2 variants (heartfelt + fun), fallback templates
- **Order speed timer** — measures first message → order placed, shows `✦ Order placed in 2:14 ⚡`
- **Reorder loop** — last order saved to localStorage, shown as one-tap card on next session
- **Chrome Extension** — shadow DOM, `content.js`, `widget.css`, `manifest.json`
- **Embeddable widget** — `/widget` route with `frame-ancestors *` in CSP
- **CORS** — all API routes have open CORS for cross-origin widget use

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 App Router (TypeScript strict, Tailwind CSS) │
├──────────────────┬──────────────────────────────────────┤
│  /app/api/chat   │  Agentic loop → AIML API (Claude)    │
│  route.ts        │  ↕ MCP tool calls → mcp.kapruka.com  │
├──────────────────┼──────────────────────────────────────┤
│  ChatPanel.tsx   │  Chat UI, product cards, voice input  │
│  CartDrawer.tsx  │  Checkout flow, order creation        │
├──────────────────┼──────────────────────────────────────┤
│  /widget         │  Iframe-embeddable build              │
│  /embed-demo     │  Judge demo with mock Kapruka page    │
│  /chrome-ext     │  Extension download + inject script   │
└──────────────────┴──────────────────────────────────────┘
```

**AI model:** `anthropic/claude-sonnet-4` via AIML API (OpenAI-compatible endpoint)  
**MCP server:** `https://mcp.kapruka.com/mcp` (Streamable HTTP transport, no auth)

---

## Local setup

**Requirements:** Node.js 18+, npm

```bash
# 1. Clone
git clone https://github.com/shanujans/tara.git
cd tara

# 2. Install dependencies
npm install

# 3. Environment variables
cp .env.example .env.local
# Fill in:
#   AIML_API_KEY=your_aiml_api_key
#   MCP_URL=https://mcp.kapruka.com/mcp

# 4. Run development server
npm run dev
# → http://localhost:3000

# 5. Optional: build for production
npm run build && npm start
```

---

## Chrome Extension install

1. Go to [tara-green.vercel.app/embed-demo](https://tara-green.vercel.app/embed-demo) and click **Download Extension**
2. Unzip `TARA-chrome-extension.zip`
3. Open Chrome → `chrome://extensions`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the unzipped folder
6. Visit [kapruka.com](https://kapruka.com) — TARA appears as a floating button

---

## Project structure

```
tara/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          ← AI + MCP agentic loop
│   │   ├── img/route.ts           ← Image proxy (Referer spoof)
│   │   ├── check-delivery/        ← MCP delivery check
│   │   ├── create-order/          ← MCP order creation
│   │   └── track/route.ts         ← MCP order tracking
│   ├── embed-demo/page.tsx        ← Judge demo page
│   ├── widget/page.tsx            ← Embeddable iframe
│   └── page.tsx                   ← Main chat page
├── components/
│   ├── ChatPanel.tsx              ← Main chat UI
│   └── CartDrawer.tsx             ← Cart + checkout drawer
├── context/
│   └── CartContext.tsx            ← Cart state management
├── public/
│   └── chrome-extension.zip      ← Pre-built extension download
├── chrome-extension/
│   ├── manifest.json
│   ├── content.js                 ← Injects widget iframe into kapruka.com
│   └── widget.css                 ← Shadow DOM styles
└── next.config.ts                 ← CSP headers for widget embedding
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AIML_API_KEY` | ✅ | AIML API key for Claude Sonnet 4 access |
| `MCP_URL` | optional | Kapruka MCP endpoint (default: `https://mcp.kapruka.com/mcp`) |

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS only
- **AI:** AIML API → `anthropic/claude-sonnet-4.5`
- **Tools:** Kapruka MCP (Streamable HTTP, 7 tools)
- **Deploy:** Vercel

---

*TARA — Applicant GMEU6 · Kapruka AI Agent Challenge*
