# TARA for Kapruka — Chrome Extension

**TARA (The AI Retail Agent)** floating inside every Kapruka.com page.
Applicant: GMEU6 · GitHub: github.com/shanujans/tara

---

## What it does

| Feature | Detail |
|---------|--------|
| Floating bubble | Amber 56 px circle, bottom-right corner, z-index max |
| Smart tooltip | "Ask TARA ✦" on hover |
| Product context | Detects product name / price / ID on Kapruka product pages and pre-populates TARA's greeting |
| Context badge | Green "1" badge on bubble when product context is found |
| Unread dot | Red dot when TARA sends a proactive message and panel is closed |
| Panel animation | Spring slide-up (cubic-bezier 0.34 1.56 0.64 1) |
| Shadow DOM | **Closed** shadow root — Kapruka's CSS cannot bleed in, and Kapruka's own scripts cannot reach into TARA's DOM either |
| Storage | Cart & language preference persisted via `chrome.storage.local` |
| Keyboard | `Esc` closes the panel (both a document-level listener and a bubble-level one); full keyboard navigation |
| Accessibility | `role="dialog"` + `aria-modal` + `aria-label` on the panel, `aria-haspopup="dialog"` on the bubble, focus moves to the iframe on open and back to the bubble on close |
| Reduced motion | Respects `prefers-reduced-motion` |

---

## Install (unpacked, Chrome 120+)

### Step 1 — Generate PNG icons
> Chrome requires `.png` icons; the repo ships the HTML generator.

1. Open `chrome-extension/generate-icons.html` in your browser
2. Click **Generate & Download Icons**
3. Save `icon-48.png` and `icon-128.png` into the `chrome-extension/` folder

### Step 2 — Load the extension
1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder

### Step 3 — Visit Kapruka
Navigate to any page on **kapruka.com** and look for the amber ✦ bubble in the bottom-right corner.

---

## Package for distribution (zip)
```bash
# From repo root
zip -r tara-extension.zip chrome-extension/ \
  --exclude "*.DS_Store" --exclude "*/.git/*"
cp tara-extension.zip public/chrome-extension.zip
```
The `/embed-demo` page links to `/chrome-extension.zip` — copy the zip to `public/`.

---

## File structure

```
chrome-extension/
  manifest.json          # MV3 manifest — two content scripts (content.js, detect.js)
  content.js              # Shadow DOM injection script, runs on kapruka.com
  detect.js               # Runs only on /embed-demo — flags extension presence via
                          # a data attribute + custom event, before React hydrates
  widget.css              # All shadow-scoped styles
  generate-icons.html    # Open in browser to create icon PNGs
  icon-48.png            # ← created by generate-icons.html
  icon-128.png           # ← created by generate-icons.html
  README.md              # You are here
```

`public/embed.js` (repo root's `public/` folder, not part of this extension package) is a
separate, standalone script that gives non-extension users the same TARA bubble via a single
`<script src=".../embed.js">` tag on any page. It intentionally mirrors this extension's shadow
DOM isolation, ARIA semantics, and context-detection logic — **keep the two in sync** when you
change one; see "Keeping content.js and embed.js in sync" below.

---

## How context injection works

`content.js` only runs `extractContext()` when the current URL looks like a real product page:

```js
const isProductPage = /\/buyonline\//i.test(url) || /\/product(s)?[/-]/i.test(url);
```

Kapruka's actual product URL scheme is `/buyonline/{slug}/kid/{id}` — it never contains
`/product`. The `/buyonline/` check is the one that actually matches live pages; the
`/product(s)?[/-]/` check is kept only as a secondary fallback in case some template differs.

| Data | Selectors / patterns tried (in order) |
|------|---------------------------|
| Product name | `h1.product-title` → `[class*="product-name"] h1` → `[itemprop="name"]` → `h1` |
| Price | `.product-price` → `[class*="current-price"]` → `[itemprop="price"]` → `[class*="price"]:not([class*="old"]):not([class*="was"])` |
| Product ID | `/kid/([a-z0-9_]+)/` (Kapruka's real scheme, e.g. `cake00ka002105`) → `/products?/(\d+)/` → `?id=(\d+)` → a bare 5+-digit URL segment → `data-product-id` / `data-id` / `data-pid` attributes |

**Price is currency-aware**, not LKR-only: the match captures whichever currency marker
(`LKR`, `Rs.`, `US$`, `A$`, `C$`, `£`, `$`) is actually present in the matched text. Kapruka's
own site shows different currencies on different regional views (e.g. the base `kapruka.com`
product page can show `US$11.73`) — the extension only labels a bare number as `LKR` when no
currency marker was found at all.

Extracted values are URL-encoded and appended to the iframe `src`:
```
https://tara-green.vercel.app/widget?context=Chocolate+Cake&price=LKR+1250&id=cake00ka002105
```

TARA's widget page reads these params and fires an auto-greeting:
> "I see you're looking at Chocolate Cake — want to add it to your order or find something similar?"

---

## Keeping `content.js` and `embed.js` in sync

Both scripts implement the *same* product-context extraction, the same closed shadow DOM, and
the same ARIA/focus behavior — they just mount differently (`content.js` is injected by the
extension; `embed.js` is a self-mounting `<script>` tag anyone can drop into a page). They are
two separate files with no shared import, so **a fix to one's context-detection regexes,
selectors, or accessibility attributes needs to be applied to the other by hand.** If you only
patch one, the other silently regresses (this happened once already — `embed.js` had fallen
behind on shadow-root mode, ARIA, and two of the four context selectors before being brought
back to parity).

---

## postMessage protocol

| Direction | type | payload |
|-----------|------|---------|
| Widget → Extension | `tara-close` | — |
| Widget → Extension | `tara-message` | — |
| Widget → Extension | `tara-cart-update` | cart object |
| Widget → Extension | `tara-lang-update` | lang string |
| Extension → Widget | `tara-restore` | `{ tara_cart, tara_lang }` |

All messages validated against `origin === 'https://tara-green.vercel.app'`.

---

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Read page URL and DOM for product context |
| `scripting` | Reserved for future programmatic injection |
| `storage` | Persist cart and language preference across page navigations |
