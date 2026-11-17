export function authPage(setup: boolean, error?: string): string {
  const heading = setup ? 'Set your admin password' : 'Sign in';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading} · NeuroNest</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 1.25rem; min-height: 100dvh; display: grid; place-items: center;
      color: #f1f5f9; background: radial-gradient(ellipse at 50% 8%, #1a2923, #111214 67%); }
    main { width: min(100%, 26rem); background: #17191b; padding: clamp(1.4rem, 5vw, 2rem);
      border: 1px solid #323639; border-radius: 1.25rem; box-shadow: 0 1.5rem 4rem #0005; }
    .brand { display: flex; align-items: center; gap: .65rem; margin-bottom: 2rem; font-weight: 700; }
    .brand svg { width: 1.8rem; height: 1.8rem; padding: .25rem; border-radius: .45rem;
      background: #e9edf1; color: #141517; }
    h1 { margin: 0 0 .6rem; font-size: 1.75rem; letter-spacing: -.035em; }
    p { margin: 0 0 1.35rem; color: #b5bec5; line-height: 1.5; }
    form { display: grid; gap: 1rem; }
    label { display: grid; gap: .45rem; font-size: .9rem; font-weight: 600; }
    input, button { width: 100%; min-height: 2.8rem; border: 1px solid #41484c; border-radius: .65rem;
      padding: .6rem .8rem; color: inherit; background: #1f2225; font: inherit; }
    input:focus-visible, button:focus-visible { outline: 2px solid #6ee7b7; outline-offset: 2px; }
    button { border-color: transparent; cursor: pointer; font-weight: 700; background: #a7f3d0; color: #123225; }
    button:hover { background: #d1fae5; }
    .error { color: #fecdd3; background: #391e27; padding: .65rem .8rem; border-radius: .55rem; }
    .secondary { margin-top: .75rem; }
    .secondary button { background: transparent; color: #d6dce1; border-color: #41484c; }
  </style>
</head>
<body>
  <main aria-labelledby="heading">
    <div class="brand"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 10 6l4 8 6-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>NeuroNest</div>
    <h1 id="heading">${heading}</h1>
    ${setup ? '<p>Enter the one-time setup code from your VPS and choose a password with at least 12 characters.</p>' : ''}
    ${error ? `<p class="error" role="alert">${error}</p>` : ''}
    <form method="post" action="${setup ? '/setup-admin' : '/login'}">
      ${setup ? `
      <label>Setup code <input name="setupCode" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="64" required></label>
      <label>New password <input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>` : `
      <label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" maxlength="128" required></label>`}
      <button type="submit">${setup ? 'Save password' : 'Sign in'}</button>
    </form>
    ${setup ? '<form class="secondary" method="post" action="/logout"><button type="submit">Sign out</button></form>' : ''}
  </main>
</body>
</html>`;
}
