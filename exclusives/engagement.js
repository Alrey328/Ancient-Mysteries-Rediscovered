/* AMR Exclusives engagement V1. Requires a reviewed HTTPS backend; no fabricated totals. */
(function () {
  'use strict';
  const root = document.querySelector('[data-amr-engagement]');
  if (!root) return;
  const videoId = root.dataset.videoId;
  const video = document.getElementById(root.dataset.playerId);
  const button = root.querySelector('[data-amr-like]');
  const likes = root.querySelector('[data-amr-likes]');
  const views = root.querySelector('[data-amr-views]');
  const status = root.querySelector('[data-amr-status]');
  const endpoint = window.AMR_ENGAGEMENT_ENDPOINT;
  const configured = typeof endpoint === 'string' && /^https:\/\//.test(endpoint) && videoId && video;
  const base = configured ? endpoint.replace(/\/$/, '') : '';
  const storageKey = 'amr-exclusive-liked:' + videoId;
  let liked = false, sentView = false, watched = 0, lastTime = null, busy = false;
  function displayCount(value, singular) {
    return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() + ' ' + singular + (value === 1 ? '' : 's') : singular + ' unavailable';
  }
  function render(data) {
    if (!data || !Number.isSafeInteger(data.likes) || !Number.isSafeInteger(data.views) || data.likes < 0 || data.views < 0) throw new Error('Invalid engagement response');
    likes.textContent = displayCount(data.likes, 'Like');
    views.textContent = displayCount(data.views, 'View');
    button.disabled = false;
    button.setAttribute('aria-pressed', String(liked));
    button.textContent = liked ? '♥ Liked' : '♡ Like';
    status.textContent = '';
  }
  async function request(path, options) {
    const response = await fetch(base + '/videos/' + encodeURIComponent(videoId) + path, Object.assign({credentials:'omit',mode:'cors',headers:{'Accept':'application/json'}}, options || {}));
    if (!response.ok) throw new Error('Engagement service unavailable');
    return response.json();
  }
  function unavailable() {
    button.disabled = true;
    likes.textContent = 'Likes unavailable';
    views.textContent = 'Views unavailable';
    status.textContent = 'Engagement counters are not connected yet.';
  }
  if (!configured) { unavailable(); return; }
  try { liked = localStorage.getItem(storageKey) === 'yes'; } catch (_) {}
  request('').then(render).catch(unavailable);
  button.addEventListener('click', async () => {
    if (busy || button.disabled) return;
    busy = true; button.disabled = true;
    const next = !liked;
    try {
      const data = await request('/like', {method: next ? 'PUT' : 'DELETE',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({visitorKey:getVisitorKey()})});
      liked = next;
      try { localStorage.setItem(storageKey, liked ? 'yes' : 'no'); } catch (_) {}
      render(data);
    } catch (_) { status.textContent = 'Could not update your Like. Please try again.'; button.disabled = false; }
    finally { busy = false; }
  });
  function getVisitorKey() {
    const key = 'amr-exclusive-visitor-v1';
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = crypto.randomUUID(); localStorage.setItem(key,id); }
      return id;
    } catch (_) { return null; }
  }
  video.addEventListener('playing', () => { lastTime = video.currentTime; });
  video.addEventListener('seeking', () => { lastTime = null; });
  video.addEventListener('pause', () => { lastTime = null; });
  video.addEventListener('timeupdate', async () => {
    if (sentView || video.paused || video.seeking || !Number.isFinite(video.currentTime)) return;
    if (lastTime !== null) {
      const delta = video.currentTime - lastTime;
      if (delta > 0 && delta <= 1.5) watched += delta;
    }
    lastTime = video.currentTime;
    if (watched < 3) return;
    sentView = true;
    try { render(await request('/view', {method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({visitorKey:getVisitorKey(),qualifiedSeconds:3})})); }
    catch (_) { status.textContent = 'View tracking temporarily unavailable.'; }
  });
})();
