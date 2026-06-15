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
| Shadow DOM | Kapruka's CSS cannot reach the widget — zero bleed |
| Storage | Cart & language preference persisted via `chrome.storage.local` |
| Keyboard | `Esc` closes panel; full keyboard navigation |
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
  manifest.json          # MV3 manifest
  content.js             # Shadow DOM injection script
  widget.css             # All shadow-scoped styles
  generate-icons.html    # Open in browser to create icon PNGs
  icon-48.png            # ← created by generate-icons.html
  icon-128.png           # ← created by generate-icons.html
  README.md              # You are here
```

---

## How context injection works

On URLs matching `/products?/`, content.js inspects:

| Data | Selectors tried (in order) |
|------|---------------------------|
| Product name | `h1.product-title`, `[itemprop="name"]`, `h1` |
| Price | `.product-price`, `[itemprop="price"]`, `[class*="price"]` |
| Product ID | URL pattern `/products/(\d+)`, `data-product-id` attr |

Extracted values are URL-encoded and appended to the iframe `src`:
```
https://tara-green.vercel.app/widget?context=Chocolate+Cake&price=LKR+1250&id=12345
```

TARA's widget page reads these params and fires an auto-greeting:
> "I see you're looking at Chocolate Cake — want to add it to your order or find something similar?"

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
