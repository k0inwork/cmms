/**
 * Slide overlay renderer for showcase chains.
 * Opens a SEPARATE browser window that stays visible alongside
 * the demo windows. Shows explanatory slides synced with each step.
 */
import { chromium, type Browser, type Page } from "@playwright/test";

export interface Slide {
  title: string;
  body: string;
  flow?: string;
  highlight?: string; // role being demonstrated
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSlidesHtml(chainTitle: string, chainRoles: string[], slides: Slide[]): string {
  const slidesJson = JSON.stringify(slides);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(chainTitle)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .header {
    padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header h1 {
    font-size: 18px;
    font-weight: 600;
    color: #94a3b8;
  }
  .header .roles {
    font-size: 13px;
    color: #64748b;
  }
  .header .roles span {
    background: rgba(99,102,241,0.15);
    color: #a5b4fc;
    padding: 2px 10px;
    border-radius: 12px;
    margin-left: 6px;
    font-weight: 500;
  }

  /* ── Progress ── */
  .progress-bar {
    height: 3px;
    background: rgba(255,255,255,0.05);
  }
  .progress-bar .fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 0.5s ease;
  }

  /* ── Main slide area ── */
  .slide-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    opacity: 1;
    transition: opacity 0.3s ease;
  }
  .slide-container.fading { opacity: 0; }

  .slide {
    max-width: 800px;
    width: 100%;
  }
  .slide .step-label {
    font-size: 13px;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }
  .slide h2 {
    font-size: 36px;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.2;
    margin-bottom: 20px;
  }
  .slide .body {
    font-size: 17px;
    line-height: 1.7;
    color: #94a3b8;
    margin-bottom: 24px;
    white-space: pre-line;
  }
  .slide .body strong {
    color: #e2e8f0;
    font-weight: 600;
  }
  .slide .highlight-badge {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 14px;
    border-radius: 20px;
    margin-bottom: 16px;
  }

  /* ── ASCII flow ── */
  .flow {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 20px 24px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #64748b;
    overflow-x: auto;
    white-space: pre;
  }
  .flow .active {
    color: #a5b4fc;
    font-weight: 600;
  }
  .flow .done {
    color: #34d399;
  }
  .flow .arrow {
    color: #475569;
  }

  /* ── Next button ── */
  #nextBtn {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    font-size: 18px;
    font-weight: 700;
    padding: 14px 40px;
    border-radius: 12px;
    cursor: pointer;
    margin-top: 20px;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(99,102,241,0.4);
  }
  #nextBtn:hover { transform: scale(1.05); box-shadow: 0 6px 28px rgba(99,102,241,0.6); }
  #nextBtn:active { transform: scale(0.97); }

  /* ── Waiting state ── */
  .waiting {
    text-align: center;
    padding: 60px;
  }
  .waiting .dots::after {
    content: '';
    animation: dots 1.5s steps(4, end) infinite;
  }
  @keyframes dots {
    0% { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>${escapeHtml(chainTitle)}</h1>
  <div class="roles">${chainRoles.map(r => `<span>${escapeHtml(r)}</span>`).join("")}</div>
</div>

<div class="progress-bar">
  <div class="fill" id="progress" style="width: 0%"></div>
</div>

<div class="slide-container" id="container">
  <div class="waiting">
    <div style="font-size: 40px; margin-bottom: 16px;">&#9881;</div>
    <div style="font-size: 18px; color: #64748b;">Preparing demo<span class="dots"></span></div>
  </div>
</div>

<script>
const slides = ${slidesJson};
let current = -1;
window.__nextReady = false;

function renderSlide(index) {
  if (index < 0 || index >= slides.length) return;
  const s = slides[index];
  const container = document.getElementById('container');
  const progress = document.getElementById('progress');

  container.classList.add('fading');
  setTimeout(() => {
    const label = (index + 1 >= slides.length) ? 'Done' : 'Next \u2192';
    let html = '<div class="slide">';
    html += '<div class="step-label">Step ' + (index + 1) + ' / ' + slides.length + '</div>';
    if (s.highlight) {
      html += '<div class="highlight-badge">' + escapeHtml(s.highlight) + '</div>';
    }
    html += '<h2>' + escapeHtml(s.title) + '</h2>';
    html += '<div class="body">' + s.body + '</div>';
    if (s.flow) {
      html += '<div class="flow">' + s.flow + '</div>';
    }
    html += '<button id="nextBtn" onclick="window.__playwrightNext()">' + label + '</button>';
    html += '</div>';
    container.innerHTML = html;
    container.classList.remove('fading');
    progress.style.width = ((index + 1) / slides.length * 100) + '%';
    window.__nextReady = false;  // reset AFTER new button is in DOM
  }, 300);
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'goto') {
    current = e.data.slide;
    renderSlide(current);
  }
});

window.__slideTarget = -1;
setInterval(() => {
  if (window.__slideTarget !== current && window.__slideTarget >= 0) {
    current = window.__slideTarget;
    renderSlide(current);
  }
}, 200);
</script>

</body>
</html>`;
}

/**
 * Create a slide overlay in a SEPARATE browser window.
 * This ensures it stays visible even as demo windows open/close.
 * Returns { browser, page } — add browser to cleanup list.
 */
export interface SlideOverlay {
  slideBrowser: Browser;
  page: Page;
  totalSlides: number;
  gotoSlide: (index: number) => Promise<void>;
}

export async function createSlideOverlay(
  _browser: Browser,
  chainTitle: string,
  chainRoles: string[],
  slides: Slide[],
): Promise<SlideOverlay> {
  const html = renderSlidesHtml(chainTitle, chainRoles, slides);

  const slideBrowser = await chromium.launch({
    headless: false,
    args: ["--window-size=800,900"],
  });
  const context = await slideBrowser.newContext({ viewport: { width: 800, height: 900 } });
  const page = await context.newPage();

  // Expose a native callback — only fires on real human clicks
  let nextResolver: (() => void) | null = null;
  await page.exposeFunction("__playwrightNext", () => {
    if (nextResolver) {
      nextResolver();
      nextResolver = null;
    }
  });

  await page.setContent(html, { waitUntil: "domcontentloaded" });

  async function gotoSlide(index: number) {
    const promise = new Promise<void>((resolve) => { nextResolver = resolve; });
    await page.evaluate((i) => {
      (window as any).__slideTarget = i;
      (window as any).postMessage({ type: "goto", slide: i }, "*");
    }, index);
    await page.bringToFront();
    await promise; // waits until user clicks Next
  }

  return { slideBrowser, page, totalSlides: slides.length, gotoSlide };
}
