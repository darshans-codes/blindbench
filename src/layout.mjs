export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const routes = [
  ['Workspace', [
    ['Overview', '/overview', 'grid'],
    ['Studies', '/studies', 'list'],
  ]],
  ['Protocol', [
    ['Compute', '/compute', 'layers'],
    ['Privacy', '/privacy', 'shield'],
    ['Ledger', '/ledger', 'link'],
    ['Verify manifest', '/verify', 'check'],
  ]],
  ['Reference', [
    ['Histogram insights', '/insights', 'chart'],
    ['Benchmarks', '/benchmarks', 'chart'],
    ['Documentation', '/docs', 'book'],
  ]],
];

const shapes = {
  arrow: 'M4 8h8m-3.5-3.5L12 8l-3.5 3.5',
  external: 'M5 11l6-6M5 5h6v6',
  menu: 'M3 5h10M3 8h10M3 11h10',
  grid: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z',
  list: 'M5 4h8M5 8h8m-8 4h8M3 4h.01M3 8h.01M3 12h.01',
  layers: 'm2 6 6-3 6 3-6 3zm0 3 6 3 6-3m-12 3 6 3 6-3',
  shield: 'M8 2.5 13 4v4.1c0 2.5-2 4.3-5 5.5-3-1.2-5-3-5-5.5V4z',
  link: 'm6 10 4-4m-5 2-1 1a2.1 2.1 0 0 0 3 3l1-1m0-6 1-1a2.1 2.1 0 0 1 3 3l-1 1',
  check: 'M4 8l2.5 2.5L12 5m1.5 3a5.5 5.5 0 1 1-5.5-5.5',
  chart: 'M3 3v10h10M6 10V8m3 2V5m3 5V7',
  book: 'M8 5v8M2.5 3.5c3-.5 4.5 0 5.5 1.5 1-1.5 2.5-2 5.5-1.5v8c-3-.5-4.5 0-5.5 1.5-1-1.5-2.5-2-5.5-1.5z',
  plus: 'M3 8h10M8 3v10',
  search: 'M10.5 10.5 13 13M11.5 7.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  lock: 'M4 7h8v6H4zm2 0V5a2 2 0 0 1 4 0v2',
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="${shapes[name]}"/></svg>`;
}

export function brand() {
  return `<a class="brand" href="/" aria-label="BlindBench home"><img width="31" height="31" src="/mark.svg" alt=""><span>BlindBench<span class="brand-dot">.</span></span></a>`;
}

export function button(label, href, kind = 'primary', symbol = 'arrow') {
  return `<a class="button button-${kind}" href="${href}">${label}${symbol ? icon(symbol) : ''}</a>`;
}

export function pill(label, kind = '') {
  return `<span class="pill ${kind}"><span aria-hidden="true" class="dot"></span>${label}</span>`;
}

function navLinks(current) {
  return routes.map(([name, entries]) => `<div class="nav-group"><p>${name}</p>
    ${entries.map(([label, href, symbol]) => `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${icon(symbol)}${label}</a>`).join('')}
    </div>`).join('');
}

export function layout(title, content, current = '') {
  const isHome = current === '/';
  const appNav = `<aside class="sidebar" aria-label="Workspace navigation">
    ${brand()}
    <div class="side-workspace"><span>BB</span><div><strong>Demo workspace</strong><small>Local environment</small></div></div>
    <nav aria-label="Workspace">${navLinks(current)}</nav>
    <a class="sidebar-footer" href="/">${icon('external')} Back to homepage</a>
  </aside>`;
  const mobileNav = `<header class="mobile-header">${brand()}<details><summary aria-label="Toggle workspace navigation">${icon('menu')}</summary>
    <nav aria-label="Mobile workspace">${navLinks(current)}</nav></details></header>`;
  return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="BlindBench is a local privacy engineering workstation for synthetic studies.">
  <title>${escape(isHome ? 'BlindBench — Collective analytics, private by design' : `${title} · BlindBench`)}</title>
  <link rel="icon" type="image/svg+xml" href="/mark.svg"><link rel="stylesheet" href="/styles.css">
  <script type="module" src="/workbench.mjs"></script></head>
  <body class="${isHome ? 'landing' : 'workbench'}">
  <a class="skip" href="#main">Skip to content</a>
  ${isHome ? content : `<div class="app">${appNav}<div class="app-contents">${mobileNav}
    <div class="topbar"><span>Demo workspace <span class="crumb-separator">/</span> <b>${escape(title)}</b></span>${pill('Synthetic only', 'local')}</div>
    <main class="app-main" id="main">${content}</main></div></div>`}
  </body></html>`;
}

export function pageHeading(title, description, action = '', kicker = '') {
  return `<header class="page-heading"><div>${kicker ? `<p class="eyebrow">${kicker}</p>` : ''}<h1>${title}</h1><p>${description}</p></div>${action}</header>`;
}

export function definitionList(items, className = '') {
  return `<dl class="definition-list ${className}">${items.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

export function relativeDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
}
