import { readFile } from 'node:fs/promises';

const enabled = process.env.AMR_NOTIFICATIONS_ENABLED === 'true';
if (!enabled) {
  console.log('AMR release notifications are disabled; no request was sent.');
  process.exit(0);
}

const apiOrigin = process.env.AMR_API_ORIGIN?.replace(/\/$/, '');
const secret = process.env.AMR_RELEASE_WEBHOOK_SECRET;
if (!apiOrigin || !secret) {
  throw new Error('AMR_API_ORIGIN and AMR_RELEASE_WEBHOOK_SECRET are required when notifications are enabled.');
}

const manifest = JSON.parse(await readFile(new URL('../data/member-notification-releases.json', import.meta.url), 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.releases)) {
  throw new Error('Unsupported member notification release manifest.');
}

const categories = new Set(['cinema', 'investigation', 'series']);
const now = Date.now();
const published = manifest.releases.filter((release) => {
  const publishedAt = Date.parse(release.publishedAt);
  return release.status === 'published' && categories.has(release.category)
    && Number.isFinite(publishedAt) && publishedAt <= now;
});

for (const release of published) {
  if (!release.id || !release.title || !release.url) {
    throw new Error('Every published release requires id, category, title, url, and publishedAt.');
  }
  const response = await fetch(`${apiOrigin}/internal/releases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(release)
  });
  if (!response.ok) {
    throw new Error(`Release ${release.id} was rejected (${response.status}): ${await response.text()}`);
  }
  console.log(`Accepted release ${release.id}; the Worker will deduplicate it.`);
}

if (published.length === 0) console.log('No published releases were eligible; no request was sent.');
