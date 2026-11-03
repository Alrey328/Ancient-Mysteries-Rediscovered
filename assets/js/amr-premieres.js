(function () {
  'use strict';

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const assetUrl = (path, prefix) => {
    if (/^(?:https?:)?\/\//.test(path) || path.startsWith('/')) return path;
    return `${prefix || ''}${path}`;
  };

  const findFeaturedFilm = (content) =>
    content.youtubeFilms.find((film) => film.id === content.featuredYoutubeId) || content.youtubeFilms[0];

  // A release is featured only when both approved media assets are configured.
  // Viewpoint frames are optional; a static poster remains the accessible fallback.
  function renderOriginalCard(original, prefix) {
    if (!original || !original.poster || !original.videoUrl || !original.enabled) return '';
    const poster = escapeHtml(assetUrl(original.poster, prefix));
    const video = escapeHtml(assetUrl(original.videoUrl, prefix));
    const title = escapeHtml(original.title || 'AMR Original Film');
    const description = escapeHtml(original.description || '');
    const frames = Array.isArray(original.viewFrames) && original.viewFrames.length >= 3
      ? original.viewFrames.map(path => escapeHtml(assetUrl(path, prefix)))
      : [];
    return `
      <article class="premiere-card premiere-card--original">
        <div class="premiere-card-platform">AMR Originals · Interactive Cinema</div>
        <div class="premiere-card-media amr-living-poster" data-living-poster
             ${frames.length ? `data-frames="${escapeHtml(JSON.stringify(frames))}"` : ''}>
          <img src="${poster}" alt="Official story poster for ${title}" width="941" height="1672" loading="lazy">
          ${frames.length ? '<span class="living-poster-hint" aria-hidden="true">Drag to explore</span>' : ''}
        </div>
        <div class="premiere-card-copy">
          <h3>${title}</h3>
          <p>${description}</p>
          <div class="premiere-actions">
            <a class="premiere-cta" href="${video}" data-original-watch>Watch the Film &#9654;</a>
            <a class="premiere-more" href="exclusives/">Explore AMR Originals &#8594;</a>
          </div>
        </div>
      </article>`;
  }

  function initLivingPosters(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-living-poster][data-frames]').forEach(stage => {
      let frames;
      try { frames = JSON.parse(stage.dataset.frames); } catch { return; }
      if (!Array.isArray(frames) || frames.length < 3) return;
      const img = stage.querySelector('img');
      const original = img.src;
      // Preload all viewpoints; never show a blank frame while images load.
      const loaded = frames.map(src => {
        const image = new Image();
        image.src = src;
        return image;
      });
      let active = false;
      let current = -1;
      function showFrame(index) {
        if (index === current) return;
        const frame = loaded[index];
        if (!frame?.complete || !frame.naturalWidth) return;
        current = index;
        img.src = frame.src;
      }
      stage.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        active = true;
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointermove', event => {
        if (!active) return;
        const rect = stage.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(0.999, (event.clientX - rect.left) / rect.width));
        showFrame(Math.floor(fraction * frames.length));
      });
      const reset = () => { active = false; current = -1; img.src = original; };
      stage.addEventListener('pointerup', reset);
      stage.addEventListener('pointercancel', reset);
      stage.addEventListener('lostpointercapture', reset);
    });
  }

  function renderHomepageStage(root, content) {
    const reel = content.featuredReel;
    const film = findFeaturedFilm(content);
    const prefix = root.dataset.assetPrefix || '';
    const youtubeHref = root.dataset.youtubeHref || 'youtube/';

    if (!reel || !film) throw new Error('Featured AMR content is incomplete.');

    root.innerHTML = `
      <article class="premiere-card premiere-card--reel">
        <div class="premiere-card-platform">Featured Reel</div>
        <a class="premiere-card-media" href="${escapeHtml(reel.videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(reel.title)} on Facebook">
          <img src="${escapeHtml(assetUrl(reel.poster, prefix))}" alt="Official Ancient Mysteries Rediscovered poster for ${escapeHtml(reel.title)}" width="941" height="1672" loading="eager">
          <span class="premiere-play" aria-hidden="true">&#9654;</span>
        </a>
        <div class="premiere-card-copy">
          <h3>${escapeHtml(reel.title)}</h3>
          <p>${escapeHtml(reel.description)}</p>
          <div class="premiere-actions">
            <a class="premiere-cta" href="${escapeHtml(reel.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch Video <span aria-hidden="true">&nbsp;&#8599;</span></a>
          </div>
        </div>
      </article>
      <article class="premiere-card premiere-card--youtube">
        <div class="premiere-card-platform">Featured YouTube Film</div>
        <a class="premiere-card-media" href="${escapeHtml(film.videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(film.title)} on YouTube">
          <img src="${escapeHtml(assetUrl(film.poster, prefix))}" alt="Official Ancient Mysteries Rediscovered YouTube poster for ${escapeHtml(film.title)}" width="1280" height="720" loading="eager">
          <span class="premiere-play" aria-hidden="true">&#9654;</span>
        </a>
        <div class="premiere-card-copy">
          <h3>${escapeHtml(film.title)}</h3>
          <p>${escapeHtml(film.description)}</p>
          <div class="premiere-actions">
            <a class="premiere-cta" href="${escapeHtml(film.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch Video <span aria-hidden="true">&nbsp;&#8599;</span></a>
            <a class="premiere-more" href="${escapeHtml(youtubeHref)}">See More YouTube Videos &#8594;</a>
          </div>
        </div>
      </article>${renderOriginalCard(content.featuredOriginal, prefix)}`;
    if (content.featuredOriginal?.enabled && content.featuredOriginal.poster && content.featuredOriginal.videoUrl) {
      root.classList.add('premiere-stage-grid--three');
      const heading = document.getElementById('premiere-stage-title');
      if (heading) heading.textContent = 'Featured Premieres';
      const kicker = document.querySelector('.premiere-kicker');
      if (kicker) kicker.textContent = 'Three experiences · one AMR stage';
      const intro = document.querySelector('.premiere-stage-intro p');
      if (intro) intro.textContent = 'Explore our newest Facebook Reel, YouTube film, and interactive AMR Original.';
      initLivingPosters(root);
    }
  }

  function renderLibrary(root, content) {
    const featureTarget = root.querySelector('[data-youtube-feature]');
    const gridTarget = root.querySelector('[data-youtube-grid]');
    const film = findFeaturedFilm(content);
    const prefix = root.dataset.assetPrefix || '';

    if (!featureTarget || !gridTarget || !film) throw new Error('The YouTube library container is incomplete.');

    featureTarget.innerHTML = `
      <article class="library-feature-card">
        <a class="library-feature-media" href="${escapeHtml(film.videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(film.title)} on YouTube">
          <img src="${escapeHtml(assetUrl(film.poster, prefix))}" alt="Official Ancient Mysteries Rediscovered YouTube poster for ${escapeHtml(film.title)}" width="1280" height="720" loading="eager">
          <span class="library-play" aria-hidden="true">&#9654;</span>
        </a>
        <div class="library-feature-copy">
          <div class="library-format">Newest immersive film</div>
          <h2>${escapeHtml(film.title)}</h2>
          <p>${escapeHtml(film.description)}</p>
          <a class="library-cta" href="${escapeHtml(film.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch on YouTube <span aria-hidden="true">&nbsp;&#8599;</span></a>
        </div>
      </article>`;

    gridTarget.innerHTML = content.youtubeFilms
      .filter((entry) => entry.id !== film.id)
      .map((entry) => `
        <article class="film-card">
          <a class="film-card-media" href="${escapeHtml(entry.videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(entry.title)} on YouTube">
            <img src="${escapeHtml(assetUrl(entry.poster, prefix))}" alt="Ancient Mysteries Rediscovered YouTube poster for ${escapeHtml(entry.title)}" width="1280" height="720" loading="lazy">
          </a>
          <div class="film-card-copy">
            <div class="film-card-format">${escapeHtml(entry.format)}</div>
            <h3>${escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.description)}</p>
            <a class="film-card-link" href="${escapeHtml(entry.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch Video &#8599;</a>
          </div>
        </article>`)
      .join('');

    const itemList = document.createElement('script');
    itemList.type = 'application/ld+json';
    itemList.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Ancient Mysteries Rediscovered YouTube Film Library',
      itemListElement: content.youtubeFilms.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: entry.videoUrl,
        name: entry.title,
        image: new URL(assetUrl(entry.poster, prefix), window.location.href).href
      }))
    });
    document.head.appendChild(itemList);
  }

  async function hydrate(root, renderer) {
    const contentUrl = root.dataset.contentUrl;
    if (!contentUrl) return;
    root.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(contentUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Content request failed with ${response.status}.`);
      const content = await response.json();
      renderer(root, content);
    } catch (error) {
      console.error(error);
      const target = root.matches('[data-amr-premieres]')
        ? root
        : root.querySelector('[data-youtube-feature]');
      if (target) target.innerHTML = '<p class="premiere-status">The film collection could not be loaded. Please refresh the page.</p>';
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  function initializeNavigation() {
    const toggle = document.querySelector('.library-menu-toggle');
    const navigation = document.getElementById('library-navigation');
    if (!toggle || !navigation) return;
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
      navigation.dataset.open = String(!open);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-amr-premieres]').forEach((root) => hydrate(root, renderHomepageStage));
    document.querySelectorAll('[data-amr-youtube-library]').forEach((root) => hydrate(root, renderLibrary));
    initializeNavigation();
    document.querySelectorAll('[data-current-year]').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });
  });
})();
