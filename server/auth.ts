import { randomBytes } from 'node:crypto';
import express, { type Express, type Request, type RequestHandler, type Response } from 'express';
import { ADMIN_USERNAME, AuthStore, matchPassword, SESSION_LIFETIME_MS } from './authStore.ts';
import { authPage } from './authPage.ts';
import { landingPage } from './landingPage.ts';
import { latestDesktopRelease } from './releases.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const MAX_TRACKED_CLIENTS = 4096;
const MAX_CONCURRENT_ATTEMPTS = 4;

function render(res: Response, status = 200, error?: string) {
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(authPage(error));
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
      res.status(403).json({ error: 'This request must come from AgentHub.' });
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

  function limitAttempts(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
    return (req, res, next) => {
      const now = Date.now();
      const ip = req.ip || 'unknown';
      let attempt = attempts.get(ip);
      if (!attempt || attempt.expiresAt <= now) {
        if (!attempt && attempts.size >= MAX_TRACKED_CLIENTS) {
          render(res, 429, 'Too many attempts. Try again later.');
          return;
        }
        attempt = { count: 0, expiresAt: now + ATTEMPT_WINDOW_MS };
        attempts.set(ip, attempt);
      }
      if (attempt.count >= MAX_ATTEMPTS || activeAttempts >= MAX_CONCURRENT_ATTEMPTS) {
        render(res, 429, 'Too many attempts. Try again later.');
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
    if (session(req)) res.redirect(303, '/');
    else render(res);
  });
  app.post('/login', sameOrigin, form, limitAttempts(async (req, res) => {
    const { username, password } = req.body ?? {};
    const admin = store.getAdmin();
    if (username !== ADMIN_USERNAME || typeof password !== 'string' || password.length > 128 || !admin ||
        !await matchPassword(password, admin.password_hash) || store.getAdmin()?.password_hash !== admin.password_hash) {
      render(res, 401, 'Incorrect username or password.');
      return;
    }
    const current = session(req);
    if (current) store.deleteSession(current.tokenHash);
    setSession(res, store.createSession());
    res.redirect(303, '/');
  }));

  app.all('/setup-admin', (_req, res) => res.redirect(303, '/login'));

  app.post('/logout', sameOrigin, (req, res) => {
    const current = session(req);
    if (current) store.deleteSession(current.tokenHash);
    res.clearCookie(cookieName, cookieOptions);
    res.redirect(303, '/login');
  });

  app.use((req, res, next) => {
    // The external telemetry handler verifies the independent ingest bearer key.
    if (req.method === 'POST' && /^\/api\/telemetry\/events\/?$/i.test(req.path)) return next();
    // Public: desktop downloads, and the homepage for visitors who aren't signed in.
    if (req.method === 'GET' && /^\/download\/(mac|windows)\/?$/i.test(req.path)) return next();
    if ((req.method === 'GET' || req.method === 'HEAD') && req.path === '/' && !session(req)) {
      void latestDesktopRelease().then(release => {
        const nonce = randomBytes(16).toString('base64');
        res.set('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
        res.set('Cache-Control', 'no-store');
        res.type('html').send(landingPage({ release, nonce }));
      });
      return;
    }
    // The computer connector authenticates every request with its own device key (see devices.ts).
    if (/^\/api\/connector\//i.test(req.path)) return next();
    // The connector program itself is public: it holds no secrets until a device key is given to it.
    if (req.method === 'GET' && /^\/connector\/agenthub-connector\.mjs$/i.test(req.path)) return next();
    if (!session(req)) {
      if (/^\/api(?:\/|$)/i.test(req.path) || !SAFE_METHODS.has(req.method)) {
        res.status(401).json({ error: 'Sign in to AgentHub.' });
      } else {
        res.redirect(303, '/login');
      }
      return;
    }
    if (!SAFE_METHODS.has(req.method)) return sameOrigin(req, res, next);
    next();
  });
}
