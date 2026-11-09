(function () {
  'use strict';

  const endpoint = document.querySelector('meta[name="amr-membership-api"]')?.content
    || document.querySelector('meta[name="amr-engagement-api"]')?.content;
  const googleClientId = document.querySelector('meta[name="amr-google-client-id"]')?.content || '';
  const turnstileSiteKey = document.querySelector('meta[name="amr-turnstile-site-key"]')?.content || '';
  const previewTokenKey = 'amr-preview-session-v1';
  const visitorKeyName = 'amr-exclusive-visitor-v1';
  let member = null;
  let dialog;
  let googleInitialized = false;
  let activeNonce = '';

  function uuidV4() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function visitorKey() {
    try {
      let value = localStorage.getItem(visitorKeyName);
      if (!value) {
        value = uuidV4();
        localStorage.setItem(visitorKeyName, value);
      }
      return value;
    } catch {
      return uuidV4();
    }
  }

  function previewToken() {
    try { return sessionStorage.getItem(previewTokenKey) || ''; } catch { return ''; }
  }

  function requestHeaders(extra = {}) {
    const token = previewToken();
    return {
      Accept: 'application/json',
      'X-AMR-Request': '1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra
    };
  }

  async function api(path, options = {}) {
    if (!endpoint) throw new Error('AMR membership is not configured.');
    const response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
      credentials: 'include',
      mode: 'cors',
      ...options,
      headers: requestHeaders(options.headers)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AMR request failed (${response.status})`);
    return data;
  }

  function randomNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function configurationReady() {
    return endpoint && googleClientId && !googleClientId.startsWith('CONFIGURE_');
  }

  function announceChange() {
    renderMembershipSlots();
    renderAccountArea();
    document.dispatchEvent(new CustomEvent('amr:member-changed', { detail: { member } }));
  }

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'amr-member-dialog';
    dialog.setAttribute('aria-labelledby', 'amr-member-dialog-title');
    dialog.innerHTML = `
      <form method="dialog" class="amr-member-dialog-close"><button aria-label="Close sign-in">×</button></form>
      <p class="amr-member-kicker">Free AMR membership</p>
      <h2 id="amr-member-dialog-title">Join the investigation.</h2>
      <p>Watch every film without an account. Join only when you want to like, comment, or receive release updates.</p>
      <div data-google-signin></div>
      <p class="amr-member-status" data-signin-status role="status"></p>
      <p class="amr-member-privacy">AMR stores your email, display name, optional Google profile image, preferences, and activity needed for membership. Notifications are off by default. <a href="/privacy/membership/">Read the membership privacy notice</a>.</p>
    `;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  function loadGoogleLibrary() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-amr-google]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.amrGoogle = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function handleGoogleCredential(response) {
    const status = dialog?.querySelector('[data-signin-status]');
    if (status) status.textContent = 'Securing your AMR membership…';
    try {
      const data = await api('/membership/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, nonce: activeNonce, visitorKey: visitorKey() })
      });
      member = data.member;
      if (data.previewSessionToken) {
        try { sessionStorage.setItem(previewTokenKey, data.previewSessionToken); } catch {}
      }
      if (status) status.textContent = 'Welcome to AMR.';
      announceChange();
      setTimeout(() => dialog?.close(), 350);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  async function prepareGoogleButton() {
    const surface = createDialog();
    const status = surface.querySelector('[data-signin-status]');
    if (!configurationReady()) {
      status.textContent = 'Google sign-in is awaiting the preview OAuth client configuration.';
      return;
    }
    try {
      await loadGoogleLibrary();
      activeNonce = randomNonce();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        nonce: activeNonce,
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: false
      });
      const target = surface.querySelector('[data-google-signin]');
      target.replaceChildren();
      window.google.accounts.id.renderButton(target, {
        type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', width: 280
      });
      googleInitialized = true;
      status.textContent = '';
    } catch {
      status.textContent = 'Google sign-in could not load. Please check your connection and try again.';
    }
  }

  async function openSignIn() {
    const surface = createDialog();
    surface.showModal();
    if (!googleInitialized) await prepareGoogleButton();
  }

  async function requireMember() {
    await ready;
    if (member) return true;
    await openSignIn();
    return false;
  }

  function renderMembershipSlots() {
    document.querySelectorAll('[data-amr-membership]').forEach(slot => {
      slot.replaceChildren();
      if (member) {
        const link = document.createElement('a');
        link.className = 'amr-member-primary';
        link.href = '/my-amr/';
        link.textContent = 'My AMR';
        const note = document.createElement('p');
        note.textContent = `Signed in as ${member.displayName}`;
        slot.append(link, note);
      } else {
        const join = document.createElement('button');
        join.type = 'button';
        join.className = 'amr-member-primary';
        join.textContent = 'Join AMR — Free';
        join.addEventListener('click', openSignIn);
        const signIn = document.createElement('button');
        signIn.type = 'button';
        signIn.className = 'amr-member-secondary';
        signIn.textContent = 'Sign In';
        signIn.addEventListener('click', openSignIn);
        const note = document.createElement('p');
        note.textContent = 'Watching is always free. No payment or credit card.';
        slot.append(join, signIn, note);
      }
    });
  }

  function commentNode(comment, root) {
    const article = document.createElement('article');
    article.className = 'amr-comment';
    article.dataset.commentId = comment.id;
    const header = document.createElement('header');
    if (comment.avatarUrl) {
      const image = document.createElement('img');
      image.src = comment.avatarUrl;
      image.alt = '';
      image.width = 36;
      image.height = 36;
      image.referrerPolicy = 'no-referrer';
      header.append(image);
    }
    const author = document.createElement('strong');
    author.textContent = comment.displayName;
    const time = document.createElement('time');
    time.dateTime = new Date(comment.createdAt * 1000).toISOString();
    time.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(comment.createdAt * 1000));
    header.append(author, time);
    const body = document.createElement('p');
    body.textContent = comment.body;
    const actions = document.createElement('div');
    if (comment.own) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        if (!confirm('Delete your comment?')) return;
        await api(`/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' });
        article.remove();
      });
      actions.append(remove);
    } else if (member) {
      const report = document.createElement('button');
      report.type = 'button';
      report.textContent = 'Report';
      report.addEventListener('click', async () => {
        await api(`/comments/${encodeURIComponent(comment.id)}/report`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'other' })
        });
        report.textContent = 'Reported';
        report.disabled = true;
      });
      actions.append(report);
    }
    article.append(header, body, actions);
    return article;
  }

  async function refreshComments(root) {
    const videoId = root.dataset.videoId;
    const list = root.querySelector('[data-comment-list]');
    try {
      const data = await api(`/videos/${encodeURIComponent(videoId)}/comments`);
      list.replaceChildren();
      if (!data.comments.length) {
        const empty = document.createElement('p');
        empty.className = 'amr-comments-empty';
        empty.textContent = 'No member comments yet. Begin the investigation.';
        list.append(empty);
      } else {
        for (const comment of data.comments) list.append(commentNode(comment, root));
      }
    } catch (error) {
      list.textContent = error.message;
    }
  }

  function initializeComments() {
    document.querySelectorAll('[data-amr-native-comments]').forEach(root => {
      if (root.dataset.ready) return;
      root.dataset.ready = 'true';
      root.innerHTML = `
        <div data-comment-invitation></div>
        <form data-comment-form hidden>
          <label for="comment-${root.dataset.videoId}">Add your comment</label>
          <textarea id="comment-${root.dataset.videoId}" name="body" maxlength="2000" required></textarea>
          <input class="amr-comment-honeypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          ${turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-theme="dark"></div>` : ''}
          <button type="submit">Post comment</button><span data-comment-status role="status"></span>
        </form>
        <div class="amr-comment-list" data-comment-list><p>Loading member comments…</p></div>
      `;
      const invitation = root.querySelector('[data-comment-invitation]');
      const form = root.querySelector('[data-comment-form]');
      const updateComposer = () => {
        invitation.replaceChildren();
        form.hidden = !member;
        if (!member) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Join AMR to comment';
          button.addEventListener('click', openSignIn);
          invitation.append(button);
        }
      };
      updateComposer();
      document.addEventListener('amr:member-changed', () => { updateComposer(); refreshComments(root); });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const status = root.querySelector('[data-comment-status]');
        const formData = new FormData(form);
        status.textContent = 'Posting…';
        try {
          const token = formData.get('cf-turnstile-response') || '';
          await api(`/videos/${encodeURIComponent(root.dataset.videoId)}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: formData.get('body'), website: formData.get('website'), turnstileToken: token })
          });
          form.reset();
          if (window.turnstile && turnstileSiteKey) window.turnstile.reset();
          status.textContent = 'Comment posted.';
          await refreshComments(root);
        } catch (error) { status.textContent = error.message; }
      });
      refreshComments(root);
    });
    if (turnstileSiteKey && !document.querySelector('script[data-amr-turnstile]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.dataset.amrTurnstile = 'true';
      document.head.appendChild(script);
    }
  }

  function renderAccountArea() {
    const root = document.querySelector('[data-my-amr]');
    if (!root) return;
    root.replaceChildren();
    if (!member) {
      const title = document.createElement('h1');
      title.textContent = 'My AMR';
      const note = document.createElement('p');
      note.textContent = 'Sign in to manage your free membership and release notifications.';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'amr-member-primary';
      button.textContent = 'Sign In with Google';
      button.addEventListener('click', openSignIn);
      root.append(title, note, button);
      return;
    }
    root.innerHTML = `
      <p class="amr-member-kicker">Member account</p><h1>My AMR</h1>
      <div class="amr-account-identity"><img data-account-avatar alt="" width="72" height="72"><div><strong data-account-name></strong><span data-account-email></span></div></div>
      <form data-profile-form><label>Display name<input name="displayName" maxlength="50" required></label><button>Save name</button><span role="status"></span></form>
      <form data-preferences-form><fieldset><legend>Release notifications</legend><p>All email choices are optional and start off.</p>
        <label><input type="checkbox" name="cinemaReleases"> New AMR Cinema films</label>
        <label><input type="checkbox" name="investigations"> New Ancient Mysteries investigations</label>
        <label><input type="checkbox" name="seriesChapters"> New chapters in ongoing series</label>
      </fieldset><button>Save notification choices</button><span role="status"></span></form>
      <div class="amr-account-actions"><button type="button" data-signout>Sign out</button></div>
      <section class="amr-danger"><h2>Delete account</h2><p>This permanently removes your profile, sessions, member likes, comments, reports, and notification preferences. Anonymous qualified-view totals remain aggregated.</p>
        <form data-delete-form><label>Enter your email to confirm<input type="email" name="confirmEmail" required autocomplete="email"></label><button>Delete my AMR account</button><span role="status"></span></form>
      </section>`;
    root.querySelector('[data-account-name]').textContent = member.displayName;
    root.querySelector('[data-account-email]').textContent = member.email;
    const avatar = root.querySelector('[data-account-avatar]');
    if (member.avatarUrl) avatar.src = member.avatarUrl; else avatar.hidden = true;
    const profile = root.querySelector('[data-profile-form]');
    profile.elements.displayName.value = member.displayName;
    profile.addEventListener('submit', async event => {
      event.preventDefault();
      const status = profile.querySelector('[role="status"]');
      try {
        const data = await api('/membership/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: profile.elements.displayName.value }) });
        member = data.member; status.textContent = 'Display name saved.'; announceChange();
      } catch (error) { status.textContent = error.message; }
    });
    const preferences = root.querySelector('[data-preferences-form]');
    for (const key of ['cinemaReleases', 'investigations', 'seriesChapters']) preferences.elements[key].checked = member.preferences[key];
    preferences.addEventListener('submit', async event => {
      event.preventDefault();
      const status = preferences.querySelector('[role="status"]');
      try {
        const data = await api('/membership/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(['cinemaReleases', 'investigations', 'seriesChapters'].map(key => [key, preferences.elements[key].checked]))) });
        member.preferences = data.preferences; status.textContent = 'Notification choices saved.';
      } catch (error) { status.textContent = error.message; }
    });
    root.querySelector('[data-signout]').addEventListener('click', async () => {
      await api('/membership/signout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      try { sessionStorage.removeItem(previewTokenKey); } catch {}
      member = null; announceChange();
    });
    const deletion = root.querySelector('[data-delete-form]');
    deletion.addEventListener('submit', async event => {
      event.preventDefault();
      if (!confirm('Permanently delete your AMR account and member content?')) return;
      const status = deletion.querySelector('[role="status"]');
      try {
        await api('/membership/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmEmail: deletion.elements.confirmEmail.value }) });
        try { sessionStorage.removeItem(previewTokenKey); } catch {}
        member = null; announceChange();
      } catch (error) { status.textContent = error.message; }
    });
  }

  const ready = (async () => {
    try { member = (await api('/membership/session')).member; } catch { member = null; }
    renderMembershipSlots();
    initializeComments();
    renderAccountArea();
    return member;
  })();

  window.AMRMembership = {
    ready,
    get member() { return member; },
    openSignIn,
    requireMember,
    requestHeaders,
    visitorKey,
    api
  };
})();
