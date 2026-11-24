import { BINS, EXAMPLE_RESULT } from './studies.mjs';
import { brand, button, escape, icon, layout, pill } from './layout.mjs';

export function histogram({ interactive = false } = {}) {
  return `<div class="histogram" aria-label="Illustrative counts in seven fictional compensation bins">
    <div class="chart-grid" aria-hidden="true"><span>25</span><span>20</span><span>15</span><span>10</span><span>5</span><span>0</span></div>
    <ol class="chart-bars">${EXAMPLE_RESULT.map((count, index) => `<li${index === 3 ? ' class="highlight"' : ''}>
      <div class="bar-track"><span class="bar level-${count}"${interactive && index === 3 ? ' data-example-bar' : ''}></span></div>
      <span class="bin-label">${escape(BINS[index])}</span><span class="visually-hidden">: <span${interactive && index === 3 ? ' data-example-count' : ''}>${count}</span> fictional contributions</span></li>`).join('')}
    </ol>
  </div>`;
}

const stages = [
  ['lock', 'Contribute in private', 'The participant’s device prepares encrypted reports. Each aggregator receives its own encrypted share.'],
  ['layers', 'Compute in two parts', 'The two aggregation services validate reports and combine only their aggregate shares.'],
  ['check', 'Inspect what’s released', 'A fixed privacy policy governs the histogram. An independent check compares the manifest with its audit commitment.'],
];

export function home() {
  const content = `
  <header class="home-header"><div class="home-wrap home-nav">${brand()}
    <nav aria-label="Primary"><a href="#protocol">How it works</a><a href="/docs">Documentation</a></nav>
    ${button('Open workspace', '/overview', 'outline', 'external')}
  </div></header>
  <main id="main">
    <section class="home-wrap hero">
      <div class="hero-copy">
        <p class="eyebrow hero-eyebrow"><span></span> PRIVACY ENGINEERING WORKSTATION</p>
        <h1>Learn together.<br><em>Reveal less.</em></h1>
        <p>Explore how organizations can learn from a group without collecting everyone’s raw data in one place.</p>
        <div class="hero-actions">${button('Open demo workspace', '/overview', 'primary')}${button('Explore the protocol', '#protocol', 'quiet')}</div>
        <p class="hero-note">${icon('lock')} Local environment · Fictional data only</p>
      </div>
      <div class="hero-visual" aria-label="Fictional release preview">
        <div class="console">
          <div class="console-top"><span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>BlindBench / study preview</span>${icon('layers')}</div>
          <div class="console-body">
            <div class="console-label">${pill('Illustrative data', 'purple')}<span>HISTOGRAM</span></div>
            <h2>Compensation distribution</h2>
            <p>Annual compensation in INR lakh</p>
            ${histogram()}
            <div class="console-foot"><span><i aria-hidden="true"></i> Fictional count</span><a href="/privacy">Inspect the example ${icon('external')}</a></div>
          </div>
        </div>
      </div>
    </section>
    <section class="protocol-section" id="protocol"><div class="home-wrap">
      <div class="protocol-header"><div><p class="eyebrow">THE PROTOCOL</p><h2>From input to insight.</h2></div><p>See where the data goes, who can access it, and what a published result can tell you.</p></div>
      <div class="stage-grid">${stages.map(([symbol, heading, description]) => `<article class="stage"><span class="stage-icon">${icon(symbol)}</span><h3>${heading}</h3><p>${description}</p></article>`).join('')}</div>
      <div class="home-callout"><span class="stage-icon">${icon('shield')}</span><div><h3>Trust assumptions are part of the design.</h3><p>The aggregators must operate independently. The collector enforces the release policy, and a commitment attests to artifact integrity.</p></div>${button('Read the threat model', '/docs#trust', 'outline', 'external')}</div>
    </div></section>
  </main>
  <footer class="home-wrap home-footer">${brand()}<p>Built for synthetic, local privacy experiments.</p><a href="/docs">Documentation ${icon('external')}</a></footer>`;
  return layout('Home', content, '/');
}
