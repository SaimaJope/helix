# Helix Anthropis Institute site: handoff notes

Use this as the prompt for whoever continues (Claude, GPT, a human). State as of 3 Sep 2026.

## Rules
- `home.html` is the approved home page and the brand reference; `index.html` redirects to it. The former `Helix Home v2.dc.html` URL redirects to `home.html` for backwards compatibility. On 3 Sep 2026 the client allowed edits: its header, full-screen menu, hero links, SDG cards, support CTA and footer now link to the inner pages. A pre-edit copy is in `tmp/backup/`. Do not restyle it beyond that.
- Brand: `../helixanthropisbrandguidelines.pdf`. Paper #F6F3E8, Cream #EEE9D8, Ink #26241E, Green 500 #20614B (hero green #184E3D), Red #C6502F, Yellow #D9A23B, Purple #7D5BA6. Public Sans for UI/body, Source Serif 4 for titles, Schibsted Grotesk for the home hero only. Square corners, 1px ink rules, one colour family leads per page. Logo only from the SVG masters in `assets/`.
- No em dashes in copy.
- Client brief: `../Website Design.pdf` (pages: Home, About, Our Work, Volunteer, News/Events, Shop, Contact, SDGs with one page per goal).

## What exists (all plain static HTML, no build step)
- `site.css`, `site.js`: shared styles and runtime (header scroll/hide, mobile menu, dark mode synced with the home page via localStorage `helix-theme`, JSON loader, SDG data for all 17 goals, card renderers, procedural SVG product art, cart in localStorage `helix-cart`, mailto forms).
- Pages: `about.html`, `work.html`, `volunteer.html` (volunteer + join community + support us), `news.html` (news + events), `shop.html`, `product.html?id=…`, `checkout.html`, `contact.html`, `sdgs.html`, `sdg.html?goal=N` (1 to 17), `admin.html`.
- Content the client can edit without touching HTML: `content/*.json` (projects, publications, initiatives, news, events, products, opportunities, team). `admin.html` edits these in the browser, can preview edits on the live pages in the same browser (localStorage `helix-content:*` + `helix-content-preview=on`), and exports JSON to replace in `content/`.
- Pages are generated from the scratch scripts `shell.py`, `pages_a.py`, `pages_b.py` (they were in a temp folder; if missing, just edit the HTML files directly, the header/footer is identical in each).
- Reused from the home page: `procedural-fields.js` (WebGL hero/footer field, `canvas[data-procedural-field]`), `stock-footage.js` (`video[data-stock-footage]`), `assets/sdg/NN.png|inv-NN.png|gif-NN.gif`, `assets/video/*.mp4`.

