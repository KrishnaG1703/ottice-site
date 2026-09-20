// Routing between the four panes, the demo dialog, the theme switch, the anonymous replies, and
// Krishna's own updates. Replies and updates come from the Cloudflare Worker in worker/index.js;
// the GitHub Pages copy of this page reads the same API across origins.
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  // same origin on the worker; the Pages mirror asks the worker directly
  const API = location.hostname.endsWith('github.io') ? 'https://ottervault.mechaclips.workers.dev' : '';
  const LAUNCH = 'launch';

  /* ---------- theme ---------- */
  const root = document.documentElement;
  $$('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('otter-theme', next); } catch {}
  }));

  /* ---------- routing ---------- */
  const TITLES = { home: 'Home', explore: 'How it works', waitlist: 'Early access', about: 'About me' };
  function show(route) {
    const name = TITLES[route] ? route : 'home';
    $$('.page').forEach(page => page.classList.toggle('active', page.dataset.route === name));
    $$('[data-route-link]').forEach(link => {
      const on = link.dataset.routeLink === name;
      link.classList.toggle('active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    $('#page-title').textContent = TITLES[name];
    $('#mobile-title').textContent = TITLES[name];
    document.title = `${TITLES[name]} — Otter Vault`;
  }
  addEventListener('hashchange', () => { show(location.hash.slice(1)); scrollTo({ top: 0, behavior: 'smooth' }); });
  show(location.hash.slice(1));

  /* ---------- demo dialog ---------- */
  const dialog = $('#demo-dialog');
  const video = $('#demo-video');
  const openDemo = () => { dialog.showModal(); video.play().catch(() => {}); };
  document.addEventListener('click', event => { if (event.target.closest('[data-open-demo]')) openDemo(); });
  $('#close-demo').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { video.pause(); video.currentTime = 0; });

  /* ---------- helpers ---------- */
  const relative = iso => {
    const seconds = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // always text, never markup
    return node;
  };
  const api = (path, options = {}) => fetch(API + path, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }
  });

  /* ---------- author mode ---------- */
  // The token lives only in this browser. Open #post (or press "n") and paste it once.
  let token = '';
  try { token = localStorage.getItem('otter-author') || ''; } catch {}
  const composer = $('#author-composer');
  const setAuthor = on => {
    document.body.classList.toggle('is-author', on);
    composer.hidden = !on;
  };
  async function checkAuthor() {
    if (!token) { setAuthor(false); return; }
    try {
      const response = await api('/api/author');
      const data = await response.json();
      setAuthor(Boolean(data.author));
      if (!data.author) { token = ''; localStorage.removeItem('otter-author'); }
    } catch { setAuthor(false); }
  }
  async function askForToken() {
    const entered = prompt('Author token (stays in this browser only):', '');
    if (entered === null) return;
    token = entered.trim();
    try { localStorage.setItem('otter-author', token); } catch {}
    await checkAuthor();
    if (!document.body.classList.contains('is-author')) alert('That token did not match.');
  }
  addEventListener('hashchange', () => { if (location.hash === '#post') { history.replaceState(null, '', '#home'); askForToken(); } });
  if (location.hash === '#post') { history.replaceState(null, '', '#home'); askForToken(); }
  addEventListener('keydown', event => {
    if (event.key === 'n' && (event.metaKey || event.ctrlKey) && event.shiftKey) { event.preventDefault(); askForToken(); }
  });
  $('#author-signout').addEventListener('click', () => {
    token = '';
    try { localStorage.removeItem('otter-author'); } catch {}
    setAuthor(false);
  });

  /* ---------- feed ---------- */
  const updates = $('#updates');
  const launchReplies = $('#reply-list');
  const status = $('#reply-status');
  let live = true;
  let comments = [];

  function replyBlock(postId, list) {
    const wrap = el('div', 'reply-thread');
    for (const reply of list) {
      const item = el('article', 'reply');
      const avatar = el('span', 'anon-avatar', '?');
      avatar.setAttribute('aria-hidden', 'true');
      const column = el('div');
      const meta = el('div', 'reply-meta');
      meta.append(el('strong', null, 'Anonymous Otter'), el('span', null, `@anonymous · ${relative(reply.createdAt)}`));
      column.append(meta, el('p', null, reply.body));
      if (document.body.classList.contains('is-author')) {
        const remove = el('button', 'reply-remove', 'Remove');
        remove.addEventListener('click', async () => {
          if (!confirm('Remove this reply?')) return;
          await api(`/api/comments/${reply.id}`, { method: 'DELETE' });
          load();
        });
        meta.append(remove);
      }
      item.append(avatar, column);
      wrap.append(item);
    }
    if (!list.length) wrap.append(el('p', 'reply-empty', 'No replies yet. Be the first otter.'));
    return wrap;
  }

  function updatePost(post) {
    const article = el('article', 'post');
    const avatar = el('img');
    avatar.src = 'assets/social/krishna-profile.jpg';
    avatar.alt = '';
    avatar.width = 48; avatar.height = 48;
    const body = el('div', 'post-body');
    const meta = el('div', 'post-meta');
    const verified = el('span', 'verified', '✓');
    verified.setAttribute('aria-label', 'Verified');
    meta.append(el('strong', null, 'Krishna'), verified, el('span', null, `@krishna · ${relative(post.createdAt)}`));
    const copy = el('p', 'post-copy update-copy', post.body);
    body.append(meta, copy);

    const mine = comments.filter(comment => comment.postId === post.id);
    const actions = el('div', 'actions');
    const replyButton = el('button');
    replyButton.type = 'button';
    replyButton.append(el('span', null, `${mine.length} ${mine.length === 1 ? 'reply' : 'replies'}`));
    const thread = replyBlock(post.id, mine);
    thread.hidden = true;
    const form = replyForm(post.id, () => load());
    form.hidden = true;
    replyButton.addEventListener('click', () => { thread.hidden = !thread.hidden; form.hidden = thread.hidden; });
    actions.append(replyButton);
    body.append(actions, form, thread);
    article.append(avatar, body);
    return article;
  }

  function replyForm(postId, done) {
    const form = el('form', 'reply-form');
    const avatar = el('span', 'anon-avatar', '?');
    avatar.setAttribute('aria-hidden', 'true');
    const compose = el('div', 'reply-compose');
    const box = el('textarea');
    box.rows = 1;
    box.maxLength = 280;
    box.placeholder = 'Reply anonymously…';
    box.setAttribute('aria-label', 'Write an anonymous reply');
    const button = el('button', null, 'Reply');
    button.type = 'submit';
    compose.append(box, button);
    form.append(avatar, compose);
    box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 140)}px`; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = box.value.trim();
      if (!text) return;
      button.disabled = true;
      try {
        const response = await fetch(`${API}/api/comments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ postId, body: text })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'no');
        box.value = '';
        box.style.height = 'auto';
        done();
      } catch (error) {
        status.textContent = String(error.message || 'That did not go through.');
      } finally {
        button.disabled = false;
      }
    });
    return form;
  }

  async function load() {
    try {
      const response = await fetch(`${API}/api/feed`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      comments = data.comments || [];
      live = true;
      updates.textContent = '';
      for (const post of (data.posts || [])) updates.append(updatePost(post));
      const launch = comments.filter(comment => comment.postId === LAUNCH);
      launchReplies.textContent = '';
      launchReplies.append(replyBlock(LAUNCH, launch));
      $('#reply-count').textContent = launch.length;
      $('#reply-form-slot').textContent = '';
      $('#reply-form-slot').append(replyForm(LAUNCH, load));
    } catch {
      live = false;
      $('#reply-form-slot').textContent = '';
      launchReplies.textContent = '';
      launchReplies.append(el('p', 'reply-empty', 'Replies are resting. They come back when the site is online.'));
    }
  }

  /* ---------- posting an update ---------- */
  $('#author-form').addEventListener('submit', async event => {
    event.preventDefault();
    const box = $('#author-body');
    const text = box.value.trim();
    if (!text) return;
    const button = $('#author-post');
    button.disabled = true;
    try {
      const response = await api('/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text })
      });
      if (!response.ok) throw new Error('post failed');
      box.value = '';
      box.style.height = 'auto';
      await load();
    } catch {
      alert('That did not post. Check the token and try again.');
    } finally {
      button.disabled = false;
    }
  });
  $('#author-body').addEventListener('input', event => {
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
  });

  /* ---------- share ---------- */
  $('[data-share]')?.addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    if (navigator.share) { try { await navigator.share({ title: 'Otter Vault', url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied.'; } catch {}
  });

  checkAuthor().then(load);
})();
