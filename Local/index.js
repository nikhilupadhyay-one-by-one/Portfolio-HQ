(() => {
    const cv = document.getElementById('fx'), ctx = cv.getContext('2d');
    const AR = 1586 / 992;                       // wallpaper aspect ratio
    const rnd = (a, b) => a + Math.random() * (b - a);
    const drops = [], rockets = [], sparks = [];
    let W, H, iw, ih, ox, oy, k, wind = 0, mx = .5, next = 0;

    // Map a point on the wallpaper (0-1, 0-1) to screen pixels.
    // Matches CSS "cover" + "center bottom", so fireworks stay over the skyline at any size.
    const P = (fx, fy) => [ox + fx * iw, oy + fy * ih];

    const drop = init => {
        const l = rnd(10, 26);
        return { x: rnd(-100, W + 100), y: init ? rnd(-H, H) : -l, l, v: l * rnd(.7, 1.1) + 8, a: rnd(.12, .4) };
    };

    function resize() {
        const dpr = devicePixelRatio || 1;
        W = innerWidth; H = innerHeight;
        cv.width = W * dpr; cv.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        iw = Math.max(W, H * AR); ih = iw / AR;
        ox = (W - iw) / 2; oy = H - ih; k = iw / 1586;
        drops.length = 0;
        for (let i = 0; i < W * H / 6000; i++) drops.push(drop(true));
    }

    function burst(x, y, sc = 1) {
        const hue = [8, 22, 42, 345][rnd(0, 4) | 0];   // warm oranges and pink, like the wallpaper
        for (let i = 0; i < 70; i++) {
            const a = rnd(0, 6.283), v = rnd(.4, 1.2) * k * sc;
            sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, h: hue + rnd(-12, 12) });
        }
    }

    function launch() {
        const [x, y] = P(rnd(.58, .97), .5);           // rise from the skyline
        rockets.push({ x, y, ty: P(0, rnd(.3, .44))[1] });
    }

    function frame(now) {
        ctx.clearRect(0, 0, W, H);
        // wind = cursor position + slow gusts
        wind += ((mx - .5) * 1.6 + Math.sin(now / 2500) * .5 - wind) * .02;

        ctx.globalCompositeOperation = 'lighter';
        if (now > next) { launch(); next = now + rnd(1800, 5000); }
        for (let i = rockets.length; i--;) {
            const r = rockets[i];
            r.y -= 2.4 * k;
            ctx.fillStyle = '#ffd9a0';
            ctx.beginPath(); ctx.arc(r.x, r.y, 1.2, 0, 6.283); ctx.fill();
            if (r.y <= r.ty) { burst(r.x, r.y); rockets.splice(i, 1); }
        }
        for (let i = sparks.length; i--;) {
            const s = sparks[i];
            s.vx *= .965; s.vy = s.vy * .965 + .01 * k;
            s.x += s.vx; s.y += s.vy; s.life -= .011;
            if (s.life <= 0) { sparks.splice(i, 1); continue; }
            ctx.fillStyle = `hsla(${s.h},100%,65%,${s.life})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, 1.3, 0, 6.283); ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#bcd0ff';
        for (const d of drops) {
            ctx.globalAlpha = d.a;
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wind * d.l * .5, d.y - d.l); ctx.stroke();
            d.x += wind * d.v * .5; d.y += d.v;
            if (d.y > H) Object.assign(d, drop());
            else if (d.x > W + 50) d.x -= W + 100;
            else if (d.x < -50) d.x += W + 100;
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(frame);
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', e => { mx = e.clientX / W; });
    addEventListener('pointerdown', e => {
        if (e.target.closest && e.target.closest('#home')) burst(e.clientX, e.clientY, 2.2);
    });

    resize();
    // Respect reduced-motion: the wallpaper stays as a still image
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(frame);
})();
