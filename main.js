(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // time-based easing: frame-count easing crawls when rAF is throttled
  const ease = (dt, rate) => 1 - Math.exp(-dt * rate);

  /* ---------- loader ---------- */
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loader-fill');
  let progress = 0;
  function bump(to) {
    progress = Math.max(progress, to);
    if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
    if (progress >= 1) setTimeout(() => loader?.classList.add('done'), 250);
  }
  bump(0.2);
  (document.fonts?.load('1em Lumiare') ?? Promise.resolve()).catch(() => {}).then(() => bump(0.6));

  /* ---------- shared state ---------- */
  const state = {
    w: innerWidth,
    h: innerHeight,
    mouse: { x: innerWidth * 0.72, y: innerHeight * 0.55, seen: false },
    light: { x: innerWidth * 0.72, y: innerHeight * 0.55 },
    otter: { x: innerWidth * 0.8, y: innerHeight * 0.62, angle: Math.PI, speed: 0 },
    tint: 0,
    focus: null // a point the otter should visit (the demo console), with an expiry
  };

  addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    state.mouse.x = event.clientX;
    state.mouse.y = event.clientY;
    state.mouse.seen = true;
  }, { passive: true });

  /* ---------- river: webgl caustics masked to one moonlit circle ---------- */
  const river = document.getElementById('river');
  const gl = river.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  let drawRiver = () => {};

  if (gl) {
    const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
    const frag = `
      precision mediump float;
      uniform vec2 uRes;
      uniform vec2 uLight;
      uniform float uRadius;
      uniform float uTime;
      uniform float uTint;

      // tileable water caustics
      float caustic(vec2 uv, float t) {
        vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
        vec2 i = p;
        float c = 1.0;
        float inten = 0.005;
        for (int n = 0; n < 5; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
        }
        c /= 5.0;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
      }

      void main() {
        vec2 frag = gl_FragCoord.xy;
        float d = distance(frag, uLight);
        float mask = smoothstep(uRadius, uRadius * 0.35, d);
        float rim = smoothstep(uRadius * 1.02, uRadius * 0.9, d) * (1.0 - smoothstep(uRadius * 0.9, uRadius * 0.7, d));
        if (mask <= 0.0 && rim <= 0.0) { gl_FragColor = vec4(0.004, 0.016, 0.024, 1.0); return; }

        vec2 uv = frag / uRes.y * 0.9;
        float t = uTime * 0.35 + 23.0;
        float c = caustic(uv, t) * 0.7 + caustic(uv * 1.7 + 3.1, t * 1.2) * 0.35;

        vec3 shallow = vec3(0.07, 0.36, 0.40);
        vec3 moonlit = vec3(0.05, 0.16, 0.33);
        vec3 kelp = vec3(0.08, 0.30, 0.20);
        vec3 base = uTint < 0.5 ? mix(shallow, moonlit, uTint * 2.0) : mix(moonlit, kelp, (uTint - 0.5) * 2.0);
        vec3 light = vec3(0.75, 0.93, 1.0);

        float depth = 1.0 - d / uRadius;
        vec3 col = base * (0.35 + 0.65 * depth) + light * clamp(c, 0.0, 1.2) * 0.55;
        col = col * mask + vec3(0.62, 0.89, 0.72) * rim * 0.18;
        gl_FragColor = vec4(mix(vec3(0.004, 0.016, 0.024), col, max(mask, rim * 0.6)), 1.0);
      }`;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };

    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(program);
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = name => gl.getUniformLocation(program, name);
      const uRes = u('uRes'), uLight = u('uLight'), uRadius = u('uRadius'), uTime = u('uTime'), uTint = u('uTint');

      drawRiver = (time, radius) => {
        const dpr = river.width / state.w;
        gl.viewport(0, 0, river.width, river.height);
        gl.uniform2f(uRes, river.width, river.height);
        gl.uniform2f(uLight, state.light.x * dpr, river.height - state.light.y * dpr);
        gl.uniform1f(uRadius, radius * dpr);
        gl.uniform1f(uTime, time);
        gl.uniform1f(uTint, state.tint);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
    } catch (error) {
      console.warn('otter: water shader unavailable', error);
    }
  }

  if (!gl) {
    const ctx = river.getContext('2d');
    drawRiver = (time, radius) => {
      ctx.fillStyle = '#010406';
      ctx.fillRect(0, 0, river.width, river.height);
      const dpr = river.width / state.w;
      const g = ctx.createRadialGradient(state.light.x * dpr, state.light.y * dpr, 0, state.light.x * dpr, state.light.y * dpr, radius * dpr);
      g.addColorStop(0, 'rgba(40,110,120,0.9)');
      g.addColorStop(1, 'rgba(1,4,6,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, river.width, river.height);
    };
  }
  bump(0.85);

  /* ---------- wake: the otter and its ripples ---------- */
  const wake = document.getElementById('wake');
  const wctx = wake.getContext('2d');
  const ripples = [];
  let travelled = 0;

  function resize() {
    state.w = innerWidth;
    state.h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    for (const canvas of [river, wake]) {
      canvas.width = Math.round(state.w * dpr);
      canvas.height = Math.round(state.h * dpr);
    }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  const otterScale = () => clamp(state.w / 1400, 0.55, 1);

  // top-down otter, nose pointing along +x
  function drawOtter(time) {
    const { x, y, angle, speed } = state.otter;
    const s = otterScale();
    const stroke = Math.sin(time * (4 + speed * 0.02));
    wctx.save();
    wctx.translate(x, y);
    wctx.rotate(angle);
    wctx.scale(s, s);

    // soft glow so the silhouette reads on black
    wctx.shadowColor = 'rgba(159, 226, 176, 0.25)';
    wctx.shadowBlur = 24;

    // tail: thick at the base, short taper, sways against the stroke
    const sway = stroke * 7;
    wctx.fillStyle = '#5c3a22';
    wctx.beginPath();
    wctx.moveTo(-30, -13);
    wctx.quadraticCurveTo(-58, sway * 0.5 - 8, -80, sway);
    wctx.quadraticCurveTo(-58, sway * 0.5 + 8, -30, 13);
    wctx.closePath();
    wctx.fill();

    // small webbed paws tucked close, paddling in opposite pairs
    wctx.fillStyle = '#4a2e1a';
    const paddle = stroke * 3.5;
    for (const [px, side, phase] of [[18, -1, 1], [18, 1, -1], [-20, -1, -1], [-20, 1, 1]]) {
      wctx.beginPath();
      wctx.ellipse(px + paddle * phase, side * 21, 6, 4, side * 0.4, 0, Math.PI * 2);
      wctx.fill();
    }

    // body: long but chunky
    const body = wctx.createLinearGradient(0, -24, 0, 24);
    body.addColorStop(0, '#6b4226');
    body.addColorStop(0.5, '#93613a');
    body.addColorStop(1, '#6b4226');
    wctx.fillStyle = body;
    wctx.beginPath();
    wctx.ellipse(-2, 0, 42, 23, 0, 0, Math.PI * 2);
    wctx.fill();
    wctx.shadowBlur = 0;

    // head with pale face
    wctx.fillStyle = '#8b5a34';
    wctx.beginPath();
    wctx.ellipse(40, 0, 20, 19, 0, 0, Math.PI * 2);
    wctx.fill();
    wctx.fillStyle = '#f3e3cc';
    wctx.beginPath();
    wctx.ellipse(49, 0, 12, 14, 0, 0, Math.PI * 2);
    wctx.fill();
    // ears
    wctx.fillStyle = '#5c3a22';
    for (const side of [-1, 1]) {
      wctx.beginPath();
      wctx.arc(31, side * 16, 4.5, 0, Math.PI * 2);
      wctx.fill();
    }
    // eyes and nose
    wctx.fillStyle = '#10261f';
    for (const side of [-1, 1]) {
      wctx.beginPath();
      wctx.arc(44, side * 7.5, 2.6, 0, Math.PI * 2);
      wctx.fill();
    }
    wctx.beginPath();
    wctx.ellipse(58, 0, 3.6, 5, 0, 0, Math.PI * 2);
    wctx.fill();
    // whiskers
    wctx.strokeStyle = 'rgba(243, 227, 204, 0.75)';
    wctx.lineWidth = 1.1;
    for (const side of [-1, 1]) {
      for (const spread of [0, 5]) {
        wctx.beginPath();
        wctx.moveTo(54, side * 6);
        wctx.lineTo(68, side * (15 + spread));
        wctx.stroke();
      }
    }
    wctx.restore();
  }

  function drawRipples(time) {
    const life = 1.9;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const age = (time - r.born) / life;
      if (age >= 1) { ripples.splice(i, 1); continue; }
      const radius = (8 + age * 34) * otterScale();
      wctx.strokeStyle = `rgba(238, 246, 241, ${0.42 * (1 - age) ** 1.6})`;
      wctx.lineWidth = 1.4;
      wctx.beginPath();
      wctx.ellipse(r.x, r.y, radius, radius * 0.62, r.angle, 0, Math.PI * 2);
      wctx.stroke();
    }
  }

  /* ---------- where the otter wants to be ---------- */
  const panels = [...document.querySelectorAll('.panel')];
  function sectionTarget() {
    let total = 0, tx = 0, ty = 0, tint = 0;
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, state.h) - Math.max(rect.top, 0));
      if (!overlap) continue;
      const [ax, ay] = (panel.dataset.anchor || '0.75,0.5').split(',').map(Number);
      tx += ax * state.w * overlap;
      ty += ay * state.h * overlap;
      tint += Number(panel.dataset.tint || 0) * overlap;
      total += overlap;
    }
    if (!total) return { x: state.w * 0.75, y: state.h * 0.5, tint: state.tint };
    return { x: tx / total, y: ty / total, tint: tint / total };
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    const target = sectionTarget();
    state.tint += (target.tint - state.tint) * ease(dt, 2);

    let goalX = target.x, goalY = target.y;
    if (state.focus && time < state.focus.until) {
      goalX = state.focus.x();
      goalY = state.focus.y();
    }
    // slow idle orbit keeps it swimming while the reader is still
    if (!reduceMotion.matches) {
      goalX += Math.cos(time * 0.45) * 46;
      goalY += Math.sin(time * 0.7) * 30;
    }
    // narrow screens: keep it clear of the copy, hugging the right edge
    if (state.w < 760) goalX = clamp(goalX, state.w * 0.7, state.w - 40);

    const o = state.otter;
    const prevX = o.x, prevY = o.y;
    const k = reduceMotion.matches ? 6 : 1.6;
    o.x += (goalX - o.x) * ease(dt, k);
    o.y += (goalY - o.y) * ease(dt, k);
    const vx = (o.x - prevX) / Math.max(dt, 1e-3);
    const vy = (o.y - prevY) / Math.max(dt, 1e-3);
    o.speed = Math.hypot(vx, vy);
    if (o.speed > 6) {
      const want = Math.atan2(vy, vx);
      let delta = want - o.angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      o.angle += delta * ease(dt, 3.2);
    }

    // one ripple per distance travelled, not per frame
    travelled += Math.hypot(o.x - prevX, o.y - prevY);
    if (travelled > 34 * otterScale()) {
      travelled = 0;
      const back = 40 * otterScale();
      ripples.push({ x: o.x - Math.cos(o.angle) * back, y: o.y - Math.sin(o.angle) * back, angle: o.angle, born: time });
    }

    // the light follows the cursor; without one it rides with the otter
    const lx = state.mouse.seen && finePointer.matches ? state.mouse.x : o.x;
    const ly = state.mouse.seen && finePointer.matches ? state.mouse.y : o.y;
    state.light.x += (lx - state.light.x) * ease(dt, 9);
    state.light.y += (ly - state.light.y) * ease(dt, 9);

    const baseRadius = clamp(Math.min(state.w, state.h) * 0.3, 130, 250);
    const pulse = reduceMotion.matches ? 1 : 0.85 + 0.15 * Math.sin(time * 1.6);
    drawRiver(time, baseRadius * pulse);

    wctx.clearRect(0, 0, state.w, state.h);
    drawRipples(time);
    drawOtter(time);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(now => { last = now; bump(1); frame(now); });

  /* ---------- the pretend console ---------- */
  const consoleEl = document.getElementById('console');
  const create = document.getElementById('demo-create');
  const reveal = document.getElementById('demo-reveal');
  const keyEl = document.getElementById('demo-key');
  const bubble = document.getElementById('demo-bubble');
  const title = document.getElementById('demo-title');
  const detail = document.getElementById('demo-detail');
  const actions = document.getElementById('demo-actions');

  function fakeKey() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return 'nb_live_' + [...bytes].map(b => alphabet[b % alphabet.length]).join('');
  }

  function say(heading, text, buttons) {
    title.textContent = heading;
    detail.textContent = text;
    actions.replaceChildren(...buttons.map(({ label, secondary, run }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (secondary) button.className = 'secondary';
      button.addEventListener('click', run);
      return button;
    }));
    bubble.hidden = false;
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';
  }

  function visitConsole(seconds) {
    const rect = () => consoleEl.getBoundingClientRect();
    state.focus = {
      x: () => Math.min(rect().right + 90 * otterScale(), state.w - 60),
      y: () => rect().top + rect().height * 0.55,
      until: performance.now() / 1000 + seconds
    };
  }

  function reset() {
    bubble.hidden = true;
    reveal.hidden = true;
    create.disabled = false;
    create.textContent = '+ create key';
  }

  create.addEventListener('click', () => {
    create.disabled = true;
    keyEl.textContent = fakeKey();
    reveal.hidden = false;
    visitConsole(7);
    setTimeout(() => {
      say('a new api key just surfaced.', 'it appeared as one-time page text. save it before it disappears?', [
        { label: 'keep it safe', run: () => {
          visitConsole(4);
          say('safe and sound.', 'saved only for https://console.nimbus.example.', [
            { label: 'try again', run: reset }
          ]);
        } },
        { label: 'not now', secondary: true, run: reset }
      ]);
    }, 650);
  });
})();
