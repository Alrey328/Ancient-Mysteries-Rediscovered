/* AMR Originals engagement. Anonymous, best-effort counters only. */
(function () {
  'use strict';

  const REQUEST_TIMEOUT_MS = 6500;
  const QUALIFIED_PLAYBACK_MS = 3000;
  const MAX_VIEW_ATTEMPTS = 3;
  const metaEndpoint = document.querySelector('meta[name="amr-engagement-api"]')?.content;

  function displayCount(value, singular) {
    return Number.isSafeInteger(value) && value >= 0
      ? `${value.toLocaleString()} ${singular}${value === 1 ? '' : 's'}`
      : `${singular}s unavailable`;
  }

  function uuidV4() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  let memoryVisitorKey;
  function getVisitorKey() {
    const key = 'amr-exclusive-visitor-v1';
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = uuidV4();
        localStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      memoryVisitorKey ||= uuidV4();
      return memoryVisitorKey;
    }
  }

  function initialize(root) {
    const videoId = root.dataset.videoId;
    const video = document.getElementById(root.dataset.playerId);
    const button = root.querySelector('[data-amr-like]');
    const likes = root.querySelector('[data-amr-likes]');
    const views = root.querySelector('[data-amr-views]');
    const status = root.querySelector('[data-amr-status]');
    const endpoint = root.dataset.endpoint || metaEndpoint;
    const membership = window.AMRMembership;
    let endpointAllowed = false;
    try {
      const endpointUrl = new URL(endpoint);
      endpointAllowed = endpointUrl.protocol === 'https:'
        || (endpointUrl.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpointUrl.hostname));
    } catch (_) {}
    const configured = typeof endpoint === 'string'
      && endpointAllowed
      && videoId
      && video
      && button
      && likes
      && views
      && status;

    if (!configured) {
      if (button) button.disabled = true;
      if (likes) likes.textContent = 'Likes unavailable';
      if (views) views.textContent = 'Views unavailable';
      if (status) status.textContent = 'Engagement counters are temporarily unavailable.';
      return;
    }

    const base = endpoint.replace(/\/$/, '');
    const storageKey = `amr-exclusive-liked:${videoId}`;
    let liked = false;
    let busy = false;
    let totalsLoaded = false;
    let qualifiedPlaybackMs = 0;
    let playbackTimer;
    let lastWallTime;
    let lastMediaTime;
    let viewRecorded = false;
    let viewInFlight = false;
    let viewAttempts = 0;

    if (!membership) {
      try { liked = localStorage.getItem(storageKey) === 'yes'; } catch (_) {}
    }

    function syncButtonState() {
      button.disabled = !totalsLoaded || busy;
      button.setAttribute('aria-pressed', String(liked));
      button.textContent = liked ? '♥ Liked' : '♡ Like';
    }

    function render(data) {
      if (!data
        || !Number.isSafeInteger(data.likes)
        || !Number.isSafeInteger(data.views)
        || data.likes < 0
        || data.views < 0) {
        throw new Error('Invalid engagement response');
      }
      likes.textContent = displayCount(data.likes, 'Like');
      views.textContent = displayCount(data.views, 'View');
      status.textContent = '';
      totalsLoaded = true;
      syncButtonState();
    }

    async function request(path, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${base}/videos/${encodeURIComponent(videoId)}${path}`, {
          credentials: membership ? 'include' : 'omit',
          mode: 'cors',
          ...options,
          headers: {
            Accept: 'application/json',
            ...(membership ? membership.requestHeaders() : {}),
            ...options.headers
          },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Engagement request failed (${response.status})`);
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    }

    function showUnavailable() {
      if (!totalsLoaded) {
        button.disabled = true;
        likes.textContent = 'Likes unavailable';
        views.textContent = 'Views unavailable';
      }
      status.textContent = 'Engagement counters are temporarily unavailable. Playback is unaffected.';
    }

    syncButtonState();
    request('').then(render).catch(showUnavailable);
    if (membership) {
      membership.ready.then(async () => {
        if (membership.member) {
          const state = await request('/member-like');
          liked = state.liked === true;
          syncButtonState();
        }
      }).catch(() => {});
    }

    button.addEventListener('click', async () => {
      if (busy || button.disabled) return;
      if (membership && !membership.member) {
        await membership.requireMember();
        return;
      }
      busy = true;
      syncButtonState();
      const next = !liked;
      try {
        const data = await request('/like', {
          method: next ? 'PUT' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorKey: membership ? membership.visitorKey() : getVisitorKey() })
        });
        liked = next;
        if (!membership) {
          try { localStorage.setItem(storageKey, liked ? 'yes' : 'no'); } catch (_) {}
        }
        render(data);
      } catch (_) {
        status.textContent = 'Could not update your Like. Please try again.';
      } finally {
        busy = false;
        syncButtonState();
      }
    });

    function resetPlaybackSample() {
      lastWallTime = undefined;
      lastMediaTime = undefined;
    }

    function stopPlaybackClock() {
      if (playbackTimer) clearInterval(playbackTimer);
      playbackTimer = undefined;
      resetPlaybackSample();
    }

    async function submitQualifiedView() {
      if (viewRecorded || viewInFlight || viewAttempts >= MAX_VIEW_ATTEMPTS) return;
      viewInFlight = true;
      viewAttempts += 1;
      stopPlaybackClock();
      try {
        render(await request('/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorKey: membership ? membership.visitorKey() : getVisitorKey(),
            qualifiedSeconds: 3
          })
        }));
        viewRecorded = true;
      } catch (_) {
        status.textContent = viewAttempts < MAX_VIEW_ATTEMPTS
          ? 'Saving this qualified view…'
          : 'View tracking is temporarily unavailable.';
        if (viewAttempts < MAX_VIEW_ATTEMPTS) {
          setTimeout(() => {
            if (!video.paused && !video.ended) startPlaybackClock();
          }, 1500 * viewAttempts);
        }
      } finally {
        viewInFlight = false;
      }
    }

    function samplePlayback() {
      if (viewRecorded || viewInFlight) return;
      if (video.paused || video.ended || video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        resetPlaybackSample();
        return;
      }

      const now = performance.now();
      const mediaTime = video.currentTime;
      if (lastWallTime !== undefined && lastMediaTime !== undefined) {
        const wallDeltaMs = now - lastWallTime;
        const mediaDeltaSeconds = mediaTime - lastMediaTime;
        const expectedMediaDelta = (wallDeltaMs / 1000) * Math.max(video.playbackRate, 0.25);
        const naturalProgress = mediaDeltaSeconds > 0
          && mediaDeltaSeconds <= Math.max(0.75, expectedMediaDelta * 2.5 + 0.25);
        if (naturalProgress) qualifiedPlaybackMs += Math.min(wallDeltaMs, 1000);
      }
      lastWallTime = now;
      lastMediaTime = mediaTime;

      if (qualifiedPlaybackMs >= QUALIFIED_PLAYBACK_MS) submitQualifiedView();
    }

    function startPlaybackClock() {
      if (viewRecorded || viewInFlight || playbackTimer || viewAttempts >= MAX_VIEW_ATTEMPTS) return;
      resetPlaybackSample();
      playbackTimer = setInterval(samplePlayback, 250);
    }

    video.addEventListener('playing', startPlaybackClock);
    video.addEventListener('pause', stopPlaybackClock);
    video.addEventListener('waiting', stopPlaybackClock);
    video.addEventListener('seeking', resetPlaybackSample);
    video.addEventListener('ended', stopPlaybackClock);
    window.addEventListener('pageshow', syncButtonState);
    if (membership) {
      document.addEventListener('amr:member-changed', async () => {
        liked = false;
        if (membership.member) {
          try { liked = (await request('/member-like')).liked === true; } catch (_) {}
        }
        syncButtonState();
      });
    }
    window.addEventListener('pagehide', stopPlaybackClock, { once: true });
  }

  document.querySelectorAll('[data-amr-engagement]').forEach(initialize);
})();
