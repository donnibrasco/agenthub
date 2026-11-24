import type { DesktopRelease } from './releases.ts';

/** The public homepage: hero, product preview, features, and desktop downloads. */

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const mb = (bytes?: number) => (bytes ? `${Math.round(bytes / 1e6)} MB` : '');

const LOGO = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 6L14 14L20 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const APPLE = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.29-3.53zM14.2 6.16c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z"/></svg>';
const WINDOWS = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.1 10.4 4v7.1H3V5.1zm8.3-1.2L21 2.5v8.6h-9.7V3.9zM3 12.9h7.4V20L3 18.9v-6zm8.3 0H21v8.6l-9.7-1.4v-7.2z"/></svg>';
const ICON = (d: string) => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export function landingPage({ release, nonce, signedIn = false }: { release: DesktopRelease | null; nonce: string; signedIn?: boolean }): string {
  // Signed-in people see "Open AgentHub" (the workspace at /) instead of "Sign in".
  const appLink = signedIn ? '<a class="keep" href="/">Open AgentHub</a>' : '<a class="keep" href="/login">Sign in</a>';
  const version = release ? esc(release.version) : '';
  const has = { mac: Boolean(release?.urls.mac), windows: Boolean(release?.urls.windows) };
  const meta = {
    mac: has.mac ? `v${version} · Apple silicon &amp; Intel · macOS 12+ · ${mb(release?.sizes.mac)}` : 'Coming soon',
    windows: has.windows ? `v${version} · Windows 10 &amp; 11 · 64-bit · ${mb(release?.sizes.windows)}` : 'Coming soon',
  };
  const button = (os: 'mac' | 'windows', primary: boolean) => has[os]
    ? `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" data-os="${os}" href="/download/${os}">${os === 'mac' ? APPLE : WINDOWS}<span>Download for ${os === 'mac' ? 'macOS' : 'Windows'}</span></a>`
    : `<span class="btn ${primary ? 'btn-primary' : 'btn-secondary'} is-disabled" data-os="${os}" aria-disabled="true">${os === 'mac' ? APPLE : WINDOWS}<span>${os === 'mac' ? 'macOS' : 'Windows'} app coming soon</span></span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>AgentHub: every AI agent, one workspace</title>
<meta name="description" content="Send a job once and follow it on one timeline: Codex and Claude Code on your computer, plus Gemini, Hermes and any API agent. Download AgentHub for macOS and Windows.">
<meta name="theme-color" content="#faf8f4">
<meta property="og:title" content="AgentHub: every AI agent, one workspace">
<meta property="og:description" content="Codex, Claude Code, Gemini and more, with one timeline for every job.">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#08666c"/><path d="M8 22l6-12 4 8 6-8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')}">
<style>
  :root { --ink:#282820; --ink2:#4b4941; --muted:#665f54; --faint:#8a8478; --page:#faf8f4; --surface:#fffdfa; --subtle:#f2eee6; --line:#e7e2d9; --line2:#d8d3ca; --teal:#08666c; --teal-soft:#e9f2eb; --primary:#262922; color-scheme: light; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--page); color: var(--ink); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .wrap { width: min(1120px, 100% - 40px); margin-inline: auto; }
  .nav { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--page) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid transparent; }
  .nav .wrap { display: flex; align-items: center; gap: 24px; height: 68px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 18px; text-decoration: none; letter-spacing: -.01em; }
  .brand-mark { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--teal); color: #fff; }
  .nav-links { display: flex; gap: 22px; margin-left: auto; font-size: 15px; }
  .nav-links a { text-decoration: none; color: var(--muted); }
  .nav-links a:hover { color: var(--ink); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border-radius: 14px; font: inherit; font-weight: 550; text-decoration: none; transition: background .15s, transform .15s, border-color .15s; white-space: nowrap; }
  .btn:focus-visible { outline: 2px solid var(--teal); outline-offset: 3px; }
  .btn-primary { background: var(--primary); color: #fff; box-shadow: 0 10px 30px -12px #26292299; }
  .btn-primary:hover { background: #3b4236; transform: translateY(-1px); }
  .btn-secondary { border: 1px solid var(--line2); background: var(--surface); color: var(--ink2); }
  .btn-secondary:hover { border-color: #b9b3a7; }
  .btn-small { min-height: 38px; padding: 0 16px; border-radius: 11px; font-size: 15px; }
  .is-disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
  .hero { padding: 72px 0 40px; text-align: center; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font-size: 14px; }
  .eyebrow b { color: var(--teal); font-weight: 600; }
  h1 { margin: 22px auto 0; max-width: 880px; font-size: clamp(42px, 7vw, 76px); line-height: 1.02; letter-spacing: -.035em; font-weight: 650; }
  h1 em { font-style: normal; color: var(--teal); }
  .lead { margin: 22px auto 0; max-width: 660px; font-size: clamp(17px, 2.2vw, 20px); color: var(--muted); }
  .cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 34px; }
  .cta-note { margin-top: 14px; font-size: 14px; color: var(--faint); }
  .cta-note a { color: var(--ink2); }
  .preview { margin: 56px auto 0; max-width: 980px; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); box-shadow: 0 40px 80px -40px #26251e40, 0 2px 6px #26251e0d; overflow: hidden; text-align: left; }
  .chrome { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--subtle); }
  .chrome i { width: 11px; height: 11px; border-radius: 50%; background: #d8d3ca; }
  .chrome span { margin-left: 10px; font-size: 13px; color: var(--faint); }
  .app { display: grid; grid-template-columns: 210px 1fr; min-height: 430px; }
  .side { padding: 18px 14px; border-right: 1px solid var(--line); background: #f5f1ea; font-size: 14px; color: var(--muted); }
  .side .new { display: block; padding: 9px 12px; border-radius: 10px; background: var(--primary); color: #fff; font-weight: 550; text-align: center; margin-bottom: 16px; }
  .side p { margin: 4px 0; padding: 7px 10px; border-radius: 9px; }
  .side p.on { background: var(--teal); color: #fff; }
  .chat { padding: 26px 30px; display: grid; gap: 22px; align-content: start; }
  .bubble { justify-self: end; max-width: 78%; padding: 10px 16px; border-radius: 22px 22px 8px 22px; background: #ebe7de; font-size: 15px; }
  .reply { display: grid; grid-template-columns: 32px 1fr; gap: 14px; }
  .avatar { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--teal); color: #fff; }
  .who { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .steps { margin: 0 0 14px 5px; padding: 0 0 0 16px; border-left: 1px solid #e2ddd3; list-style: none; display: grid; gap: 10px; font-size: 14px; color: var(--muted); }
  .steps li { position: relative; }
  .steps li::before { content: ""; position: absolute; left: -21.5px; top: 8px; width: 10px; height: 10px; border-radius: 50%; background: #3f9a6e; box-shadow: 0 0 0 4px var(--surface); }
  .steps li.think::before { background: #b9b3a7; }
  .steps b { color: var(--ink); font-weight: 600; }
  .answer { font-size: 15px; }
  .answer table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13.5px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .answer th { background: var(--subtle); text-align: left; padding: 8px 12px; }
  .answer td { padding: 8px 12px; border-top: 1px solid #efebe3; }
  .live { display: inline-flex; gap: 8px; align-items: center; color: var(--teal); font-weight: 550; font-size: 14px; }
  .live::before { content: "✻"; color: #c46a3a; animation: spin 3s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  section.block { padding: 96px 0 0; }
  .kicker { color: var(--teal); font-weight: 600; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; }
  h2 { margin: 10px 0 0; font-size: clamp(30px, 4.5vw, 44px); line-height: 1.1; letter-spacing: -.025em; font-weight: 650; }
  .sub { margin: 14px 0 0; color: var(--muted); max-width: 620px; font-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 40px; }
  .card { padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); }
  .card .ic { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--teal-soft); color: var(--teal); }
  .card h3 { margin: 18px 0 6px; font-size: 18px; letter-spacing: -.01em; }
  .card p { margin: 0; color: var(--muted); font-size: 15px; }
  .agents { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
  .agents span { padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-size: 14px; color: var(--ink2); }
  .steps3 { counter-reset: s; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 40px; }
  .steps3 .card::before { counter-increment: s; content: counter(s); display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: #fff; font-weight: 600; }
  .download { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .dl { padding: 28px; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); display: grid; gap: 16px; align-content: start; }
  .dl-head { display: flex; align-items: center; gap: 14px; }
  .dl-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px; background: var(--subtle); color: var(--ink); }
  .dl h3 { margin: 0; font-size: 22px; }
  .dl .meta { margin: 2px 0 0; color: var(--faint); font-size: 14px; }
  .dl .btn { width: 100%; }
  .dl details { font-size: 14px; color: var(--muted); }
  .dl summary { cursor: pointer; color: var(--ink2); font-weight: 550; }
  .dl ol { margin: 10px 0 0; padding-left: 20px; }
  .dl.is-mine { border-color: #8bb6ae; box-shadow: 0 0 0 4px #e7efe7; }
  .final { margin: 96px 0 0; padding: 56px 28px; border-radius: 28px; background: var(--primary); color: #f4f1ea; text-align: center; }
  .final h2 { color: #fff; }
  .final p { color: #c9c4b8; margin: 12px auto 0; max-width: 520px; }
  .final .btn-primary { background: #fff; color: var(--primary); box-shadow: none; }
  .final .btn-primary:hover { background: #eeeae2; }
  .final .btn-secondary { background: transparent; border-color: #ffffff40; color: #fff; }
  footer { padding: 40px 0 calc(40px + env(safe-area-inset-bottom)); color: var(--faint); font-size: 14px; }
  footer .wrap { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; }
  @media (max-width: 760px) {
    .nav-links a:not(.keep) { display: none; }
    .app { grid-template-columns: 1fr; }
    .side { display: none; }
    .chat { padding: 20px; }
    .hero { padding-top: 48px; }
    .bubble { max-width: 92%; }
  }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
</style>
</head>
<body>
<header class="nav">
  <div class="wrap">
    <a class="brand" href="/download"><span class="brand-mark">${LOGO}</span>AgentHub</a>
    <nav class="nav-links" aria-label="Main">
      <a href="#features">Features</a>
      <a href="#how">How it works</a>
      <a href="#download">Download</a>
      ${appLink}
    </nav>
  </div>
</header>

<main>
  <section class="hero wrap">
    <span class="eyebrow"><b>New</b> Desktop app for macOS and Windows</span>
    <h1>Every AI agent, <em>one workspace.</em></h1>
    <p class="lead">Send a job once and follow it on a single timeline, whether it runs on Codex and Claude Code on your own computer or on Gemini, Hermes and any API you connect.</p>
    <div class="cta" id="hero-cta">
      ${button('mac', true)}
      ${button('windows', false)}
    </div>
    <p class="cta-note">${release ? `Free · Version ${version} · ` : ''}Or <a href="${signedIn ? '/' : '/login'}">open AgentHub in your browser</a></p>

    <div class="preview" role="img" aria-label="AgentHub showing a job: the agent searched the web, then answered with a comparison table">
      <div class="chrome"><i></i><i></i><i></i><span>AgentHub</span></div>
      <div class="app">
        <div class="side" aria-hidden="true">
          <span class="new">+ New chat</span>
          <p class="on">Timeline</p><p>Connections</p><p>Jobs &amp; Tasks</p><p>Workflows</p><p>Usage</p>
        </div>
        <div class="chat" aria-hidden="true">
          <div class="bubble">Compare the top vector databases on latency and price.</div>
          <div class="reply">
            <span class="avatar">${LOGO}</span>
            <div>
              <div class="who">Claude Code <span style="color:var(--faint);font-weight:400">· on your computer</span></div>
              <ul class="steps">
                <li class="think"><b>Thinking</b>: needs current pricing, so check official pages first.</li>
                <li><b>Searched the web</b> · vector database latency benchmark 2026</li>
                <li><b>Read web page</b> · qdrant.tech/pricing</li>
              </ul>
              <div class="answer">
                Here's the comparison. <b>pgvector</b> is simplest if you already run Postgres.
                <table><thead><tr><th>Database</th><th>p95 latency</th><th>From</th></tr></thead>
                <tbody><tr><td>pgvector</td><td>~25 ms</td><td>Free</td></tr><tr><td>Qdrant</td><td>~8 ms</td><td>$25/mo</td></tr><tr><td>Pinecone</td><td>~12 ms</td><td>$70/mo</td></tr></tbody></table>
              </div>
            </div>
          </div>
          <div class="reply"><span class="avatar" style="background:#282820">${LOGO}</span><div><div class="who">Codex <span style="color:var(--faint);font-weight:400">· on your computer</span></div><span class="live">Researching…</span></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="block wrap" id="features">
    <span class="kicker">Why AgentHub</span>
    <h2>Stop juggling agent tabs.</h2>
    <p class="sub">Codex, Claude Code and your API agents live in one place, so every job, answer and file is in one timeline you can come back to.</p>
    <div class="grid">
      <div class="card"><span class="ic">${ICON('<path d="M3 12h4l3-8 4 16 3-8h4"/>')}</span><h3>One timeline</h3><p>Every job from every agent in one feed. See what's working, what finished and what needs you.</p></div>
      <div class="card"><span class="ic">${ICON('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>')}</span><h3>Your plans, your computer</h3><p>Codex runs with your ChatGPT plan and Claude Code with your Claude plan, right on your machine. No API credits needed.</p></div>
      <div class="card"><span class="ic">${ICON('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}</span><h3>Watch agents work</h3><p>Follow each step live: thinking, web searches, pages read and files opened, then a clean, formatted answer.</p></div>
      <div class="card"><span class="ic">${ICON('<path d="M21 12.5 12.6 21a5 5 0 0 1-7.1-7.1l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-2.8-2.8l8.3-8.3"/>')}</span><h3>Bring your files</h3><p>Drop in screenshots, PDFs, notes and code. Agents that can see images get them; the rest get the text.</p></div>
    </div>
    <div class="agents" aria-label="Works with">
      <span>Codex</span><span>Claude Code</span><span>Gemini</span><span>Anthropic API</span><span>OpenAI-compatible</span><span>Ollama</span><span>Hermes</span><span>OpenClaw</span><span>DeepSeek</span><span>vLLM</span>
    </div>
  </section>

  <section class="block wrap" id="how">
    <span class="kicker">How it works</span>
    <h2>Up and running in minutes.</h2>
    <div class="steps3">
      <div class="card"><h3>Download and sign in</h3><p>Install AgentHub for macOS or Windows and sign in to your workspace.</p></div>
      <div class="card"><h3>Connect your agents</h3><p>One click installs and signs in Codex or Claude Code on this computer. Add API agents like Gemini any time.</p></div>
      <div class="card"><h3>Send a job</h3><p>Describe the work, attach files, pick an agent. Follow it live and find it on your timeline later.</p></div>
    </div>
  </section>

  <section class="block wrap" id="download">
    <span class="kicker">Download</span>
    <h2>Get AgentHub for your computer.</h2>
    <p class="sub">Runs quietly in the menu bar or system tray, so your agents are ready whenever you send a job.</p>
    <div class="download">
      <div class="dl" data-card="mac">
        <div class="dl-head"><span class="dl-icon">${APPLE}</span><div><h3>macOS</h3><p class="meta">${meta.mac}</p></div></div>
        ${button('mac', true)}
        <details><summary>First time opening it?</summary><ol><li>Open the .dmg and drag AgentHub to Applications.</li><li>Open AgentHub from Applications. macOS warns once because the app isn't signed with Apple yet.</li><li><b>macOS 15 or later:</b> click <b>Done</b>, then open <b>System Settings → Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b>.</li><li><b>macOS 12–14:</b> right-click AgentHub and choose <b>Open</b>, then <b>Open</b> again.</li></ol></details>
      </div>
      <div class="dl" data-card="windows">
        <div class="dl-head"><span class="dl-icon">${WINDOWS}</span><div><h3>Windows</h3><p class="meta">${meta.windows}</p></div></div>
        ${button('windows', true)}
        <details><summary>First time opening it?</summary><ol><li>Run AgentHub-windows-setup.exe. It installs for your user only, without admin rights.</li><li>If Windows SmartScreen appears, click <b>More info → Run anyway</b>. (This app isn't code-signed yet.)</li></ol></details>
      </div>
    </div>
    <p class="cta-note" style="text-align:left">Using Linux, or prefer a terminal? ${signedIn ? 'Open' : 'Sign in, open'} <b>Connections → Add a computer</b> and run the one-line connector command.</p>
  </section>

  <section class="wrap">
    <div class="final">
      <h2>All your agents. One place.</h2>
      <p>Free to download. Bring the subscriptions you already have.</p>
      <div class="cta">${button('mac', true)}${button('windows', false)}</div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap"><span>© ${new Date().getFullYear()} AgentHub by AgenticProcess</span><span>${signedIn ? '<a href="/">Open AgentHub</a>' : '<a href="/login">Sign in</a>'}</span></div>
</footer>

<script nonce="${nonce}">
  // Put this computer's download first and highlight its card.
  (function () {
    var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    var os = /win/i.test(ua) ? 'windows' : /mac|iphone|ipad/i.test(ua) ? 'mac' : '';
    if (!os) return;
    var other = os === 'mac' ? 'windows' : 'mac';
    document.querySelectorAll('.cta').forEach(function (cta) {
      var mine = cta.querySelector('[data-os="' + os + '"]');
      var theirs = cta.querySelector('[data-os="' + other + '"]');
      if (!mine || !theirs) return;
      cta.insertBefore(mine, theirs);
      var dark = cta.closest('.final');
      mine.classList.add('btn-primary'); mine.classList.remove('btn-secondary');
      theirs.classList.add('btn-secondary'); theirs.classList.remove('btn-primary');
      if (dark) return;
    });
    var card = document.querySelector('[data-card="' + os + '"]');
    if (card) { card.classList.add('is-mine'); card.parentNode.insertBefore(card, card.parentNode.firstChild); }
  })();
</script>
</body>
</html>`;
}
