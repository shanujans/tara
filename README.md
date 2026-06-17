# TARA ✦ — The AI Retail Agent

Multilingual AI shopping assistant for Kapruka.lk  
Built with Next.js 14 · Tailwind CSS · AIML API (Claude Sonnet 4) · Kapruka MCP

## Stack
- **AI**: AIML API → `anthropic/claude-sonnet-4`
- **Search**: Quantum Swarm (3 parallel MCP queries, scored + deduped)
- **Languages**: Sinhala · Tamil · Tanglish · English (auto-detected)
- **Cart**: Context API with gifting, delivery date, district selection
- **Deploy**: Vercel

## Setup
\`\`\`bash
npm install
cp .env.local.example .env.local   # add AIML_API_KEY
npm run dev
\`\`\`

## Env vars (Vercel)
| Key | Value |
|-----|-------|
| `AIML_API_KEY` | Your AIML API key |
| `MCP_URL` | `https://mcp.kapruka.com/mcp` |
| `NEXT_PUBLIC_MCP_URL` | `https://mcp.kapruka.com/mcp` |

## Features
- 🌐 Auto language detection (Sinhala / Tamil / Tanglish / English)
- ✦ Quantum Swarm Search — 3 parallel queries, relevance scored
- 🛒 Full cart with gifting, occasion radar, AI gift messages
- 📦 Order tracking via 8-digit order ID
- 🚀 MCP category cache (5min TTL)