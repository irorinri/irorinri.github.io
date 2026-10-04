// home.css を使うページ共通の手ざわり

// data-nudge の付いたものは、つつくと紙のようにゆれる
document.querySelectorAll('[data-nudge]').forEach((el) => {
  el.addEventListener('pointerdown', () => {
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
  });
  el.addEventListener('animationend', (e) => {
    if (e.animationName === 'nudge') el.classList.remove('nudge');
  });
});

// なぞった跡が鉛筆の線になって、少しずつ消えていく
// （スマホやタブレットでは、空白で 0.8 秒指を止めてから）
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let canvas = document.querySelector('.pencil');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'pencil';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }
  if (!canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const LIFE = 1200; // 線が紙に残る時間(ms)
  let points = [];
  let stroke = 0;
  let frame = 0;

  let W = 0;
  let H = 0;

  // キャンバスは実際に見えている大きさに合わせる（スクロールバーの幅を含めると、マウスと線がずれる）
  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (points.length || wave) kick();
  }

  function add(x, y, now) {
    const last = points[points.length - 1];
    if (last && last.s === stroke) {
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < 1.5) return;
      if (dist > 160 || now - last.t > 140) stroke++;
    }
    const speed = last ? Math.hypot(x - last.x, y - last.y) / Math.max(now - last.t, 1) : 0;
    points.push({
      x: x + (Math.random() - .5) * .7,
      y: y + (Math.random() - .5) * .7,
      t: now,
      s: stroke,
      w: Math.max(.6, 1.7 - speed * .45),
    });
  }

  // 指を止めている間の波紋。手描きっぽく少しだけゆがんだ輪にする
  function ring(x, y, r, alpha, width, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      const rr = r * (1 + .016 * Math.sin(3 * a + seed) + .01 * Math.sin(5 * a + seed * 1.7));
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.strokeStyle = `rgba(64, 64, 64, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawWave(w, now) {
    const fade = w.end ? Math.max(0, 1 - (now - w.end) / 240) : 1;
    const held = now - w.t0;
    if (held > 0 && fade > 0) {
      const grow = Math.min(held / (HOLD - RIPPLE_DELAY), 1); // 止めているほど濃くなる
      for (let j = 0; j < 3; j++) {
        const age = held - j * 260;
        if (age < 0) continue;
        const phase = (age / 900) % 1;
        ring(w.x, w.y, 22 + phase * 98, (1 - phase) * (.14 + .32 * grow) * fade, 1.3, j * 2.1);
      }
    }
    if (!w.done) return fade > 0;

    // 0.8秒たった合図：ひときわ大きな波紋がひとつ弾ける
    const t = (now - w.end) / 520;
    if (t >= 1) return false;
    const ease = 1 - (1 - t) * (1 - t);
    ring(w.x, w.y, 26 + ease * 130, .55 * (1 - t), 1.7, 4.2);
    return true;
  }

  function draw() {
    frame = 0;
    const now = performance.now();
    points = points.filter((p) => now - p.t < LIFE);
    ctx.clearRect(0, 0, W, H);

    if (wave && !drawWave(wave, now)) wave = null;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (a.s !== b.s) continue;
      const fade = 1 - (now - b.t) / LIFE;
      ctx.strokeStyle = `rgba(64, 64, 64, ${.38 * fade * fade})`;
      ctx.lineWidth = b.w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (points.length || wave) frame = requestAnimationFrame(draw);
  }

  const kick = () => { if (!frame) frame = requestAnimationFrame(draw); };

  // 指やペン：空白で 0.8 秒指を止めると波紋が広がり、そこから鉛筆で描ける。
  // すぐに動かしたときや、文字・絵の上から始めたときは、いつも通りスクロール
  const HOLD = 800;         // 描き始めるまで指を止める時間(ms)
  const RIPPLE_DELAY = 150; // スクロールのたびに波紋がちらつかないよう、少し待ってから出す
  const SLOP = 10;          // これ以上動いたら「スクロールしたい」とみなす(px)
  const CONTENT = 'a, button, summary, img, p, h1, h2, li, time, footer, input, textarea, .post-body, .work, .letter';
  const root = document.documentElement;
  let press = null;   // 指を止めて待っているところ
  let drawing = false;
  let activeId = null;
  let wave = null;

  const onContent = (target) => {
    const el = target instanceof Element ? target : target && target.parentElement;
    return !el || !!el.closest(CONTENT);
  };

  function startPress(e) {
    const now = performance.now();
    activeId = e.pointerId;
    press = { x: e.clientX, y: e.clientY };
    wave = { x: e.clientX, y: e.clientY, t0: now + RIPPLE_DELAY, end: 0, done: false };
    root.classList.add('pressing');
    press.timer = setTimeout(() => {
      const t = performance.now();
      press = null;
      drawing = true;
      wave.end = t;
      wave.done = true;
      stroke++;
      add(wave.x, wave.y, t);
      kick();
    }, HOLD);
    kick();
  }

  function endPress() {
    if (press) {
      clearTimeout(press.timer);
      press = null;
      if (wave && !wave.done) wave.end = performance.now();
    }
    drawing = false;
    activeId = null;
    root.classList.remove('pressing');
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') {
      if (e.pointerId !== activeId) return;
      if (press) {
        // 待っている間に動いた → スクロールに任せる
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) endPress();
        return;
      }
      if (!drawing) return;
    }
    const now = performance.now();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const t = ev.timeStamp > 0 && ev.timeStamp <= now && now - ev.timeStamp < 500 ? ev.timeStamp : now;
      add(ev.clientX, ev.clientY, t);
    }
    kick();
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    stroke++;
    if (e.pointerType === 'mouse') return;
    endPress(); // 二本目の指が触れたら、描くのもやめる（ズームはブラウザに任せる）
    if (e.isPrimary && !onContent(e.target)) startPress(e);
  }, { passive: true });

  const lift = (e) => {
    stroke++;
    if (e.pointerId === activeId) endPress();
  };
  addEventListener('pointerup', lift, { passive: true });
  addEventListener('pointercancel', lift, { passive: true });
  addEventListener('scroll', () => {
    stroke++;
    if (press) endPress();
  }, { passive: true });
  root.addEventListener('pointerleave', () => { stroke++; });

  // 長押しでメニューや文字選択が出ないようにする
  addEventListener('contextmenu', (e) => {
    if (press || drawing) e.preventDefault();
  });

  // 描いている間だけ、指の動きでページがスクロールしないようにする
  addEventListener('touchmove', (e) => {
    if (!drawing) return;
    if (e.touches.length > 1) { endPress(); return; }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  // 記事を開いてスクロールバーが出たときなど、ウインドウの大きさが変わらなくても合わせ直す
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  addEventListener('resize', resize);
  resize();
})();
