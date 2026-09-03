/* Helix Anthropis Institute: shared runtime for the inner pages.
   Plain JavaScript, no build step. Content lives in content/*.json and can be
   edited through /admin/ (which can also preview unsaved edits on this browser). */
(() => {
  'use strict';

  const EMAIL = 'helixanthropisinstitute@gmail.com';

  /* ------------------------------------------------------------------ utils */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const siteURL = (p) => {
    const s = String(p ?? '');
    return !s || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(s) ? s : '/' + s.replace(/^\.\//, '');
  };
  const cleanHref = (p) => siteURL(p)
    .replace(/^\/index\.html(?=($|[?#]))/, '/')
    .replace(/^\/(about|admin|checkout|contact|legal|news|post|privacy|product|project|sdg|sdgs|shop|volunteer|work)\.html(?=($|[?#]))/, '/$1/');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => '€' + Number(n).toFixed(2);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parseDate = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const fmtDate = (iso) => { if (!iso) return ''; const d = parseDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const lum = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0.5;
    const ch = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const onColor = (bg) => (1.05 / (lum(bg) + 0.05) >= 4.5 ? '#FFFFFF' : '#26241E');
  const param = (k) => new URLSearchParams(location.search).get(k);
  const chipClass = (area) => {
    const a = String(area || '').toLowerCase();
    if (a.includes('human')) return 'green';
    if (a.includes('knowledge') || a.includes('education')) return 'yellow';
    if (a.includes('cooperation') || a.includes('community')) return 'red';
    if (a.includes('innovation') || a.includes('research')) return 'blue';
    if (a.includes('sustain')) return 'green';
    if (a.includes('announce')) return 'green';
    if (a.includes('project')) return 'red';
    if (a.includes('event')) return 'yellow';
    return '';
  };

  /* -------------------------------------------------------------- markdown */
  function inline(t) {
    return t
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${esc(siteURL(src))}" alt="${esc(alt)}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, href) => `<a href="${esc(cleanHref(href))}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function md(src) {
    const lines = esc(String(src || '')).replace(/\r/g, '').split('\n');
    const out = []; let para = [], list = null, quote = [];
    const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.tag}>` + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + `</${list.tag}>`); list = null; } };
    const flushQ = () => { if (quote.length) { out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } };
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) { flushP(); flushL(); flushQ(); continue; }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); flushQ(); const n = Math.min(4, m[1].length + 1); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(l)) { flushP(); flushL(); flushQ(); out.push('<hr>'); continue; }
      if ((m = l.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); quote.push(m[1]); continue; }
      if ((m = l.match(/^[-*]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.tag !== 'ul') { flushL(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.tag !== 'ol') { flushL(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flushP(); flushL(); flushQ(); out.push(`<figure><img src="${siteURL(m[2])}" alt="${m[1]}" loading="lazy">${m[1] ? `<figcaption>${m[1]}</figcaption>` : ''}</figure>`); continue; }
      if (quote.length) { quote.push(l); continue; }
      para.push(l);
    }
    flushP(); flushL(); flushQ();
    return out.join('\n');
  }
  const gallery = (paths) => (paths && paths.length) ? `<div class="gallery-grid">${paths.map((g) => { const src = typeof g === 'string' ? g : g.src; const cap = typeof g === 'string' ? '' : (g.caption || ''); return `<figure><img src="${esc(siteURL(src))}" alt="${esc(cap)}" loading="lazy">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`; }).join('')}</div>` : '';
  const detailHref = (kind, item) => (item.link && item.link !== '#') ? cleanHref(item.link) : `/${kind}/?id=${encodeURIComponent(item.id)}`;

  /* --------------------------------------------------------------- content */
  const cache = {};
  async function load(name) {
    if (cache[name]) return cache[name];
    let override = null;
    try {
      const raw = localStorage.getItem('helix-content:' + name);
      if (raw && localStorage.getItem('helix-content-preview') === 'on') override = JSON.parse(raw);
    } catch (e) {}
    if (override) { cache[name] = override; return override; }
    try {
      const res = await fetch('/content/' + name + '.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      cache[name] = Array.isArray(data) ? data : [];
      return cache[name];
    } catch (e) {
      console.warn('Could not load /content/' + name + '.json', e);
      cache[name] = [];
      return cache[name];
    }
  }
  let settingsCache = null;
  async function settings() {
    if (settingsCache) return settingsCache;
    let override = null;
    try { const raw = localStorage.getItem('helix-content:settings'); if (raw && localStorage.getItem('helix-content-preview') === 'on') override = JSON.parse(raw); } catch (e) {}
    if (override) { settingsCache = override; return override; }
    try { const res = await fetch('/content/settings.json', { cache: 'no-store' }); settingsCache = res.ok ? await res.json() : {}; } catch (e) { settingsCache = {}; }
    return settingsCache;
  }
  const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  async function applySettings() {
    const els = $$('[data-setting]'); if (!els.length) return;
    const st = await settings();
    els.forEach((el) => {
      const v = getPath(st, el.dataset.setting);
      if (v === undefined || v === null || v === '') return;
      if (el.dataset.settingAttr) el.setAttribute(el.dataset.settingAttr, el.dataset.settingPrefix ? el.dataset.settingPrefix + v : v);
      else if (el.dataset.settingHtml !== undefined) el.innerHTML = String(v).split('\n').map(esc).join('<br>');
      else el.textContent = v;
    });
  }
  function previewBanner() {
    try {
      if (localStorage.getItem('helix-content-preview') !== 'on') return;
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:95;background:#D9A23B;color:#26241E;font:600 13px/1.4 "Public Sans",system-ui,sans-serif;padding:10px 16px;display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap;';
      b.innerHTML = '<span>Previewing unsaved content edits from the admin on this browser.</span><a href="/admin/" style="text-decoration:underline;">Open admin</a><button type="button" style="border:1px solid #26241E;background:transparent;color:#26241E;font:inherit;padding:4px 10px;cursor:pointer;">Stop preview</button>';
      b.querySelector('button').onclick = () => { localStorage.setItem('helix-content-preview', 'off'); location.reload(); };
      document.body.appendChild(b);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------- SDGs */
  const SDGS = [
    ['No Poverty', '#E5243B', 'End poverty in all its forms everywhere.', 'Poverty is more than a lack of income. It shows up as hunger, poor health, exclusion from decisions and no cushion when a shock arrives. The first goal asks every country to guarantee a floor beneath which no one falls.', ['Eradicate extreme poverty for all people everywhere.', 'Halve the share of people living in poverty by national definitions.', 'Put social protection systems in place for everyone, including floors.', 'Build the resilience of people in poverty to climate and economic shocks.'], 'Human Development'],
    ['Zero Hunger', '#DDA63A', 'End hunger, achieve food security and improved nutrition, and promote sustainable agriculture.', 'Enough food exists for everyone. Hunger is a problem of access, income, conflict and fragile food systems. The goal links nutrition to the people who grow food and to the land that has to keep producing it.', ['End hunger and ensure year-round access to safe, nutritious food.', 'End all forms of malnutrition, with a focus on children and mothers.', 'Double the productivity and incomes of small-scale food producers.', 'Make food production systems sustainable and resilient.'], 'Sustainable Futures'],
    ['Good Health and Well-being', '#4C9F38', 'Ensure healthy lives and promote well-being for all at all ages.', 'Health is the foundation for everything else a person might do. The goal covers the whole life course, from safe births to old age, and treats mental health, clean air and road safety as health questions too.', ['Reduce maternal mortality and end preventable deaths of newborns and young children.', 'End the epidemics of AIDS, tuberculosis, malaria and neglected tropical diseases.', 'Achieve universal health coverage and access to essential medicines.', 'Strengthen prevention and treatment of substance abuse.'], 'Human Development'],
    ['Quality Education', '#C5192D', 'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.', 'Education is how knowledge travels between generations and across borders. The goal is not only about enrolment but about whether people actually learn, and whether learning continues throughout life.', ['Free, equitable and quality primary and secondary education for every child.', 'Equal access to affordable technical, vocational and higher education.', 'Eliminate gender disparities and reach the most vulnerable learners.', 'Ensure all learners acquire the knowledge and skills for sustainable development.'], 'Knowledge & Education'],
    ['Gender Equality', '#FF3A21', 'Achieve gender equality and empower all women and girls.', 'No society flourishes while half of its people are held back. The goal names the barriers directly: discrimination, violence, unpaid care work and exclusion from leadership.', ['End all forms of discrimination against women and girls everywhere.', 'Eliminate violence and harmful practices such as child marriage.', 'Recognise and value unpaid care and domestic work.', 'Ensure full participation and equal opportunities for leadership.'], 'Human Development'],
    ['Clean Water and Sanitation', '#26BDE2', 'Ensure availability and sustainable management of water and sanitation for all.', 'Water is shared by everyone upstream and downstream. The goal asks for safe drinking water and sanitation for all, and for the rivers, aquifers and wetlands that supply them to be managed together.', ['Universal and equitable access to safe and affordable drinking water.', 'Adequate sanitation and hygiene for all, ending open defecation.', 'Improve water quality by reducing pollution and untreated wastewater.', 'Protect and restore water-related ecosystems.'], 'Sustainable Futures'],
    ['Affordable and Clean Energy', '#FCC30B', 'Ensure access to affordable, reliable, sustainable and modern energy for all.', 'Energy decides what a household, a school or a clinic can do after dark. The goal pairs access with a shift to renewable sources, so that development does not lock in tomorrow’s emissions.', ['Universal access to affordable, reliable and modern energy services.', 'Substantially increase the share of renewable energy.', 'Double the global rate of improvement in energy efficiency.', 'Expand infrastructure and upgrade technology for modern energy in developing countries.'], 'Innovation'],
    ['Decent Work and Economic Growth', '#A21942', 'Promote sustained, inclusive and sustainable economic growth, full and productive employment, and decent work for all.', 'Growth only counts when it reaches people as decent work: fair pay, safe conditions and rights. The goal also confronts the forms of work that should not exist at all.', ['Full and productive employment and decent work for all, with equal pay for equal work.', 'Substantially reduce the share of young people not in employment, education or training.', 'Eradicate forced labour, modern slavery, human trafficking and child labour.', 'Protect labour rights and promote safe working environments.'], 'Human Development'],
    ['Industry, Innovation and Infrastructure', '#FD6925', 'Build resilient infrastructure, promote inclusive and sustainable industrialisation, and foster innovation.', 'Roads, networks, laboratories and small enterprises are the plumbing of development. The goal asks for infrastructure that lasts, industry that includes, and research that reaches the people who need it.', ['Develop quality, reliable, sustainable and resilient infrastructure.', 'Promote inclusive and sustainable industrialisation.', 'Increase access of small enterprises to financial services and markets.', 'Enhance research and upgrade technological capabilities.'], 'Innovation'],
    ['Reduced Inequalities', '#DD1367', 'Reduce inequality within and among countries.', 'Inequality is not only about income. It is about who gets heard, who moves freely and who is protected. The goal sets targets inside countries and between them.', ['Grow the incomes of the poorest forty percent faster than the national average.', 'Empower and promote the social, economic and political inclusion of all.', 'Ensure equal opportunity and reduce inequalities of outcome.', 'Facilitate safe, orderly and responsible migration and mobility.'], 'Cooperation'],
    ['Sustainable Cities and Communities', '#FD9D24', 'Make cities and human settlements inclusive, safe, resilient and sustainable.', 'Most people now live in towns and cities, and most of the decisions that shape daily life are made there. The goal is about housing, transport, public space and the right to take part in planning.', ['Adequate, safe and affordable housing and basic services for all.', 'Safe, affordable, accessible and sustainable transport systems.', 'Inclusive and sustainable urbanisation with participatory planning.', 'Universal access to safe, inclusive and accessible green and public spaces.'], 'Cooperation'],
    ['Responsible Consumption and Production', '#BF8B2E', 'Ensure sustainable consumption and production patterns.', 'What we make and what we throw away are two ends of the same chain. The goal asks producers and consumers to close the loop: less waste, longer lives for things, and honest information.', ['Sustainable management and efficient use of natural resources.', 'Halve per-capita food waste and reduce losses along supply chains.', 'Substantially reduce waste through prevention, reduction, recycling and reuse.', 'Ensure people everywhere have the information and awareness for sustainable lifestyles.'], 'Sustainable Futures'],
    ['Climate Action', '#3F7E44', 'Take urgent action to combat climate change and its impacts.', 'Climate change multiplies every other risk on this list. The goal focuses on resilience, on putting climate into every plan and budget, and on making sure people understand what is at stake.', ['Strengthen resilience and adaptive capacity to climate-related hazards.', 'Integrate climate change measures into national policies, strategies and planning.', 'Improve education, awareness and capacity on mitigation and adaptation.', 'Deliver the climate finance commitments made to developing countries.'], 'Sustainable Futures'],
    ['Life Below Water', '#0A97D9', 'Conserve and sustainably use the oceans, seas and marine resources.', 'The ocean regulates the climate, feeds billions and absorbs much of what we emit. The goal treats it as a shared commons that needs rules, protection and restraint.', ['Prevent and significantly reduce marine pollution of all kinds.', 'Sustainably manage and protect marine and coastal ecosystems.', 'Minimise and address the impacts of ocean acidification.', 'Regulate harvesting and end overfishing and destructive fishing practices.'], 'Sustainable Futures'],
    ['Life on Land', '#56C02B', 'Protect, restore and sustainably manage terrestrial ecosystems, forests, land and biodiversity.', 'Forests, soils and species are the living infrastructure of the planet. The goal is to halt their loss and to restore what has been degraded, while people continue to live from the land.', ['Conserve and restore terrestrial and inland freshwater ecosystems.', 'Halt deforestation and restore degraded forests.', 'Combat desertification and restore degraded land and soil.', 'Halt the loss of biodiversity and protect threatened species.'], 'Sustainable Futures'],
    ['Peace, Justice and Strong Institutions', '#00689D', 'Promote peaceful and inclusive societies, provide access to justice, and build effective, accountable and inclusive institutions.', 'Institutions are how a society keeps its promises. The goal asks for less violence, more justice and public bodies that are transparent, accountable and open to participation.', ['Significantly reduce all forms of violence and related death rates.', 'Promote the rule of law and ensure equal access to justice for all.', 'Substantially reduce corruption and bribery in all their forms.', 'Ensure responsive, inclusive, participatory and representative decision-making.'], 'Cooperation'],
    ['Partnerships for the Goals', '#19486A', 'Strengthen global partnerships for sustainable development.', 'None of the other sixteen goals can be reached alone. The last goal is about the means: finance, technology, trade, data and the partnerships between governments, institutions and communities.', ['Strengthen domestic resource mobilisation and meet development assistance commitments.', 'Enhance cooperation on science, technology and innovation.', 'Promote a universal, rules-based, open and equitable trading system.', 'Encourage effective public, private and civil society partnerships.'], 'Cooperation']
  ].map(([title, color, description, why, targets, area], i) => ({
    n: i + 1, nn: String(i + 1).padStart(2, '0'), title, color, description, why, targets, area,
    png: '/assets/sdg/' + String(i + 1).padStart(2, '0') + '.png',
    inv: '/assets/sdg/inv-' + String(i + 1).padStart(2, '0') + '.png',
    gif: '/assets/sdg/gif-' + String(i + 1).padStart(2, '0') + '.gif',
    href: '/sdg/?goal=' + (i + 1),
    un: 'https://sdgs.un.org/goals/goal' + (i + 1),
    fg: onColor(color)
  }));

  function sdgGrid(container, opts = {}) {
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    el.innerHTML = SDGS.map((g) => `
      <a class="sdg-card" href="${g.href}" aria-label="Goal ${g.n}: ${esc(g.title)}" title="Goal ${g.n}: ${esc(g.title)}">
        <img src="${opts.inverted ? g.inv : g.png}" alt="">
        <img class="gif" src="${g.gif}" alt="" loading="lazy" decoding="async">
      </a>`).join('');
  }
  const sdgPills = (ids) => `<span class="sdg-pills">${(ids || []).map((n) => { const g = SDGS[n - 1]; return g ? `<a class="sdg-pill" href="${g.href}" style="background:${g.color};color:${g.fg}" title="Goal ${g.n}: ${esc(g.title)}">${g.n}</a>` : ''; }).join('')}</span>`;

  /* ------------------------------------------------------- hatched icons */
  function hatch(spanFn, y0, y1, step = 4) {
    const out = [];
    for (let y = y0; y <= y1; y += step) {
      spanFn(y).forEach(([x1, x2]) => { if (x2 - x1 > 1) out.push([+x1.toFixed(1), +x2.toFixed(1), y]); });
    }
    return out;
  }
  const circ = (cx, cy, r) => (y) => { const dy = Math.abs(y - cy); if (dy >= r) return []; const h = Math.sqrt(r * r - dy * dy); return [[cx - h, cx + h]]; };
  const ICONS = {
    steps: () => hatch((y) => [[4, 12, 26], [14, 22, 18], [24, 32, 10], [34, 42, 2]].filter(([a, b, top]) => y >= top && y <= 42).map(([a, b]) => [a, b]), 2, 42),
    tri: () => hatch((y) => { const t = (y - 4) / 36; if (t < 0 || t > 1) return []; const h = 19 * t; return [[22 - h, 22 + h]]; }, 4, 40),
    circles: () => { const a = circ(15, 22, 11), b = circ(29, 22, 11); return hatch((y) => { const A = a(y), B = b(y); if (A.length && B.length && A[0][1] > B[0][0]) return [[A[0][0], B[0][1]]]; return A.concat(B); }, 10, 34); },
    diamond: () => hatch((y) => { const d = 17 - Math.abs(y - 22); return d <= 0 ? [] : [[22 - d, 22 + d]]; }, 6, 38),
    dome: () => hatch(circ(22, 42, 19), 22, 42),
    square: () => hatch(() => [[6, 38]], 6, 38),
    ring: () => hatch((y) => { const o = circ(22, 22, 18)(y), i = circ(22, 22, 9)(y); if (!o.length) return []; if (!i.length) return o; return [[o[0][0], i[0][0]], [i[0][1], o[0][1]]]; }, 4, 40),
    bars: () => hatch((y) => [[4, 10], [17, 27], [34, 40]], 6, 38),
    wave: () => hatch((y) => { const t = (y - 6) / 32; const x = 4 + Math.sin(t * Math.PI * 2) * 6; return [[x + 4, x + 30]]; }, 6, 38),
    half: () => hatch((y) => (y <= 22 ? [[4, 40]] : [[4, 22]]), 4, 40),
    arrow: () => hatch((y) => { if (y < 22) { const h = 2 + (y - 4) * 1; return [[22 - h, 22 + h]]; } return [[15, 29]]; }, 4, 40),
    plus: () => hatch((y) => (y >= 15 && y <= 29 ? [[4, 40]] : [[15, 29]]), 4, 40)
  };
  const iconSVG = (name, color = 'currentColor') => `<svg class="icon" width="46" height="46" viewBox="0 0 44 44" aria-hidden="true">${(ICONS[name] || ICONS.square)().map(([x1, x2, y]) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="2"></line>`).join('')}</svg>`;

  /* ---------------------------------------------------------------- media */
  function mediaHTML(media = {}, o = {}) {
    const tag = o.tag ? `<span class="chip paper tag">${esc(o.tag)}</span>` : '';
    if (media.image) return `<img src="${esc(siteURL(media.image))}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="lazy">${tag}`;
    if (media.video) return `<video class="hx-stock-video" data-stock-footage muted loop playsinline preload="metadata" aria-hidden="true" tabindex="-1"><source src="${esc(siteURL(media.video))}" type="video/mp4"></video><span class="hx-stock-shade" aria-hidden="true"></span>${tag}`;
    const bg = media.poster || '#184E3D';
    return `<div class="poster" style="background:${esc(bg)};"><span class="big">${esc(o.big || '')}</span><img class="mark" src="${onColor(bg) === '#FFFFFF' ? '/assets/helix-h.svg' : '/assets/helix-h-ink.svg'}" alt=""></div>${tag}`;
  }

  /* -------------------------------------------------------------- renderers */
  const projectCard = (p) => `
    <article class="card link">
      <a href="${esc(detailHref('project', p))}" class="media" aria-hidden="true" tabindex="-1">${mediaHTML(p.media, { tag: p.area, big: p.year })}</a>
      <div class="body">
        <div class="meta"><span>${esc(p.status === 'past' ? 'Completed' : 'Current')}</span><span>${esc(p.year || '')}</span>${p.location ? `<span>${esc(p.location)}</span>` : ''}</div>
        <h3 class="t3"><a href="${esc(detailHref('project', p))}">${esc(p.title)}</a></h3>
        <p>${esc(p.summary)}</p>
        ${p.sdgs && p.sdgs.length ? sdgPills(p.sdgs) : ''}
        <a class="ul" href="${esc(detailHref('project', p))}">Read more</a>
      </div>
    </article>`;

  const newsCard = (n) => `
    <article class="card link">
      <a href="${esc(detailHref('post', n))}" class="media wide" aria-hidden="true" tabindex="-1">${mediaHTML(n.media, { tag: n.category, big: parseDate(n.date).getDate() })}</a>
      <div class="body">
        <div class="meta"><time datetime="${esc(n.date)}">${fmtDate(n.date)}</time></div>
        <h3 class="t3"><a href="${esc(detailHref('post', n))}">${esc(n.title)}</a></h3>
        <p>${esc(n.summary)}</p>
        <a class="ul" href="${esc(detailHref('post', n))}">Read more</a>
      </div>
    </article>`;

  const pubRow = (p) => `
    <a class="pub-row" href="${esc(p.link || '#')}">
      <span class="in">
        <span class="chip ${chipClass(p.area)}">${esc(p.type || p.area || 'Publication')}</span>
        <span class="ttl">${esc(p.title)}</span>
        <span class="meta">${esc(p.authors || '')}${p.authors && p.date ? ' · ' : ''}${fmtDate(p.date)}</span>
      </span>
      <span class="arrow" aria-hidden="true">→</span>
    </a>`;

  function icsLink(e) {
    const d = String(e.date).replace(/-/g, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Helix Anthropis Institute//EN', 'BEGIN:VEVENT', `UID:${e.id}@helixanthropis`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${e.title}`, `LOCATION:${e.location || ''}`, `DESCRIPTION:${(e.summary || '').replace(/\n/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }
  const eventRow = (e) => { const d = parseDate(e.date); return `
    <div class="event-row">
      <div class="date-block"><span class="d">${d.getDate()}</span><span class="m">${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}</span></div>
      <div>
        <div class="ttl">${esc(e.title)}</div>
        <div class="meta">${e.kind ? `<span class="chip outline" style="font-size:9.5px;padding:5px 8px;">${esc(e.kind)}</span>` : ''}${e.time ? `<span>${esc(e.time)}</span>` : ''}${e.location ? `<span>${esc(e.location)}</span>` : ''}</div>
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
      </div>
      <div class="actions"><a class="ul" href="${icsLink(e)}" download="${esc(e.id)}.ics">Add to calendar</a>${e.link && e.link !== '#' ? `<a class="ul" href="${esc(e.link)}">Details</a>` : ''}</div>
    </div>`; };

  /* ------------------------------------------------------------ product art */
  function art(type, color = '#20614B', view = 'front', alt = '#F6F3E8') {
    const light = onColor(color) === '#26241E';
    const mark = light ? '/assets/helix-h-ink.svg' : '/assets/helix-h.svg';
    const line = light ? 'rgba(38,36,30,0.55)' : 'rgba(246,243,232,0.5)';
    const H = (x, y, w, op = 1) => `<image href="${mark}" x="${x}" y="${y}" width="${w}" height="${w * 1.524}" opacity="${op}" preserveAspectRatio="xMidYMid meet"/>`;
    const detail = view === 'detail';
    let body = '';
    switch (type) {
      case 'tee':
        body = detail
          ? `<rect x="0" y="0" width="200" height="200" fill="${color}"/><line x1="0" y1="24" x2="200" y2="24" stroke="${line}" stroke-width="1"/>${H(64, 40, 72)}`
          : `<path d="M62 30 L88 18 Q100 30 112 18 L138 30 L168 50 L152 74 L138 66 L138 178 L62 178 L62 66 L48 74 L32 50 Z" fill="${color}" stroke="${line}" stroke-width="1"/>
             <path d="M88 18 Q100 34 112 18" fill="none" stroke="${line}" stroke-width="1"/>${H(88, 74, 24)}`;
        break;
      case 'hoodie':
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/><rect x="40" y="120" width="120" height="60" fill="none" stroke="${line}"/><line x1="90" y1="0" x2="90" y2="60" stroke="${line}" stroke-width="2"/><line x1="110" y1="0" x2="110" y2="60" stroke="${line}" stroke-width="2"/>${H(80, 40, 40, 0.95)}`
          : `<path d="M58 40 L80 26 Q100 8 120 26 L142 40 L172 60 L156 84 L142 76 L142 182 L58 182 L58 76 L44 84 L28 60 Z" fill="${color}" stroke="${line}" stroke-width="1"/>
             <path d="M80 26 Q100 50 120 26" fill="none" stroke="${line}" stroke-width="1"/>
             <line x1="96" y1="46" x2="96" y2="86" stroke="${line}" stroke-width="1.6"/><line x1="104" y1="46" x2="104" y2="86" stroke="${line}" stroke-width="1.6"/>
             <path d="M72 138 L128 138 L128 178 L72 178 Z" fill="none" stroke="${line}" stroke-width="1"/>${H(92, 92, 16)}`;
        break;
      case 'cap':
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/>${H(72, 46, 56)}`
          : `<path d="M40 112 Q40 44 100 44 Q160 44 160 112 Z" fill="${color}" stroke="${line}" stroke-width="1"/>
             <path d="M100 44 L100 112" stroke="${line}" stroke-width="1"/><path d="M62 52 Q76 84 78 112" fill="none" stroke="${line}" stroke-width="1"/><path d="M138 52 Q124 84 122 112" fill="none" stroke="${line}" stroke-width="1"/>
             <path d="M40 112 L160 112 Q186 116 190 132 Q150 126 100 128 Q60 128 40 118 Z" fill="${color}" stroke="${line}" stroke-width="1"/>
             <circle cx="100" cy="44" r="4" fill="${color}" stroke="${line}"/>${H(90, 68, 20)}`;
        break;
      case 'tote':
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/>${H(60, 30, 80)}`
          : `<path d="M62 60 Q62 22 100 22 Q138 22 138 60" fill="none" stroke="${light ? '#26241E' : '#F6F3E8'}" stroke-width="5"/>
             <rect x="34" y="60" width="132" height="118" fill="${color}" stroke="${line}" stroke-width="1"/>
             <line x1="34" y1="70" x2="166" y2="70" stroke="${line}" stroke-width="1"/>${H(88, 106, 24)}`;
        break;
      case 'poster': {
        const ink = light ? '#26241E' : '#F6F3E8';
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/><text x="18" y="86" font-family="Public Sans, system-ui, sans-serif" font-weight="800" font-size="60" fill="${ink}" letter-spacing="-2">IDEAS</text><text x="18" y="150" font-family="Public Sans, system-ui, sans-serif" font-weight="800" font-size="60" fill="${ink}" letter-spacing="-2">MOVE</text>`
          : `<rect x="40" y="14" width="120" height="172" fill="${color}" stroke="${line}" stroke-width="1"/>
             <text x="52" y="66" font-family="Public Sans, system-ui, sans-serif" font-weight="800" font-size="34" fill="${ink}" letter-spacing="-1.5">IDEAS</text>
             <text x="52" y="100" font-family="Public Sans, system-ui, sans-serif" font-weight="800" font-size="34" fill="${ink}" letter-spacing="-1.5">MOVE</text>
             <text x="52" y="126" font-family="Source Serif 4, Georgia, serif" font-style="italic" font-size="9.5" fill="${ink}">Cooperation makes room</text>
             <text x="52" y="138" font-family="Source Serif 4, Georgia, serif" font-style="italic" font-size="9.5" fill="${ink}">for better futures.</text>
             <line x1="52" y1="160" x2="148" y2="160" stroke="${ink}" stroke-width="1"/>${H(52, 164, 10)}<text x="66" y="176" font-family="Public Sans, system-ui, sans-serif" font-weight="800" font-size="6" fill="${ink}" letter-spacing="1.2">HELIX ANTHROPIS / 2026</text>`;
        break;
      }
      case 'notebook':
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/>${H(66, 34, 68, 0.9)}`
          : `<rect x="46" y="20" width="114" height="160" fill="${color}" stroke="${line}" stroke-width="1"/>
             <rect x="40" y="20" width="14" height="160" fill="${light ? '#26241E' : '#F6F3E8'}" opacity="0.9"/>
             <line x1="150" y1="20" x2="150" y2="180" stroke="${line}" stroke-width="1"/>
             <rect x="140" y="20" width="10" height="26" fill="${alt}" opacity="0.8"/>${H(84, 82, 28, 0.85)}`;
        break;
      case 'mug':
        body = detail
          ? `<rect width="200" height="200" fill="${color}"/>${H(66, 34, 68)}`
          : `<path d="M50 54 L134 54 L130 168 Q92 176 54 168 Z" fill="${color}" stroke="${line}" stroke-width="1"/>
             <ellipse cx="92" cy="54" rx="42" ry="8" fill="${color}" stroke="${line}" stroke-width="1"/>
             <path d="M134 78 Q172 76 170 110 Q168 140 132 140" fill="none" stroke="${light ? '#26241E' : color}" stroke-width="12"/>
             <path d="M134 78 Q172 76 170 110 Q168 140 132 140" fill="none" stroke="${line}" stroke-width="1"/>${H(80, 86, 24)}`;
        break;
      case 'pin':
        body = detail
          ? `<circle cx="100" cy="100" r="96" fill="${color}"/><circle cx="100" cy="100" r="86" fill="none" stroke="${line}" stroke-width="1"/>${H(68, 52, 64)}`
          : `<circle cx="100" cy="100" r="58" fill="${color}" stroke="${line}" stroke-width="1"/>
             <circle cx="100" cy="100" r="52" fill="none" stroke="${line}" stroke-width="1"/>
             <line x1="100" y1="158" x2="100" y2="184" stroke="#8B8574" stroke-width="2"/>
             <circle cx="100" cy="186" r="5" fill="none" stroke="#8B8574" stroke-width="2"/>${H(84, 76, 32)}`;
        break;
      default:
        body = `<rect x="30" y="30" width="140" height="140" fill="${color}"/>${H(80, 68, 40)}`;
    }
    return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(type)} in ${esc(color)}">${body}</svg>`;
  }
  const productVisual = (p, i = 0) => (p.images && p.images.length) ? `<img src="${esc(siteURL(p.images[Math.min(i, p.images.length - 1)]))}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">` : art(p.art, (p.colors || ['#20614B'])[0]);
  const productCard = (p) => `
    <article class="card link product-card">
      <a class="art${p.images && p.images.length ? ' photo' : ''}" href="/product/?id=${encodeURIComponent(p.id)}" aria-hidden="true" tabindex="-1">${productVisual(p)}</a>
      <div class="body">
        <span class="chip outline" style="align-self:flex-start;">${esc(p.category)}</span>
        <h3 class="name"><a href="/product/?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <div class="price">${money(p.price)}</div>
        <div class="swatches">${(p.colors || []).map((c) => `<span class="swatch" style="background:${esc(c)}"></span>`).join('')}</div>
        <a class="ul" href="/product/?id=${encodeURIComponent(p.id)}">View product</a>
      </div>
    </article>`;

  /* ------------------------------------------------------------------- cart */
  /* Membership discounts are switched off (client feedback, 3 Sep 2026). Set
     MEMBER_DISCOUNTS back to true to restore the tier picker in the cart and at
     checkout, the discount line in the totals, the member prices on product
     pages and every [data-member-only] block in the HTML. */
  const MEMBER_DISCOUNTS = false;
  const TIERS = { none: { label: 'No membership', pct: 0 }, eco: { label: 'Eco Champion member', pct: 10 }, visionary: { label: 'Visionary member', pct: 20 } };
  const cart = {
    key: 'helix-cart',
    read() { try { return JSON.parse(localStorage.getItem(this.key) || '{"items":[],"tier":"none"}'); } catch (e) { return { items: [], tier: 'none' }; } },
    write(state) { try { localStorage.setItem(this.key, JSON.stringify(state)); } catch (e) {} this.render(); },
    add(item) {
      const s = this.read();
      const k = item.id + '|' + item.color + '|' + item.size;
      const ex = s.items.find((i) => i.key === k);
      if (ex) ex.qty += item.qty; else s.items.push({ ...item, key: k });
      this.write(s); this.open(); toast('Added to cart');
    },
    setQty(key, qty) { const s = this.read(); const it = s.items.find((i) => i.key === key); if (!it) return; it.qty = Math.max(0, qty); if (it.qty === 0) s.items = s.items.filter((i) => i.key !== key); this.write(s); },
    remove(key) { const s = this.read(); s.items = s.items.filter((i) => i.key !== key); this.write(s); },
    clear() { this.write({ items: [], tier: this.read().tier || 'none' }); },
    setTier(t) { const s = this.read(); s.tier = TIERS[t] ? t : 'none'; this.write(s); },
    totals(s = this.read()) {
      const subtotal = s.items.reduce((a, i) => a + i.price * i.qty, 0);
      const pct = MEMBER_DISCOUNTS ? (TIERS[s.tier] || TIERS.none).pct : 0;
      const discount = +(subtotal * pct / 100).toFixed(2);
      return { subtotal, pct, discount, total: +(subtotal - discount).toFixed(2), count: s.items.reduce((a, i) => a + i.qty, 0) };
    },
    open() { document.body.classList.add('cart-open'); },
    close() { document.body.classList.remove('cart-open'); },
    mount() {
      if ($('.cart-drawer')) return;
      const scrim = document.createElement('div'); scrim.className = 'cart-scrim'; scrim.onclick = () => this.close();
      const d = document.createElement('aside'); d.className = 'cart-drawer'; d.setAttribute('aria-label', 'Shopping cart');
      d.innerHTML = `<div class="head"><span class="t4">Your cart</span><button class="hx-close" type="button" style="color:inherit;border-color:currentColor" aria-label="Close cart">✕</button></div><div class="items"></div><div class="foot"></div>`;
      d.querySelector('.hx-close').onclick = () => this.close();
      document.body.append(scrim, d);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
      this.render();
    },
    render() {
      const s = this.read(); const t = this.totals(s);
      $$('.hx-cart-btn .count').forEach((c) => { c.textContent = t.count || ''; });
      const d = $('.cart-drawer'); if (!d) return;
      const items = d.querySelector('.items'); const foot = d.querySelector('.foot');
      if (!s.items.length) {
        items.innerHTML = `<p class="empty" style="margin:24px 0;">Your cart is empty.</p>`;
        foot.innerHTML = `<a class="btn ink block" href="/shop/">Browse the shop</a>`;
        return;
      }
      items.innerHTML = s.items.map((i) => `
        <div class="cart-item">
          <div class="thumb">${art(i.art, i.color)}</div>
          <div><div class="ttl">${esc(i.name)}</div><div class="meta">${esc(i.colorName)} · ${esc(i.size)} · ${money(i.price)}</div>
            <div class="ctrl"><button type="button" data-dec="${esc(i.key)}" aria-label="Decrease">−</button><span>${i.qty}</span><button type="button" data-inc="${esc(i.key)}" aria-label="Increase">+</button><button type="button" class="rm" data-rm="${esc(i.key)}">Remove</button></div></div>
          <div class="line-price">${money(i.price * i.qty)}</div>
        </div>`).join('');
      foot.innerHTML = `
        ${MEMBER_DISCOUNTS ? `<div class="field"><label for="cart-tier">Membership</label><select id="cart-tier">${Object.entries(TIERS).map(([k, v]) => `<option value="${k}" ${s.tier === k ? 'selected' : ''}>${v.label}${v.pct ? ` (${v.pct}% off)` : ''}</option>`).join('')}</select></div>` : ''}
        <div class="totals"><div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.pct ? `<div class="disc"><span>Member discount ${t.pct}%</span><span>−${money(t.discount)}</span></div>` : ''}<div class="total"><span>Total</span><span>${money(t.total)}</span></div></div>
        <a class="btn block" href="/checkout/">Checkout</a>
        <a class="ul" href="/shop/" style="justify-self:center;">Continue shopping</a>`;
      items.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.inc) this.setQty(b.dataset.inc, (s.items.find((i) => i.key === b.dataset.inc) || { qty: 0 }).qty + 1);
        if (b.dataset.dec) this.setQty(b.dataset.dec, (s.items.find((i) => i.key === b.dataset.dec) || { qty: 0 }).qty - 1);
        if (b.dataset.rm) this.remove(b.dataset.rm);
      };
      const tierSel = foot.querySelector('#cart-tier'); if (tierSel) tierSel.onchange = (e) => this.setTier(e.target.value);
    }
  };

  /* ----------------------------------------------------------------- toast */
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* --------------------------------------------------------------- chrome */
  function applyTheme(dark, persist = true) {
    document.documentElement.classList.toggle('hx-document-dark', dark);
    if (persist) { try { localStorage.setItem('helix-theme', dark ? 'dark' : 'light'); } catch (e) {} }
    $$('.hx-theme-toggle, .hx-theme-text').forEach((b) => {
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      b.setAttribute('aria-label', label); b.title = label;
      if (b.classList.contains('hx-theme-text')) b.textContent = label;
    });
  }
  function chrome() {
    let dark = false;
    try { dark = localStorage.getItem('helix-theme') === 'dark'; } catch (e) {}
    applyTheme(dark, false);
    $$('.hx-theme-toggle, .hx-theme-text').forEach((b) => { b.addEventListener('click', () => applyTheme(!document.documentElement.classList.contains('hx-document-dark'))); });

    const header = $('.hx-site-header');
    if (header) {
      const solid = header.classList.contains('is-solid');
      let lastY = Math.max(0, window.scrollY), scrolled = false, hidden = false;
      const onScroll = () => {
        const y = Math.max(0, window.scrollY);
        const nextScrolled = solid || y > (scrolled ? 8 : 48);
        const delta = y - lastY;
        if (y <= 8) { hidden = false; lastY = y; }
        else if (delta <= -4) { hidden = false; lastY = y; }
        else if (delta >= 4) { hidden = true; lastY = y; }
        if (nextScrolled !== scrolled) { scrolled = nextScrolled; header.classList.toggle('is-opaque', scrolled); }
        header.classList.toggle('is-hidden', hidden && !document.body.classList.contains('cart-open'));
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      const page = document.body.dataset.page;
      if (page) $$('.hx-nav a, .hx-mobile-menu nav a').forEach((a) => { if ((a.getAttribute('href') || '').split('#')[0] === page) a.setAttribute('aria-current', 'page'); });
    }
    const menu = $('.hx-mobile-menu');
    if (menu) {
      $$('.hx-header-menu').forEach((b) => b.addEventListener('click', () => { menu.classList.add('is-open'); document.body.style.overflow = 'hidden'; }));
      const close = () => { menu.classList.remove('is-open'); document.body.style.overflow = ''; };
      $$('.hx-mobile-menu .hx-close, .hx-mobile-menu nav a, .hx-mobile-menu .cta').forEach((b) => b.addEventListener('click', close));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
    $$('.hx-cart-btn').forEach((b) => b.addEventListener('click', () => { cart.mount(); cart.open(); }));
    if (document.body.dataset.shop !== undefined) cart.mount();
    cart.render();

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      const watch = () => $$('.rv:not(.in)').forEach((el) => io.observe(el));
      watch();
      new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
    } else { $$('.rv').forEach((el) => el.classList.add('in')); }

    $$('form[data-mailto]').forEach((f) => f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const subject = fd.get('subject') || f.dataset.subject || 'Message from the website';
      const lines = [];
      fd.forEach((v, k) => { if (k !== 'subject') lines.push(`${k}: ${v}`); });
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      const ok = f.querySelector('[data-sent]'); if (ok) ok.hidden = false;
    }));
    /* [data-member-only] is hidden by site.css and revealed only when membership
       discounts are switched back on; [data-member-alt] is the stand-in shown
       while they are off. Flipping MEMBER_DISCOUNTS swaps the two. */
    if (MEMBER_DISCOUNTS) {
      $$('[data-member-only]').forEach((el) => el.removeAttribute('data-member-only'));
      $$('[data-member-alt]').forEach((el) => el.remove());
    }
    if (window.HXSettings) window.HXSettings.apply(); else applySettings();
    previewBanner();
  }

  /* ------------------------------------------------------------- exports */
  window.HX = { EMAIL, esc, siteURL, cleanHref, $, $$, money, fmtDate, parseDate, param, lum, onColor, chipClass, load, settings, getPath, md, gallery, detailHref, productVisual, SDGS, sdgGrid, sdgPills, iconSVG, ICONS, mediaHTML, projectCard, newsCard, pubRow, eventRow, icsLink, art, productCard, cart, TIERS, MEMBER_DISCOUNTS, toast, applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chrome, { once: true }); else chrome();
})();
