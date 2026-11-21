/** The latest desktop release on GitHub, for the homepage download buttons. */

const REPO = process.env.AGENTHUB_RELEASES_REPO?.trim() || 'donnibrasco/agenthub';
const CACHE_MS = 10 * 60_000;

export const DOWNLOAD_FILES = { mac: 'AgentHub-mac.dmg', windows: 'AgentHub-windows-setup.exe' } as const;
export type DownloadOs = keyof typeof DOWNLOAD_FILES;

export interface DesktopRelease {
  version: string;
  publishedAt: string;
  urls: Partial<Record<DownloadOs, string>>;
  sizes: Partial<Record<DownloadOs, number>>;
}

let cache: { at: number; release: DesktopRelease | null } | null = null;
let inflight: Promise<DesktopRelease | null> | null = null;

async function fetchLatest(): Promise<DesktopRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AgentHub-server' },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = await res.json() as { tag_name?: string; published_at?: string; assets?: { name: string; browser_download_url: string; size: number }[] };
  const release: DesktopRelease = { version: String(data.tag_name || '').replace(/^desktop-v/, '').replace(/^v/, ''), publishedAt: String(data.published_at || ''), urls: {}, sizes: {} };
  for (const os of Object.keys(DOWNLOAD_FILES) as DownloadOs[]) {
    const asset = data.assets?.find(a => a.name === DOWNLOAD_FILES[os]);
    if (asset?.browser_download_url.startsWith('https://github.com/')) {
      release.urls[os] = asset.browser_download_url;
      release.sizes[os] = asset.size;
    }
  }
  return Object.keys(release.urls).length ? release : null;
}

/** Cached; on errors keeps the last known release. Never throws. */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.release;
  inflight ??= fetchLatest()
    .then(release => { cache = { at: Date.now(), release }; return release; })
    .catch(() => { cache = { at: Date.now() - CACHE_MS + 60_000, release: cache?.release ?? null }; return cache.release; })
    .finally(() => { inflight = null; });
  return inflight;
}
