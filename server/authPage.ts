export function authPage(error?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · AgentHub</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 1.25rem; min-height: 100dvh; display: grid; place-items: center;
      color: #282820; background: #faf8f4; -webkit-font-smoothing: antialiased; }
    main { width: min(100%, 26rem); background: #fffdfa; padding: clamp(1.4rem, 5vw, 2rem);
      border: 1px solid #e7e2d9; border-radius: 1rem; box-shadow: 0 1px 2px #26251e0a, 0 1rem 2.5rem #26251e0d; }
    .brand { display: flex; align-items: center; gap: .65rem; margin-bottom: 2rem; font-weight: 600; font-size: 1.05rem; }
    .brand svg { width: 1.8rem; height: 1.8rem; padding: .3rem; border-radius: .5rem;
      background: #08666c; color: #fff; }
    h1 { margin: 0 0 .6rem; font-size: 1.875rem; font-weight: 600; letter-spacing: -.025em; }
    p { margin: 0 0 1.35rem; color: #665f54; line-height: 1.5; }
    form { display: grid; gap: 1rem; }
    label { display: grid; gap: .45rem; font-size: .875rem; font-weight: 500; color: #4b4941; }
    input, button { width: 100%; min-height: 2.75rem; border: 1px solid #d8d3ca; border-radius: .75rem;
      padding: .6rem .8rem; color: #282820; background: #fffdfa; font: inherit; }
    input:focus-visible, button:focus-visible { outline: 2px solid #08666c; outline-offset: 2px; }
    button { margin-top: .25rem; border-color: transparent; cursor: pointer; font-weight: 500; background: #262922; color: #fff; }
    button:hover { background: #3b4236; }
    .error { color: #922d1d; background: #f9ece4; border: 1px solid #a44e3240; padding: .65rem .8rem; border-radius: .6rem; }
    footer { margin-top: 1.5rem; color: #665f54; font-size: .75rem; text-align: center; }
  </style>
</head>
<body>
  <main aria-labelledby="heading">
    <div class="brand"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 10 6l4 8 6-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>AgentHub</div>
    <h1 id="heading">Sign in</h1>
    ${error ? `<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="/login">
      <label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" maxlength="128" required></label>
      <button type="submit">Sign in</button>
    </form>
    <footer><a href="/" style="color:inherit">Download the desktop app</a> · by AgenticProcess</footer>
  </main>
</body>
</html>`;
}
