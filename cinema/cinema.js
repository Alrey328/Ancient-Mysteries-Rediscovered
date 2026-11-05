(function () {
  'use strict';

  const menu = document.querySelector('.cinema-menu');
  const navigation = document.querySelector('.cinema-nav-links');
  if (menu && navigation) {
    menu.addEventListener('click', () => {
      const open = navigation.dataset.open !== 'true';
      navigation.dataset.open = String(open);
      menu.setAttribute('aria-expanded', String(open));
    });
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) {
        navigation.dataset.open = 'false';
        menu.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('[data-cinema-player]').forEach(shell => {
    const video = shell.querySelector('video');
    const button = shell.querySelector('[data-cinema-play]');
    if (!video || !button) return;

    button.addEventListener('click', () => {
      const playback = video.play();
      if (playback?.catch) playback.catch(() => { button.hidden = false; });
    });
    video.addEventListener('play', () => { button.hidden = true; });
    video.addEventListener('ended', () => { button.hidden = false; });
    video.addEventListener('error', () => { button.hidden = false; });
  });

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Copy unavailable');
  }

  document.querySelectorAll('[data-share-film]').forEach(button => {
    const status = document.getElementById(button.getAttribute('aria-describedby'));
    button.addEventListener('click', async () => {
      const url = new URL(button.dataset.shareUrl || location.pathname, location.origin).href;
      const title = button.dataset.shareTitle || document.title;
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
          if (status) status.textContent = 'Share menu opened.';
        } else {
          await copyText(url);
          if (status) status.textContent = 'Film link copied.';
        }
      } catch (error) {
        if (error?.name !== 'AbortError' && status) {
          status.textContent = 'Copy unavailable. Use the address in your browser.';
        }
      }
    });
  });

  document.querySelectorAll('[data-cinema-comments]').forEach(target => {
    const term = target.dataset.cinemaComments;
    const loadButton = target.querySelector('[data-load-comments]');
    if (!loadButton) return;
    loadButton.addEventListener('click', () => {
      if (typeof renderGiscus === 'function') {
        target.replaceChildren();
        renderGiscus(target, term, 'specific');
      } else {
        target.innerHTML = '<p>Comments are temporarily unavailable. <a href="../../discussions/">Visit AMR Discussions</a>.</p>';
      }
    }, { once: true });
  });
})();
