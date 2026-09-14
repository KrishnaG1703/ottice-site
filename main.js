(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  /* ---------- mascot: one svg, expressions switched by data-mood ---------- */
  const template = $('mascot-template');
  const flatTemplate = $('mascot-flat-template');
  // the demo uses the flat, expressive otter; elsewhere the glossy green otter
  document.querySelectorAll('.mascot').forEach(el => el.append((el.dataset.mascot === 'flat' ? flatTemplate : template).content.cloneNode(true)));
  function setMood(el, mood) {
    if (!el) return;
    // restart the entrance animation even when the mood repeats
    el.dataset.mood = '';
    void el.offsetWidth;
    el.dataset.mood = mood;
  }

  /* ---------- nav ---------- */
  const nav = $('nav');
  const setScrolled = () => nav.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', setScrolled, { passive: true });
  setScrolled();
  const navLinks = [...nav.querySelectorAll('nav a')];
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) navLinks.forEach(link => link.toggleAttribute('aria-current', link.getAttribute('href') === `#${entry.target.id}`));
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean).forEach(section => spy.observe(section));
  }

  /* ---------- the live demo ---------- */
  const demo = $('demo');
  const ui = {
    urlText: $('demo-url-text'), urlIcon: $('demo-url-icon'),
    console: $('view-console'), deploy: $('view-deploy'),
    create: $('demo-create'), keyCard: $('demo-key-card'), key: $('demo-key'),
    fieldValue: $('demo-field-value'),
    bubble: $('demo-bubble'), title: $('demo-bubble-title'), body: $('demo-bubble-body'), actions: $('demo-bubble-actions'),
    mascot: $('demo-mascot'), caption: $('demo-caption'), play: $('demo-play'), restart: $('demo-restart')
  };
  const chips = [...document.querySelectorAll('.step-chip')];
  const REAL = 'console.example.dev';
  let key = '';
  let saved = false;
  let timers = [];
  let playTimers = [];
  let playing = false;

  const later = (ms, fn) => timers.push(setTimeout(fn, reduceMotion ? Math.min(ms, 200) : ms));
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

  function code({ code: text, mark }) {
    const el = document.createElement('code');
    const i = mark ? text.indexOf(mark) : -1;
    if (i < 0) el.textContent = text;
    else el.append(text.slice(0, i), Object.assign(document.createElement('mark'), { textContent: mark }), text.slice(i + mark.length));
    return el;
  }

  // body parts are strings or { code, mark } so hostnames keep their case
  function say(title, parts, actions = []) {
    ui.title.textContent = title;
    ui.body.replaceChildren(...parts.map(part => typeof part === 'string' ? document.createTextNode(part) : code(part)));
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
    chips.forEach(chip => {
      const n = Number(chip.dataset.step);
      if (n === active) chip.setAttribute('aria-current', 'step');
      else chip.removeAttribute('aria-current');
      chip.classList.toggle('is-done', done.includes(n));
    });
  }

  function showConsole() { ui.console.hidden = false; ui.deploy.hidden = true; }
  function showDeploy() { ui.console.hidden = true; ui.deploy.hidden = false; ui.fieldValue.textContent = ''; }

  const states = {
    start() {
      clearTimers();
      key = '';
      saved = false;
      demo.dataset.state = 'start';
      setUrl(REAL, '/settings/keys', false);
      showConsole();
      ui.keyCard.hidden = true;
      ui.create.disabled = false;
      ui.bubble.hidden = true;
      setMood(ui.mascot, 'idle');
      ui.caption.textContent = 'click “create key” to start.';
      progress(1);
    },
    reveal() {
      clearTimers();
      demo.dataset.state = 'revealing';
      key = key || newKey();
      setUrl(REAL, '/settings/keys', false);
      showConsole();
      ui.create.disabled = true;
      ui.keyCard.hidden = false;
      ui.bubble.hidden = true;
      setMood(ui.mascot, 'alert');
      ui.caption.textContent = 'a brand-new key appears as plain page text. otter notices, and saves nothing yet.';
      progress(1);
      let shown = 0;
      const tick = () => {
        shown = Math.min(key.length, shown + 3);
        ui.key.textContent = key.slice(0, shown);
        if (shown < key.length) later(26, tick);
      };
      tick();
      later(950, states.ask);
    },
    ask() {
      demo.dataset.state = 'asking';
      setMood(ui.mascot, 'alert');
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
      setMood(ui.mascot, 'shrug');
      say('no problem.', ["nothing was saved. i'll ask again next time."], [{ label: 'ask me again', run: states.ask }]);
      ui.caption.textContent = 'you said no, so the key never touched the vault.';
      progress(2, [1]);
    },
    save() {
      clearTimers();
      demo.dataset.state = 'saved';
      key = key || newKey();
      saved = true;
      setMood(ui.mascot, 'happy');
      say('safe and sound.', ['encrypted and locked to ', { code: REAL }, '.'], [{ label: 'now visit a lookalike →', run: states.lookalike }]);
      ui.caption.textContent = 'saved on this device, bound to one exact site.';
      progress(2, [1, 2]);
    },
    lookalike() {
      clearTimers();
      if (!saved) { key = key || newKey(); saved = true; }
      demo.dataset.state = 'lookalike';
      setUrl('console.examp1e.dev', '/deploy', true);
      showDeploy();
      setMood(ui.mascot, 'stern');
      say('hold on.', ['this is ', { code: 'console.examp1e.dev', mark: '1' }, ', not ', { code: REAL }, ". i won't fill here."], [{ label: 'go to the real site', run: states.real }]);
      ui.caption.textContent = 'one character is different. close enough to fool a person, not otter.';
      progress(3, [1, 2]);
    },
    real() {
      clearTimers();
      demo.dataset.state = 'real';
      setUrl(REAL, '/deploy', false);
      showDeploy();
      setMood(ui.mascot, 'idle');
      say('i know this place.', ['fill the key saved for this exact site?'], [
        { label: 'fill securely', run: states.fill },
        { label: 'not now', kind: 'quiet', run: () => { ui.bubble.hidden = true; setMood(ui.mascot, 'shrug'); } }
      ]);
      ui.caption.textContent = 'protocol, host and port match where the key was saved.';
      progress(3, [1, 2]);
    },
    fill() {
      clearTimers();
      demo.dataset.state = 'filled';
      ui.fieldValue.textContent = `sk-live-••••••••••••${key.slice(-4)}`;
      setMood(ui.mascot, 'proud');
      say('filled for this exact site.', ['and nowhere else. ever.'], [{ label: 'replay the demo', run: states.start }]);
      ui.caption.textContent = "that's the whole job: notice, ask, return to the right place.";
      progress(3, [1, 2, 3]);
    }
  };

  const goToStep = n => (n === 1 ? states.start : n === 2 ? states.reveal : states.lookalike)();

  ui.create.addEventListener('click', () => { stopPlaying(); states.reveal(); });
  ui.restart.addEventListener('click', () => { stopPlaying(); states.start(); });
  chips.forEach(chip => chip.addEventListener('click', () => { stopPlaying(); goToStep(Number(chip.dataset.step)); }));

  // "see it in the demo" buttons in how it works
  document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
    stopPlaying();
    goToStep(Number(button.dataset.jump));
    demo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }));

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
    let at = 0;
    for (const [wait, step] of [[800, states.reveal], [2600, states.save], [2600, states.lookalike], [3200, states.real], [2400, states.fill], [2600, () => stopPlaying()]]) {
      at += wait;
      playTimers.push(setTimeout(() => { if (playing) step(); }, at));
    }
  });

  states.start();

  /* ---------- vault preview: tabs and lock ---------- */
  const vault = $('vault');
  const tabs = [...vault.querySelectorAll('[role="tab"]')];
  const records = [...vault.querySelectorAll('.records li')];
  function selectTab(tab) {
    tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    records.forEach(record => { record.hidden = tab.dataset.filter !== 'all' && record.dataset.kind !== tab.dataset.filter; });
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

  const lockButton = $('vault-lock');
  const status = $('vault-status');
  function setLocked(locked) {
    vault.dataset.locked = String(locked);
    $('vault-body').hidden = locked;
    $('vault-locked').hidden = !locked;
    lockButton.hidden = locked;
    status.lastChild.textContent = locked ? 'locked' : 'unlocked · auto-lock 15 min';
    (locked ? $('vault-unlock') : lockButton).focus({ preventScroll: true });
  }
  lockButton.addEventListener('click', () => setLocked(true));
  $('vault-unlock').addEventListener('click', () => setLocked(false));

  /* ---------- closing mascot waves again when it comes into view ---------- */
  const closer = document.querySelector('.closer-mascot');
  if (closer && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setMood(closer, 'happy'); }, { threshold: 0.6 }).observe(closer);
  }
})();
