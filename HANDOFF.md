# Helix Anthropis Institute site: handoff notes

Use this as the prompt for whoever continues (Claude, GPT, a human). State as of 3 Sep 2026.

## Rules
- `Helix Home v2.dc.html` is the approved home page and the brand reference; `index.html` redirects to it. On 3 Sep 2026 the client allowed edits: its header, full-screen menu, hero links, SDG cards, support CTA and footer now link to the inner pages. A pre-edit copy is in `tmp/backup/`. Do not restyle it beyond that.
- Brand: `../helixanthropisbrandguidelines.pdf`. Paper #F6F3E8, Cream #EEE9D8, Ink #26241E, Green 500 #20614B (hero green #184E3D), Red #C6502F, Yellow #D9A23B, Purple #7D5BA6. Public Sans for UI/body, Source Serif 4 for titles, Schibsted Grotesk for the home hero only. Square corners, 1px ink rules, one colour family leads per page. Logo only from the SVG masters in `assets/`.
- No em dashes in copy.
- Client brief: `../Website Design.pdf` (pages: Home, About, Our Work, Volunteer, News/Events, Shop, Contact, SDGs with one page per goal).

## What exists (all plain static HTML, no build step)
- `site.css`, `site.js`: shared styles and runtime (header scroll/hide, mobile menu, dark mode synced with the home page via localStorage `helix-theme`, JSON loader, SDG data for all 17 goals, card renderers, procedural SVG product art, cart in localStorage `helix-cart`, mailto forms).
- Pages: `about.html`, `work.html`, `volunteer.html` (volunteer + join community + support us), `news.html` (news + events), `shop.html`, `product.html?id=…`, `checkout.html`, `contact.html`, `sdgs.html`, `sdg.html?goal=N` (1 to 17), `admin.html`.
- Content the client can edit without touching HTML: `content/*.json` (projects, publications, initiatives, news, events, products, opportunities, team). `admin.html` edits these in the browser, can preview edits on the live pages in the same browser (localStorage `helix-content:*` + `helix-content-preview=on`), and exports JSON to replace in `content/`.
- Pages are generated from the scratch scripts `shell.py`, `pages_a.py`, `pages_b.py` (they were in a temp folder; if missing, just edit the HTML files directly, the header/footer is identical in each).
- Reused from the home page: `procedural-fields.js` (WebGL hero/footer field, `canvas[data-procedural-field]`), `stock-footage.js` (`video[data-stock-footage]`), `assets/sdg/NN.png|inv-NN.png|gif-NN.gif`, `assets/video/*.mp4`.

## Verified
- All pages render with zero console errors at 1440 and 390 px (Playwright, served over http; `fetch` of content JSON needs http, e.g. Live Server at 127.0.0.1:5500 or `python -m http.server`).

## Open items / nice to have
- Official Mission and Vision text, membership fees, executive roles/bios and photos: placeholders marked in the pages, replace when the client provides them.
- Forms use `mailto:` (opens the visitor's mail app). For real submissions wire Formspree/Netlify Forms/a Cloudflare Worker.
- Shop checkout is a prototype: no payment provider. Stripe Checkout or Shopify Buy Button are the easy upgrades.
- Product images are procedural SVG; `admin.html` product entries accept `media.image` style paths if photos arrive (add an `image` field and prefer it in `HX.productCard`/`product.html`).
- For a hosted CMS instead of `admin.html`: Decap CMS with the GitHub backend, collections = the same JSON files.
