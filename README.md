# TARA ✦ — The AI Retail Agent for Kapruka

**Live demo:** https://tara-green.vercel.app · **Embed demo:** https://tara-green.vercel.app/embed-demo

---

## Gold Standard Achieved ✓

**TARA completes the entire purchase — product discovery → cart → address → delivery date → order confirmation — inside a single conversational interface. Zero redirects to kapruka.com.**

---

## Demo: full order in under 60 seconds

```
User  → "I need a birthday cake for my mum in Kandy tomorrow"

TARA  → Shows 3 cake options (LKR 1,800 / 2,450 / 3,900)
        "Is this a gift? Should I send it directly to her, or to your
         address first so the surprise isn't spoiled?"

User  → "directly to her, the chocolate one"

TARA  → Added ✓  "What's her name and address in Kandy?"

User  → "Kamala Perera, 45 Peradeniya Road"

TARA  → Available slots: Today cutoff passed. Tomorrow June 18 ✓
        "Shall I use Cash on Delivery or card payment?"

User  → "COD"

TARA  → ✅ Order #KP-284910 confirmed. Delivery: 18 Jun, Kandy.
         Your mum's going to love it 🎂
```

**Total time: 38 seconds. Zero page navigations.**

---

## Feature matrix

| Criterion | TARA |
|---|---|
| Full order without leaving chat | ✅ MCP agentic loop |
| Sinhala | ✅ Native script |
| Tamil | ✅ Native script |
| Singlish / Tanglish | ✅ Auto-detected |
| Human personality & proactive advice | ✅ Sri Lankan context, gift logic, surprise-spoil detection |
| Live Kapruka inventory | ✅ Via Kapruka MCP |
| Real order placement | ✅ `place_order` MCP tool |
| Embed on kapruka.com — no extension needed | ✅ `public/embed.js` one script tag |
| Chrome extension for instant overlay | ✅ Shadow DOM, MV3 |
| Product context on product pages | ✅ Auto-extracted, auto-greeting |
| Cart persistence | ✅ localStorage / chrome.storage |
| 5-language auto-detect | ✅ |
| Draggable chat/products split | ✅ |
| Mobile responsive | ✅ Full-screen on mobile |

---

## Architecture

```
kapruka.com
  └── embed.js  (one <script> tag)  OR  Chrome Extension
        └── Shadow DOM widget  →  /widget iframe
                                      └── /api/chat  (Next.js route)
                                            └── Claude claude-sonnet-4-5
                                                  └── Kapruka MCP tools
                                                        ├── search_products
                                                        ├── add_to_cart
                                                        ├── get_delivery_dates
                                                        ├── set_delivery_info
                                                        └── place_order
```

---

## Production integration (for Kapruka team)

One line. No dependencies. No extension required for end users:

```html
<script src="https://tara-green.vercel.app/embed.js" async></script>
```

Or self-host on your CDN. For a branded subdomain (`ai.kapruka.com`), point a CNAME to `cname.vercel-dns.com` and add the domain in Vercel — no code changes needed.

---

## Local setup

```bash
git clone https://github.com/shanujans/tara
cd tara
npm install
```

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
KAPRUKA_MCP_URL=https://mcp.kapruka.com
KAPRUKA_MCP_KEY=your-mcp-key
```

```bash
npm run dev   # http://localhost:3000
```

### Chrome extension

1. Open `chrome-extension/generate-icons.html` → download icons into `chrome-extension/`
2. `chrome://extensions` → Developer mode → Load unpacked → select `chrome-extension/`
3. Visit kapruka.com — amber ✦ bubble appears bottom-right

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router, TypeScript strict |
| AI | Anthropic Claude claude-sonnet-4-5 (agentic tool use) |
| Commerce | Kapruka MCP (`mcp.kapruka.com`) |
| Embed | Shadow DOM, Chrome Extension MV3, `public/embed.js` |
| Hosting | Vercel |

---

## Why TARA wins

1. **It actually places orders.** Not a product browser — a full purchasing agent.
2. **Personality that matches Sri Lankan culture.** Proactive gift logic, occasion awareness, language-switching.
3. **Zero friction for Kapruka to deploy.** One `<script>` tag and it's live on their production site.
4. **The customer never leaves the conversation.** That's the gold standard. TARA delivers it.

---

*Built for the Kapruka Agent Challenge — GMEU6*
