(function () {
  'use strict';

  const productionHosts = new Set([
    'ancientmysteriesrediscovered.com',
    'www.ancientmysteriesrediscovered.com'
  ]);
  if (productionHosts.has(location.hostname)) return;

  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const previewApi = local
    ? 'http://127.0.0.1:8787'
    : 'https://amr-exclusive-engagement-preview.belizean328.workers.dev';
  for (const name of ['amr-engagement-api', 'amr-membership-api']) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    if (meta) meta.content = previewApi;
  }
})();
