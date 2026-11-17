import express, { type Express, type Request, type RequestHandler, type Response } from 'express';
import { ADMIN_USERNAME, AuthStore, matchPassword, SESSION_LIFETIME_MS } from './authStore.ts';
import { authPage } from './authPage.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_TRACKED_CLIENTS = 4096;
const MAX_CONCURRENT_ATTEMPTS = 4;

function render(res: Response, setup: boolean, status = 200, error?: string) {
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(authPage(setup, error));
}

export function installAuth(app: Express, store: AuthStore, origin: URL) {
  const secure = origin.protocol === 'https:';
  const cookieName = secure ? '__Host-neuronest_session' : 'neuronest_session';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  const form = express.urlencoded({ extended: false, limit: '4kb', parameterLimit: 4 });

  const readToken = (req: Request) => req.headers.cookie?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const session = (req: Request) => store.getSession(readToken(req));
  const setSession = (res: Response, token: string) => {
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: SESSION_LIFETIME_MS });
  };
  const sameOrigin: RequestHandler = (req, res, next) => {
    if (req.get('origin') !== origin.origin) {
      res.status(403).json({ error: 'This request must come from NeuroNest.' });
      return;
    }
    next();
  };

  const attempts = new Map<string, { count: number; expiresAt: number }>();
  let activeAttempts = 0;
  setInterval(() => {
    for (const [ip, attempt] of attempts) {
      if (attempt.expiresAt <= Date.now()) attempts.delete(ip);
    }
  }, ATTEMPT_WINDOW_MS).unref();

  function limitAttempts(setup: boolean, handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
    return (req, res, next) => {
      const now = Date.now();
      const ip = req.ip || 'unknown';
      let attempt = attempts.get(ip);
      if (!attempt || attempt.expiresAt <= now) {
        if (!attempt && attempts.size >= MAX_TRACKED_CLIENTS) {
          render(res, setup, 429, 'Too many attempts. Try again later.');
          return;
        }
        attempt = { count: 0, expiresAt: now + ATTEMPT_WINDOW_MS };
        attempts.set(ip, attempt);
      }
      if (attempt.count >= MAX_ATTEMPTS || activeAttempts >= MAX_CONCURRENT_ATTEMPTS) {
        render(res, setup, 429, 'Too many attempts. Try again later.');
        return;
      }
      ++attempt.count;
      ++activeAttempts;
      void handler(req, res).catch(next).finally(() => { --activeAttempts; });
    };
  }

  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/login', (req, res) => {
    const current = session(req);
    if (current) res.redirect(303, current.setupRequired ? '/setup-admin' : '/');
    else render(res, false);
  });
  app.post('/login', sameOrigin, form, limitAttempts(false, async (req, res) => {
    const { username, password } = req.body ?? {};
    const admin = store.getAdmin();
    if (username !== ADMIN_USERNAME || typeof password !== 'string' || password.length > 128 || !admin ||
        !await matchPassword(password, admin.password_hash) || store.getAdmin()?.password_hash !== admin.password_hash) {
      render(res, false, 401, 'Incorrect username or password.');
      return;
    }
    const current = session(req);
    if (current) store.deleteSession(current.tokenHash);
    setSession(res, store.createSession());
    res.redirect(303, admin.setup_code_hash ? '/setup-admin' : '/');
  }));

  app.get('/setup-admin', (req, res) => {
    const current = session(req);
    if (!current) res.redirect(303, '/login');
    else if (!current.setupRequired) res.redirect(303, '/');
    else render(res, true);
  });
  app.post('/setup-admin', sameOrigin, form, limitAttempts(true, async (req, res) => {
    const token = readToken(req);
    if (!token || !store.getSession(token)?.setupRequired) {
      res.redirect(303, '/login');
      return;
    }
    const { password, setupCode } = req.body ?? {};
    if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !password.trim()) {
      render(res, true, 400, 'Choose a password between 12 and 128 characters.');
      return;
    }
    const newToken = typeof setupCode === 'string' && /^[0-9a-f]{64}$/.test(setupCode.trim())
      ? await store.finishSetup(password, setupCode.trim(), token)
      : undefined;
    if (!newToken) {
      render(res, true, 401, 'The setup code is invalid or has already been used.');
      return;
    }
    setSession(res, newToken);
    res.redirect(303, '/');
  }));

  app.post('/logout', sameOrigin, (req, res) => {
    const current = session(req);
    if (current) store.deleteSession(current.tokenHash);
    res.clearCookie(cookieName, cookieOptions);
    res.redirect(303, '/login');
  });

  app.use((req, res, next) => {
    // The external telemetry handler verifies the independent ingest bearer key.
    if (req.method === 'POST' && /^\/api\/telemetry\/events\/?$/i.test(req.path)) return next();
    const current = session(req);
    if (!current || current.setupRequired) {
      const destination = current ? '/setup-admin' : '/login';
      if (/^\/api(?:\/|$)/i.test(req.path) || !SAFE_METHODS.has(req.method)) {
        res.status(current ? 403 : 401).json({ error: current ? 'Complete admin setup.' : 'Sign in to NeuroNest.' });
      } else {
        res.redirect(303, destination);
      }
      return;
    }
    if (!SAFE_METHODS.has(req.method)) return sameOrigin(req, res, next);
    next();
  });
}
