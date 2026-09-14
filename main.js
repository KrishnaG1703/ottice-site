(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- how it works: three moments ---------- */
  const steps = [...document.querySelectorAll('.step')];
  const stage = document.querySelector('.how-stage .console');
  let current = 1;
  let pausedUntil = 0;

  function showStep(n) {
    current = n;
    stage.dataset.stage = String(n);
    steps.forEach(step => {
      const active = Number(step.dataset.step) === n;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-current', active ? 'step' : 'false');
    });
  }

  steps.forEach(step => {
    step.tabIndex = 0;
    step.setAttribute('role', 'button');
    const choose = () => { showStep(Number(step.dataset.step)); pausedUntil = Date.now() + 9000; };
    step.addEventListener('click', choose);
    step.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
    });
  });

  let howVisible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { howVisible = entry.isIntersecting; }, { threshold: 0.35 })
      .observe(document.getElementById('how'));
  }
  if (!reduceMotion) {
    setInterval(() => {
      if (howVisible && Date.now() > pausedUntil && !document.hidden) showStep(current % steps.length + 1);
    }, 3600);
  }
  showStep(1);

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