## Backend for staff (added 3 Sep 2026)
- `api/` is a Cloudflare Worker: username + password login (PBKDF2 hashes in the USERS secret), 12 h signed tokens, GET/PUT `content/<name>.json` and POST `/upload` that commit straight to `SaimaJope/helix` on GitHub via the Contents API, so GitHub Pages republishes within a minute. See `api/README.md` for the five-minute deploy (wrangler login, GitHub fine-grained token, three secrets, `wrangler deploy`, paste the Worker URL into `admin.html` DEFAULT_API or in the login screen's Connection settings).
- Security (see api/README.md): PBKDF2 100k (Workers cap), optional TOTP two-factor per user (`--totp`), login rate limit binding (5/min per IP and username), 8 h tokens in sessionStorage with 30 min idle logout, upload magic-byte sniffing (no SVG), CSP on admin.html.
- `admin.html`: login screen, per-collection lists, editor with image upload, photo galleries, Markdown body with live preview, Site settings form (mission, vision, story, contact, socials, membership). Drafts live in localStorage; Preview shows them on the live pages in the same browser; Publish commits. Offline mode still downloads JSON.
- `post.html?id=` and `project.html?id=` are the article pages (cover image or video, Markdown body, gallery, aside, related, prev/next). Cards link there unless an entry has an external `link`.
- `HX.md` in site.js is the Markdown renderer (headings, bold, italic, links, lists, quotes, images, rules). Products with `images[]` show photos instead of the drawn art.
- Local testing: `node api/dev-server.mjs 8787` with `api/.dev.vars` (never commit it). `npx wrangler dev` on this Windows machine hangs every other POST and stale workerd/node processes on the port cause hangs; kill them first.
- Git: `helix-main` is now its own repo tracking `origin/main` of SaimaJope/helix (nested inside the accidental home-directory repo). Commit made locally; push publishes the site.

- Deployed 3 Sep 2026: Worker at https://helix-content-api.saimajope.workers.dev (Cloudflare account saimajope@gmail.com), admin.html points at it. Accounts user1/user2/user3 (temporary passwords, in api/USERS.secret.json, not in git). GITHUB_TOKEN secret is currently the gh CLI OAuth token; replace with a fine-grained token scoped to SaimaJope/helix when convenient. Worker secrets are changed with `CLOUDFLARE_API_TOKEN=... npx wrangler secret put NAME` from api/.

## Verified
- All pages render with zero console errors at 1440 and 390 px (Playwright, served over http; `fetch` of content JSON needs http, e.g. Live Server at 127.0.0.1:5500 or `python -m http.server`).

## Client review round (3 Sep 2026)
Feedback in `../Website Design and Feedback.docx`. All applied.
- The street address is gone from the home page, from the shared menu and footer on every page and from the Contact page. It survives only in `legal.html` (imprint) and `privacy.html` (controller and privacy contact), where a postal address is normally required. The client also removed `institute.address` from settings through the admin, so nothing binds it any more; the two imprint blocks are static HTML and have to be edited by hand.
- Top of the site tightened: `--header-h` in site.css and the two heights in the home page's own style block went 76px to 60px, and the home hero is `.hx-hero` (`max(560px, 82vh)`, `max(430px, 60vh)` under 720px) instead of a full `100vh`, so the headline sits higher. Change those three numbers to tune it further.
- Membership discounts are switched off behind one flag: `MEMBER_DISCOUNTS` in site.js. `false` hides the shop's discount band and its jump link, the member prices and tier note on product pages, the tier picker in the cart and at checkout and the discount line in the totals, and swaps the volunteer page's 10%/20% figures for Support/Patron. Set it to `true` to restore all of it. The mechanism: `[data-member-only]` is hidden by site.css and revealed when the flag is on, `[data-member-alt]` is the stand-in shown while it is off. The `discount: 10`/`20` values are still in settings.json.

## Settings binding (fixed 3 Sep 2026)
The social links were hardcoded in all 17 pages and the home page read no settings at all, so editing them in the admin appeared to do nothing.
- `settings.js` now applies `content/settings.json` on every page, including the home page and the other `.dc.html` canvases, which do not load site.js. site.js delegates to it (`window.HXSettings.apply()`), so settings are fetched once.
- `[data-setting="a.b"]` writes a value into an element (`data-setting-html` for newlines as `<br>`, `data-setting-attr` for an attribute). `[data-social="instagram|linkedin|youtube|discord|substack"]` points a link at `settings.socials[key]`, refreshes the handle in a child `.hd` on the contact page, and hides the link if the value is blank. Values without a scheme are accepted, which the client's LinkedIn value needs.
- Still not bound anywhere: `institute.tagline`, `institute.name`, and the membership `label`/`price` fields. Add `data-setting` where they should appear, or drop them from the admin's Site settings form so staff are not editing dead fields.

## Working alongside the client
The client publishes through `admin.html` while you work, which lands `content: update … (User 1)` commits straight on `origin/main`. Always `git pull --rebase origin main` before pushing, and when `content/*.json` conflicts, take the client's side (`git checkout --ours <file>` during a rebase) and reapply your own edit on top. As of 3 Sep 2026 they have cleared every collection except `team` (3 real people) and filled in the real mission, vision and social URLs, so the public pages legitimately show empty states for projects, initiatives, publications, news, events, opportunities and products.

## Domain: helix-anthropis.eu
Not live yet. `CNAME` (containing `helix-anthropis.eu`) exists in the working tree but is deliberately untracked, because committing it switches GitHub Pages to the custom domain and the site goes dark until DNS resolves. Order: point DNS first, then set the domain in the repo's Settings > Pages (which writes the CNAME itself, or commit the local file), then wait for the certificate and tick Enforce HTTPS. `api/wrangler.toml` already lists `https://helix-anthropis.eu` and the `www` host in `ALLOWED_ORIGINS`; that needs a `wrangler deploy` from `api/` to take effect, or the admin will fail CORS on the new domain.

## Open items / nice to have
- Membership fees and executive bios/photos: placeholders marked in the pages, replace when the client provides them. Mission and Vision are now the client's official text.
- Forms use `mailto:` (opens the visitor's mail app). For real submissions wire Formspree/Netlify Forms/a Cloudflare Worker.
- Shop checkout is a prototype: no payment provider. Stripe Checkout or Shopify Buy Button are the easy upgrades.
- Product images are procedural SVG; `admin.html` product entries accept `media.image` style paths if photos arrive (add an `image` field and prefer it in `HX.productCard`/`product.html`).
- For a hosted CMS instead of `admin.html`: Decap CMS with the GitHub backend, collections = the same JSON files.
