(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the otter from rice: short clips with alpha, still poses otherwise ---------- */
  const CLIPS = new Set(['idle', 'scan', 'wave', 'celebrate']);
  // safari needs hevc-with-alpha; everyone else gets vp9-with-alpha webm
  const isSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  function setOtter(el, pose) {
    if (!el || el.dataset.pose === pose) return;
    el.dataset.pose = pose;
    const still = () => Object.assign(document.createElement('img'), { src: `assets/otter/${pose}.webp`, alt: '', decoding: 'async' });
    if (!CLIPS.has(pose) || reduceMotion) { el.replaceChildren(still()); return; }
    const video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, autoplay: true, playsInline: true, poster: `assets/otter/${pose}.webp` });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.src = `assets/otter/${pose}.${isSafari ? 'mov' : 'webm'}`;
    video.addEventListener('error', () => { if (el.dataset.pose === pose) el.replaceChildren(still()); }, { once: true });
    el.replaceChildren(video);
    video.play().catch(() => {});
  }

  /* ---------- nav: solid once scrolled, highlight the section in view ---------- */
  const nav = document.getElementById('nav');
  const setScrolled = () => nav.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', setScrolled, { passive: true });
  setScrolled();

  const navLinks = [...nav.querySelectorAll('nav a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navLinks.forEach(link => link.toggleAttribute('aria-current', link.getAttribute('href') === `#${entry.target.id}`));
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(section => spy.observe(section));
  }

  /* ---------- hero: the prompt actually responds ---------- */
  const heroPrompt = document.getElementById('hero-prompt');
  const heroTitle = document.getElementById('hero-prompt-title');
  const heroBody = document.getElementById('hero-prompt-body');
  const heroActions = document.getElementById('hero-prompt-actions');

  function setHero(title, body, buttons) {
    heroTitle.textContent = title;
    heroBody.textContent = body;
    heroActions.replaceChildren(...buttons.map(({ label, kind, action }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-xs ${kind === 'quiet' ? 'btn-quiet' : 'btn-mint'}`;
      button.textContent = label;
      button.dataset.hero = action;
      return button;
    }));
    heroPrompt.classList.remove('is-updating');
    void heroPrompt.offsetWidth;
    heroPrompt.classList.add('is-updating');
  }

  heroActions.addEventListener('click', event => {
    const action = event.target.closest('[data-hero]')?.dataset.hero;
    if (action === 'save') {
      setHero('safe and sound.', 'saved only for acme.dev, encrypted on this device.', [{ label: 'done', action: 'reset' }]);
    } else if (action === 'skip') {
      setHero('no problem.', 'nothing was saved. i’ll ask again next time.', [{ label: 'ask me again', action: 'reset' }]);
    } else if (action === 'reset') {
      setHero('i spotted a password.', 'want me to keep it safe?', [
        { label: 'keep it safe', action: 'save' },
        { label: 'not now', kind: 'quiet', action: 'skip' }
      ]);
    }
    heroActions.querySelector('button')?.focus({ preventScroll: true });
  });

  /* ---------- how it works: the live demo ---------- */
  const $ = id => document.getElementById(id);
  const demo = $('demo');
  const steps = [...document.querySelectorAll('.step')];
  const ui = {
    url: $('demo-url'), urlText: $('demo-url-text'), urlIcon: $('demo-url-icon'),
    console: $('view-console'), deploy: $('view-deploy'),
    create: $('demo-create'), keyCard: $('demo-key-card'), key: $('demo-key'),
    fieldValue: $('demo-field-value'),
    bubble: $('demo-bubble'), title: $('demo-bubble-title'), body: $('demo-bubble-body'), actions: $('demo-bubble-actions'),
    otter: $('demo-otter'), caption: $('demo-caption'), count: $('demo-count'),
    play: $('demo-play'), restart: $('demo-restart')
  };
  const REAL = 'console.example.dev';
  let key = '';
  let saved = 0;
  let timers = [];
  let playing = false;
  let playTimers = [];
  let otterReady = false;

  const later = (ms, fn) => timers.push(setTimeout(fn, reduceMotion ? Math.min(ms, 250) : ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function newKey() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return 'sk-live-' + [...crypto.getRandomValues(new Uint8Array(24))].map(b => alphabet[b % alphabet.length]).join('');
  }

  function setUrl(host, path, lookalike) {
    ui.urlIcon.setAttribute('href', lookalike ? '#i-warn-url' : '#i-lock');
    ui.urlText.replaceChildren();
    if (lookalike) {
      const i = host.indexOf('1');
      ui.urlText.append(host.slice(0, i), Object.assign(document.createElement('mark'), { textContent: '1' }), host.slice(i + 1) + path);
    } else {
      ui.urlText.textContent = host + path;
    }
  }

  function codeWithMark({ code, mark }) {
    const el = document.createElement('code');
    const i = mark ? code.indexOf(mark) : -1;
    if (i < 0) { el.textContent = code; return el; }
    el.append(code.slice(0, i), Object.assign(document.createElement('mark'), { textContent: mark }), code.slice(i + mark.length));
    return el;
  }

  // body parts are plain strings or { code, mark } so hostnames keep their case

  function say(title, parts, actions = []) {
    ui.title.textContent = title;
    ui.body.replaceChildren(...parts.map(part => typeof part === 'string'
      ? document.createTextNode(part)
      : codeWithMark(part)));
    ui.actions.replaceChildren(...actions.map(({ label, kind, run }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn-xs ${kind === 'quiet' ? 'btn-quiet' : 'btn-mint'}`;
      button.textContent = label;
      button.addEventListener('click', () => { stopPlaying(); run(); });
      return button;
    }));
    ui.bubble.hidden = false;
    ui.bubble.style.animation = 'none';
    void ui.bubble.offsetWidth;
    ui.bubble.style.animation = '';
  }

  function progress(active, done = []) {
    steps.forEach(step => {
      const n = Number(step.dataset.step);
      step.classList.toggle('is-active', n === active);
      step.classList.toggle('is-done', done.includes(n));
      step.setAttribute('aria-current', n === active ? 'step' : 'false');
    });
  }

  function setCount(n) {
    saved = n;
    ui.count.querySelector('span').textContent = `notebook · ${n} secret${n === 1 ? '' : 's'}`;
    ui.count.classList.remove('bump');
    void ui.count.offsetWidth;
    if (n) ui.count.classList.add('bump');
  }

  const states = {
    start() {
      clearTimers();
      key = '';
      setCount(0);
      demo.dataset.state = 'start';
      setUrl(REAL, '/settings/keys', false);
      ui.console.hidden = false;
      ui.deploy.hidden = true;
      ui.keyCard.hidden = true;
      ui.create.disabled = false;
      ui.bubble.hidden = true;
      if (otterReady) setOtter(ui.otter, 'idle');
      ui.caption.textContent = "you're on the real console. make a key to begin.";
      progress(1);
    },
    reveal() {
      clearTimers();
      demo.dataset.state = 'revealing';
      key = key || newKey();
      ui.console.hidden = false;
      ui.deploy.hidden = true;
      ui.create.disabled = true;
      ui.keyCard.hidden = false;
      ui.bubble.hidden = true;
      setOtter(ui.otter, 'scan');
      ui.caption.textContent = 'a brand-new key appears as plain page text. otter notices, and saves nothing yet.';
      progress(1);
      // type the key out, the way it lands on a real page
      let shown = 0;
      const tick = () => {
        shown = Math.min(key.length, shown + 3);
        ui.key.textContent = key.slice(0, shown);
        if (shown < key.length) later(28, tick);
      };
      tick();
      later(1100, states.ask);
    },
    ask() {
      demo.dataset.state = 'asking';
      setOtter(ui.otter, 'scan');
      say('something secret just surfaced.', ['keep this api key safe?'], [
        { label: 'keep it safe', run: states.save },
        { label: 'not now', kind: 'quiet', run: states.decline }
      ]);
      ui.caption.textContent = 'nothing is stored until you say so.';
      progress(2, [1]);
    },
    decline() {
      clearTimers();
      demo.dataset.state = 'declined';
      setOtter(ui.otter, 'lean');
      say('no problem.', ["nothing was saved. i'll ask again next time."], [{ label: 'ask me again', run: states.ask }]);
      ui.caption.textContent = 'you said no, so the key never touched the vault.';
      progress(2, [1]);
    },
    save() {
      clearTimers();
      demo.dataset.state = 'saved';
      key = key || newKey();
      setCount(1);
      setOtter(ui.otter, 'celebrate');
      say('safe and sound.', ['encrypted and locked to ', { code: REAL }, '.'], [{ label: 'now visit a lookalike →', run: states.lookalike }]);
      ui.caption.textContent = 'saved on this device, bound to one exact site.';
      progress(2, [1, 2]);
    },
    lookalike() {
      clearTimers();
      if (!saved) { key = key || newKey(); setCount(1); }
      demo.dataset.state = 'lookalike';
      setUrl('console.examp1e.dev', '/deploy', true);
      ui.console.hidden = true;
      ui.deploy.hidden = false;
      ui.fieldValue.textContent = '';
      setOtter(ui.otter, 'pout');
      say('hold on.', ['this is ', { code: 'console.examp1e.dev', mark: '1' }, ', not ', { code: REAL }, ". i won't fill here."], [{ label: 'go to the real site', run: states.real }]);
      ui.caption.textContent = 'one character is different. close enough to fool a person, not otter.';
      progress(3, [1, 2]);
    },
    real() {
      clearTimers();
      demo.dataset.state = 'real';
      setUrl(REAL, '/deploy', false);
      ui.console.hidden = true;
      ui.deploy.hidden = false;
      ui.fieldValue.textContent = '';
      setOtter(ui.otter, 'idle');
      say('i know this place.', ['fill the key saved for this exact site?'], [
        { label: 'fill securely', run: states.fill },
        { label: 'not now', kind: 'quiet', run: () => { ui.bubble.hidden = true; } }
      ]);
      ui.caption.textContent = 'protocol, host and port match where the key was saved.';
      progress(3, [1, 2]);
    },
    fill() {
      clearTimers();
      demo.dataset.state = 'filled';
      ui.fieldValue.textContent = `sk-live-••••••••••••${key.slice(-4)}`;
      setOtter(ui.otter, 'salute');
      say('filled for this exact site.', ['and nowhere else. ever.'], [{ label: 'replay the demo', run: states.start }]);
      ui.caption.textContent = "that's the whole job. notice, ask, return to the right place.";
      progress(3, [1, 2, 3]);
    }
  };

  ui.create.addEventListener('click', () => { stopPlaying(); states.reveal(); });
  ui.restart.addEventListener('click', () => { stopPlaying(); states.start(); });

  steps.forEach(step => {
    step.tabIndex = 0;
    step.setAttribute('role', 'button');
    const choose = () => {
      stopPlaying();
      const n = Number(step.dataset.step);
      if (n === 1) states.start();
      if (n === 2) { states.reveal(); }
      if (n === 3) states.lookalike();
    };
    step.addEventListener('click', choose);
    step.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
    });
  });

  function stopPlaying() {
    if (!playing) return;
    playing = false;
    playTimers.forEach(clearTimeout);
    playTimers = [];
    ui.play.setAttribute('aria-pressed', 'false');
    ui.play.textContent = 'play it for me';
  }

  ui.play.addEventListener('click', () => {
    if (playing) { stopPlaying(); return; }
    playing = true;
    ui.play.setAttribute('aria-pressed', 'true');
    ui.play.textContent = 'stop';
    states.start();
    // the reveal schedules the prompt itself; each later step waits for a readable beat
    const script = [[900, states.reveal], [2600, states.save], [2600, states.lookalike], [3200, states.real], [2400, states.fill], [2600, () => stopPlaying()]];
    let at = 0;
    for (const [wait, step] of script) {
      at += wait;
      playTimers.push(setTimeout(() => { if (playing) step(); }, at));
    }
  });

  // only fetch otter clips once the demo is near the screen
  if ('IntersectionObserver' in window) {
    const wake = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      otterReady = true;
      if (demo.dataset.state === 'start') setOtter(ui.otter, 'idle');
      wake.disconnect();
    }, { rootMargin: '300px 0px' });
    wake.observe(demo);
  } else {
    otterReady = true;
  }
  states.start();

  /* ---------- notebook: filter tabs ---------- */
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const records = [...document.querySelectorAll('.records li')];
  function selectTab(tab) {
    tabs.forEach(t => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    const filter = tab.dataset.filter;
    records.forEach(record => { record.hidden = filter !== 'all' && record.dataset.kind !== filter; });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!move) return;
      const next = tabs[(index + move + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
  selectTab(tabs[0]);

  /* ---------- gentle reveal on scroll ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const targets = document.querySelectorAll('.section-head, .statement .wrap, .card, .callout, .split-copy, .vault, .manifesto .wrap');
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      if (el.classList.contains('card')) el.style.transitionDelay = `${(i % 4) * 60}ms`;
      reveal.observe(el);
    });
  }
})();
