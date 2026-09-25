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

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

  function draw() {
    frame = 0;
    const now = performance.now();
    points = points.filter((p) => now - p.t < LIFE);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

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

    if (points.length) frame = requestAnimationFrame(draw);
  }

  addEventListener('pointermove', (e) => {
    const now = performance.now();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const t = ev.timeStamp > 0 && ev.timeStamp <= now && now - ev.timeStamp < 500 ? ev.timeStamp : now;
      add(ev.clientX, ev.clientY, t);
    }
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });

  const lift = () => { stroke++; };
  addEventListener('pointerdown', lift, { passive: true });
  addEventListener('pointerup', lift, { passive: true });
  addEventListener('pointercancel', lift, { passive: true });
  addEventListener('scroll', lift, { passive: true });
  document.documentElement.addEventListener('pointerleave', lift);

  addEventListener('resize', resize);
  resize();
})();
