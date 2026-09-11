(() => {
  const CONFIG_URL = '/data/video-releases.json';

  function parseReleaseTime(value) {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  }

  function effectiveState(item) {
    const state = item?.state || 'off';
    if (state !== 'scheduled') return state;
    const releaseTime = parseReleaseTime(item.releaseAt);
    if (!releaseTime) return 'coming-soon';
    return Date.now() >= releaseTime ? 'live' : 'coming-soon';
  }

  function posterMarkup(item, host) {
    const title = item?.title || host.dataset.videoTitle || 'New story';
    const label = item?.comingSoonLabel || 'COMING SOON';
    const date = item?.releaseLabel || '';
    const poster = item?.poster || host.dataset.videoPoster || '';
    const posterStyle = poster ? ` style="background-image:url('${poster.replace(/'/g, '%27')}')"` : '';

    return `
      <div class="amr-release-card amr-release-coming"${posterStyle}>
        <div class="amr-release-shade"></div>
        <div class="amr-release-copy">
          <span class="amr-release-kicker">ANCIENT MYSTERIES REDISCOVERED</span>
          <strong>${escapeHtml(label)}</strong>
          <h3>${escapeHtml(title)}</h3>
          ${date ? `<p>${escapeHtml(date)}</p>` : ''}
        </div>
      </div>`;
  }

  function liveMarkup(item, host) {
    const title = item?.title || host.dataset.videoTitle || 'Watch the story';
    const url = item?.videoUrl || '';
    const poster = item?.poster || host.dataset.videoPoster || '';
    if (!url) return posterMarkup({ ...item, comingSoonLabel: 'COMING SOON' }, host);

    const posterStyle = poster ? ` style="background-image:url('${poster.replace(/'/g, '%27')}')"` : '';
    return `
      <a class="amr-release-card amr-release-live" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"${posterStyle} aria-label="Watch ${escapeAttr(title)}">
        <div class="amr-release-shade"></div>
        <div class="amr-release-copy">
          <span class="amr-release-kicker">WATCH THE STORY</span>
          <strong class="amr-release-play" aria-hidden="true">▶</strong>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </a>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  async function init() {
    const hosts = [...document.querySelectorAll('[data-video-release-id]')];
    if (!hosts.length) return;

    try {
      const response = await fetch(`${CONFIG_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Release config ${response.status}`);
      const config = await response.json();

      hosts.forEach(host => {
        const id = host.dataset.videoReleaseId;
        const item = config?.releases?.[id] || { state: 'off' };
        const state = effectiveState(item);

        host.dataset.videoReleaseState = state;
        if (state === 'off') {
          host.hidden = true;
          return;
        }

        host.hidden = false;
        host.innerHTML = state === 'live' ? liveMarkup(item, host) : posterMarkup(item, host);
      });
    } catch (error) {
      console.error('[AMR video release]', error);
      hosts.forEach(host => { host.hidden = true; });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
