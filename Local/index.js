/* ============================================================
   1. RAIN, SNOW AND FIREWORKS  (canvas 2D layer, #fx)
   ============================================================ */
(() => {
    const cv = document.getElementById('fx'), ctx = cv.getContext('2d');
    const AR = 1586 / 992;                       // wallpaper aspect ratio
    const rnd = (a, b) => a + Math.random() * (b - a);
    const drops = [], rockets = [], sparks = [], flakes = [];
    let W, H, dpr = 1, iw, ih, ox, oy, k, wind = 0, mx = .5, my = .5, next = 0, last = 0;
    const storm = /[?&]storm\b/.test(location.search);   // add ?storm to the URL to see lightning every few seconds
    let lx = 0, ly = 0, pz = 1, px = 0, py = 0, rr = 0;                    // smoothed cursor lean + camera (zoom, pan as fractions of the screen)
    let strike = -1e9, nextStrike = storm ? 2500 : 6000, bolt = null, bu = .5;   // lightning

    // Camera: the whole .scene layer (wallpaper + rain + fireworks) drifts as one, so nothing slides off the skyline.
    // Clicks arrive in screen pixels, so map them back into the layer's own coordinates.
    const scene = document.querySelector('.scene');
    const toLayer = (x, y) => {
        const dx = x - W / 2 - px * W, dy = y - H / 2 - py * H, c = Math.cos(rr), s = Math.sin(rr);
        return [W / 2 + (dx * c + dy * s) / pz, H / 2 + (dy * c - dx * s) / pz];
    };

    // Jagged bolt: repeatedly nudge midpoints sideways
    const zig = (x0, y0, x1, y1, j) => {
        let pts = [[x0, y0], [x1, y1]];
        for (let n = 0; n < 5; n++, j *= .55) {
            const out = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
                const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
                out.push([(ax + bx) / 2 + rnd(-j, j), (ay + by) / 2 + rnd(-j, j) * .3], pts[i]);
            }
            pts = out;
        }
        return pts;
    };

    // Soft round sprite, painted once and stamped for every snowflake
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const dg = dot.getContext('2d'), grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(.4, 'rgba(232,240,255,.8)');
    grad.addColorStop(1, 'rgba(220,232,255,0)');
    dg.fillStyle = grad; dg.fillRect(0, 0, 32, 32);

    // z: 0 = small, far, slow and sharp; 1 = big, near, faster and softer
    const flake = init => {
        const z = Math.random() ** 2;
        return { x: rnd(0, W), y: init ? rnd(0, H) : -10, z, r: 2 + z * 4, v: 26 + z * 55, f: rnd(.6, 1.6), p: rnd(0, 6.283), a: .9 - z * .45 };
    };

    // Map a point on the wallpaper (0-1, 0-1) to screen pixels.
    // Matches CSS "cover" + "center bottom", so fireworks stay over the skyline at any size.
    const P = (fx, fy) => [ox + fx * iw, oy + fy * ih];

    const drop = init => {
        const l = rnd(10, 26);
        return { x: rnd(-100, W + 100), y: init ? rnd(-H, H) : -l, l, v: l * rnd(.7, 1.1) + 8, a: rnd(.12, .4) };
    };

    function resize() {
        dpr = devicePixelRatio || 1;
        W = innerWidth; H = innerHeight;
        cv.width = W * dpr; cv.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        iw = Math.max(W, H * AR); ih = iw / AR;
        ox = (W - iw) / 2; oy = H - ih; k = iw / 1586;
        drops.length = 0;
        for (let i = 0; i < W * H / 6000; i++) drops.push(drop(true));
        flakes.length = 0;
        for (let i = 0; i < Math.min(160, W * H / 14000); i++) flakes.push(flake(true));
    }

    function burst(x, y, sc = 1) {
        const hue = [8, 22, 42, 345][rnd(0, 4) | 0];   // warm oranges and pink, like the wallpaper
        window.__sound?.boom(sc > 1 ? .1 : rnd(.5, 1.3));
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
        const dt = Math.min((now - last) / 1000, .05); last = now;
        // wind = cursor position + slow gusts
        wind += ((mx - .5) * 1.6 + Math.sin(now / 2500) * .5 - wind) * .02;
        window.__wind = wind;   // share with wall.js so the wallpaper leans with the same gusts

        // camera: slow drift, a gentle zoom "breathing", and a lean toward the cursor (eases in after load, no pop)
        const t = now / 1000, ease = 1 - Math.exp(-t / 3);            // eases in after load, so there is no sudden pop
        lx += ((mx - .5) * 2 - lx) * .03; ly += ((my - .5) * 2 - ly) * .03;
        pz = 1 + ease * (.09 + Math.sin(t * .09) * .012);             // slow zoom "breathing"
        const lim = (pz - 1) / 2 * .8, clamp = v => Math.max(-lim, Math.min(lim, v));   // never pan past the layer's overscan
        px = clamp(ease * (Math.sin(t * .31) * .012 + Math.sin(t * .19 + 2) * .006 + lx * .01));
        py = clamp(ease * (Math.sin(t * .23 + 1) * .008 + Math.sin(t * .14 + 4) * .004 + ly * .006));
        rr = ease * Math.sin(t * .17 + 3) * .0045;                    // a hint of handheld roll (about a quarter of a degree)
        scene.style.transform = `translate3d(${px * W}px, ${py * H}px, 0) rotate(${rr}rad) scale(${pz})`;

        // lightning: rare and soft - at most two pulses, never a strobe
        if (now > nextStrike) {
            const [bx, by] = P(rnd(.25, .9), rnd(.04, .14));
            strike = now; nextStrike = now + (storm ? rnd(3000, 6000) : rnd(14000, 38000)); bu = (bx - ox) / iw;
            bolt = Math.random() < .6 ? zig(bx, by, bx + rnd(-.05, .05) * iw, P(0, rnd(.43, .5))[1], 60 * k) : null;   // otherwise: sheet lightning behind the clouds
            if (bolt) { const [qx, qy] = bolt[9]; bolt.br = zig(qx, qy, qx + rnd(-.06, .06) * iw, qy + rnd(60, 140) * k, 24 * k); }
            window.__sound?.thunder(rnd(1.2, 3.8));
        }
        const pulse = a => a < 0 ? 0 : a < .04 ? a / .04 : Math.exp(-(a - .04) * 5), a0 = (now - strike) / 1000;
        const fl = Math.min(1, pulse(a0) + .55 * pulse(a0 - .24));
        scene.style.filter = fl > .01 ? `brightness(${(1 + fl * .8).toFixed(2)})` : '';   // the whole layer flashes

        ctx.globalCompositeOperation = 'lighter';
        if (fl > .01) {                                   // cloud glow around the strike (the brightness flash is on the layer)
            const [gx, gy] = P(bu, .13), g = ctx.createRadialGradient(gx, gy, 0, gx, gy, iw * .5);
            g.addColorStop(0, `rgba(170,195,255,${fl * .3})`); g.addColorStop(1, 'rgba(170,195,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        if (bolt && fl > .02) {
            ctx.lineJoin = 'round';
            for (const [pts, w] of [[bolt, 1], [bolt.br, .5]]) {
                ctx.beginPath();
                pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
                ctx.strokeStyle = `rgba(150,180,255,${fl * .25})`; ctx.lineWidth = 9 * k * w; ctx.stroke();
                ctx.strokeStyle = `rgba(235,242,255,${fl * .9})`; ctx.lineWidth = 1.4 * k * w; ctx.stroke();
            }
        }
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
        // snow: slow fall, gentle sway, and it leans with the same wind as the rain
        for (const f of flakes) {
            f.y += f.v * dt;
            f.x += (Math.sin(now / 1000 * f.f + f.p) * (14 + f.z * 20) + wind * (40 + f.z * 70)) * dt;
            if (f.y > H + 10) Object.assign(f, flake());
            else if (f.x > W + 10) f.x = -10;
            else if (f.x < -10) f.x = W + 10;
            ctx.globalAlpha = f.a;
            ctx.drawImage(dot, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(frame);
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', e => { mx = e.clientX / W; my = e.clientY / H; });
    addEventListener('pointerdown', e => {
        if (e.target.closest && e.target.closest('#home')) burst(...toLayer(e.clientX, e.clientY), 2.2);
    });

    resize();
    window.__salvo = () => { for (let i = 0; i < 5; i++) setTimeout(launch, i * 500 + rnd(0, 250)); };   // used by the Achievements reward
    // Respect reduced-motion: the wallpaper stays as a still image
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(frame);
})();

/* ============================================================
   2. LIVE WALLPAPER  (WebGL shader, #wall)
   ============================================================ */
(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // keep the still image
    const SRC = 'Rainy_Moonlit_Cityscape_Overlook.png';
    const cv = document.getElementById('wall');
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl) return;

    const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

    // All regions are placed in wallpaper coordinates (uv: 0-1, y down), so they follow the image at any screen size.
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D T; uniform vec2 R; uniform float A, t, w;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y);
}
float el(vec2 uv, vec2 c, vec2 r){ return 1.-smoothstep(1.,1.5,length((uv-c)/r)); }  // 1 inside an ellipse
void main(){
  vec2 p=vec2(gl_FragCoord.x, R.y-gl_FragCoord.y);
  float iw=max(R.x,R.y*A), ih=iw/A;                       // "cover", aligned bottom
  vec2 uv=vec2((p.x-(R.x-iw)*.5)/iw, (p.y-(R.y-ih))/ih);
  float g=w+.35*sin(t*1.3)*(.5+abs(w));                   // wind gust (cursor + gusts from index.js)
  vec2 d=vec2(0.);

  // lake: wobble the reflections, skip the guy and the far island
  float wm=smoothstep(.528,.545,uv.y)*(1.-smoothstep(0.,.02,uv.y-(.58+.17*uv.x)))*smoothstep(.15,.22,uv.x)
          *(1.-el(uv,vec2(.306,.63),vec2(.045,.13)))*(1.-el(uv,vec2(.93,.585),vec2(.09,.035)));
  float depth=(uv.y-.53)*5.;
  d.x+=wm*(.0006+.0022*depth)*(1.+abs(g))*(sin(uv.y*260.+t*1.3)+.6*sin(uv.y*610.-t*2.1+uv.x*30.));
  d.y+=wm*.0006*(n(vec2(uv.x*60.,uv.y*180.+t*.5))-.5);

  // clouds: slow rolling distortion, moon left alone
  float sm=(1.-smoothstep(.40,.47,uv.y))*smoothstep(.1,.2,uv.x)*(1.-el(uv,vec2(.257,.11),vec2(.04,.065)));
  d+=sm*(1.+abs(g))*.003*(vec2(n(vec2(uv.x*3.-t*.03,uv.y*5.)), n(vec2(uv.x*4.,uv.y*6.-t*.02+9.)))-.5);

  // pines (top-left) and grass (bottom-right) lean with the wind
  float tm=(1.-smoothstep(.09,.15,uv.x))*(1.-smoothstep(0.,.5,uv.y));
  float gm=smoothstep(.72,.8,uv.y)*smoothstep(.45,.6,uv.x)*clamp((1.-uv.y)*5.,0.,1.);
  d.x-=(tm+gm)*(g*.003+.0015*sin(t*1.9+uv.y*9.+uv.x*30.));

  // the guy's jacket: sways more toward the hem
  float cm=el(uv,vec2(.306,.6),vec2(.036,.052))*smoothstep(.55,.64,uv.y);
  d.x-=cm*(g*.0025+.0015*sin(t*4.+uv.y*140.));

  vec4 c=texture2D(T,uv+d);
  c.rgb*=1.+wm*.25*(n(vec2(uv.x*90.,uv.y*250.-t*.8))-.5);   // glints on the water
  gl_FragColor=vec4(c.rgb,1.);
}`;

    const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    };

    const img = new Image();
    img.onerror = () => console.error('Wallpaper not found at', img.src, '(file names are case-sensitive on GitHub Pages)');
    img.onload = () => { try { start(); } catch (e) { console.error('Wallpaper shader failed (opening via file:// also causes this):', e); } };
    img.src = SRC;

    function start() {
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(pr); gl.useProgram(pr);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, 'a');
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                              [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
            gl.texParameteri(gl.TEXTURE_2D, k, v);

        const U = n => gl.getUniformLocation(pr, n);
        const uR = U('R'), ut = U('t'), uw = U('w');
        gl.uniform1f(U('A'), img.naturalWidth / img.naturalHeight);

        const size = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
            gl.viewport(0, 0, cv.width, cv.height);
        };
        const draw = now => {
            gl.uniform2f(uR, cv.width, cv.height);
            gl.uniform1f(ut, now / 1000);
            gl.uniform1f(uw, window.__wind || 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        addEventListener('resize', size);
        window.__ar = img.naturalWidth / img.naturalHeight;   // lets index.js line the fireworks up exactly
        size(); draw(0);
        dispatchEvent(new Event('resize'));
        cv.classList.add('ready');
        const loop = now => { draw(now); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
    }
})();

/* ============================================================
   3. CUSTOM CURSOR
   ============================================================ */
(() => {
    // Mouse-only embellishment: touch devices and reduced-motion visitors keep the normal cursor.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    // #cursor sits exactly on the pointer (no lag); the triangle <i> inside it does the turning.
    const el = document.createElement('div'), tri = document.createElement('i');
    el.id = 'cursor';
    el.appendChild(tri);
    document.body.appendChild(el);

    let angle = 0, hovering = false, pressed = false, seen = false, lastX = 0, lastY = 0;

    const look = () => {
        tri.style.transform = `rotate(${angle}deg) scale(${pressed ? .7 : hovering ? 1.4 : 1})`;
    };

    addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;               // ignore touch/pen on hybrid devices
        const { clientX: x, clientY: y } = e;
        if (!seen) {                                         // first move or re-entry: snap, don't spin
            document.documentElement.classList.add('has-custom-cursor');
            el.classList.add('visible');
            lastX = x; lastY = y; seen = true;
        }
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const dx = x - lastX, dy = y - lastY;
        if (Math.hypot(dx, dy) > 6) {                        // ignore jitter, keep the last heading
            const target = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            angle += (((target - angle) % 360) + 540) % 360 - 180;   // shortest turn, safe for any angle
            lastX = x; lastY = y;
        }
        hovering = !!e.target.closest?.('a, button');
        look();
    }, { passive: true });

    addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { pressed = true; look(); } });
    addEventListener('pointerup', () => { pressed = false; look(); });
    addEventListener('blur', () => { pressed = false; look(); });
    document.documentElement.addEventListener('mouseleave', () => {
        el.classList.remove('visible'); seen = pressed = false; look();
    });
})();

/* ============================================================
   4. NAV HIGHLIGHT  (which section you are reading)
   ============================================================ */
(() => {
    const links = [...document.querySelectorAll('header nav a')];
    const secs = [...document.querySelectorAll('main > section, footer')];
    let queued = false, current = null, rewarded = false;

    const update = () => {
        queued = false;
        let cur = secs[0];
        for (const el of secs) if (el.getBoundingClientRect().top <= innerHeight * .4) cur = el;
        if (scrollY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1];
        if (cur === current) return;
        current = cur;
        for (const a of links) {
            const on = a.hash === '#' + cur.id;
            a.classList.toggle('active', on);
            on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
        }
        if (cur.id === 'achievements' && !rewarded) { rewarded = true; window.__salvo?.(); }   // one small salvo, once
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    update();
})();

/* ============================================================
   5. SOUND SWITCH  (off by default; rain, distant fireworks and thunder are all generated in code)
   ============================================================ */
(() => {
    const AC = window.AudioContext || window.webkitAudioContext, btn = document.getElementById('sound');
    if (!AC || !btn) return;
    let ctx, master, brown, on = false;

    const noise = isBrown => {
        const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
        let l = 0;
        for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] = isBrown ? (l = (l + .02 * w) / 1.02) * 3.5 : w; }
        return b;
    };
    const layer = (buffer, type, freq, gain) => {
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = buffer; s.loop = true; f.type = type; f.frequency.value = freq; g.gain.value = gain;
        s.connect(f); f.connect(g); g.connect(master); s.start();
        return g;
    };
    const build = () => {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        brown = noise(true);
        const hiss = layer(noise(false), 'bandpass', 3800, .05);       // rain on leaves
        layer(brown, 'lowpass', 600, .22);                             // low body of the storm
        const lfo = ctx.createOscillator(), depth = ctx.createGain();  // slow swell so it never sounds looped
        lfo.frequency.value = .12; depth.gain.value = .02;
        lfo.connect(depth); depth.connect(hiss.gain); lfo.start();
    };
    // One low rumble: filtered brown noise with a rolling envelope (boom = short, thunder = long)
    const rumble = (delay, dur, peak, f0, f1) => {
        if (!on) return;
        const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = brown; s.loop = true; f.type = 'lowpass';
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + dur * .08);
        g.gain.linearRampToValueAtTime(peak * .4, t + dur * .3);
        g.gain.linearRampToValueAtTime(peak * .7, t + dur * .42);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 2); s.stop(t + dur + .1);
    };
    window.__sound = { boom: d => rumble(d, 1.4, .5, 220, 60), thunder: d => rumble(d, 5, .9, 320, 45) };

    btn.addEventListener('click', async () => {
        on = !on;
        btn.setAttribute('aria-pressed', on);
        btn.lastElementChild.textContent = on ? 'Sound on' : 'Sound off';
        if (!ctx) build();
        if (on) { await ctx.resume(); master.gain.setTargetAtTime(.8, ctx.currentTime, .6); }
        else { master.gain.setTargetAtTime(0, ctx.currentTime, .25); setTimeout(() => { if (!on) ctx.suspend(); }, 1500); }
    });
    document.addEventListener('visibilitychange', () => {              // silent while the tab is in the background
        if (!ctx || !on) return;
        document.hidden ? ctx.suspend() : ctx.resume();
    });
})();

// // ++++++ MODIFIED CODE FOR SOUND FEATURE ++++
// /* ============================================================
//    5. SOUND SWITCH  (off by default · everything is generated in code, no audio files)
//       rain · wind · waves on the shore · distant fireworks (boom + crackle) · thunder
//       Other sections trigger the one-shots:   __sound.boom(delaySeconds)   __sound.thunder(delaySeconds)
//       Console check after clicking "Sound":    __sound.demo()
//    ============================================================ */
// (() => {
//     const AC = window.AudioContext || window.webkitAudioContext, btn = document.getElementById('sound');
//     const LEVEL = 1;                                                  // overall volume, 0 – 1
//     const rnd = (a, b) => a + Math.random() * (b - a);
//     window.__sound = { boom() {}, thunder() {}, wave() {}, demo() {} };   // stubs: callers never throw, even if audio can't start
//     if (!AC || !btn) return console.warn('[sound] ' + (AC ? 'no #sound button found (is this script before it?)' : 'Web Audio not supported'));

//     let ctx, master, B, on = false, stops = [];

//     /* ---------- noise buffers ---------- */
//     // Loops seamlessly (the last half-second is cross-faded into the start) and is normalised to RMS .3
//     const makeBuf = (secs, fill) => {
//         const sr = ctx.sampleRate, n = sr * secs | 0, x = sr >> 1, raw = new Float32Array(n + x);
//         fill(raw, sr);
//         let e = 0; for (const v of raw) e += v * v;
//         const k = .3 / Math.sqrt(e / raw.length), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
//         for (let i = 0; i < n; i++) {
//             const p = i / x * Math.PI / 2;
//             d[i] = k * (i < x ? raw[i] * Math.sin(p) + raw[n + i] * Math.cos(p) : raw[i]);
//         }
//         return buf;
//     };
//     const white = r => { for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1; };
//     const pink = r => {          // Paul Kellet's pink-noise filter: -3 dB/octave, far more mid-range than brown noise
//         const k = [.99886, .99332, .969, .8665, .55, -.7616], m = [.0555179, .0750759, .153852, .3104856, .5329522, -.016898], s = [0, 0, 0, 0, 0, 0];
//         let tail = 0;
//         for (let i = 0; i < r.length; i++) {
//             const w = Math.random() * 2 - 1; let o = w * .5362 + tail;
//             for (let j = 0; j < 6; j++) { s[j] = k[j] * s[j] + w * m[j]; o += s[j]; }
//             r[i] = o; tail = w * .115926;
//         }
//     };
//     const drops = (r, sr) => {   // ~140 random raindrop ticks per second
//         for (let c = r.length / sr * 140; c > 0; c--) {
//             const at = Math.random() * r.length | 0, len = rnd(.002, .012) * sr | 0, amp = Math.random() ** 1.5 * .8 + .2;
//             for (let j = 0; j < len && at + j < r.length; j++) r[at + j] += amp * (Math.random() * 2 - 1) * Math.exp(-4 * j / len);
//         }
//     };

//     /* ---------- building blocks ---------- */
//     const layer = (buf, spec, gain) => {                              // looping noise -> filter chain -> gain -> master
//         const s = ctx.createBufferSource(), g = ctx.createGain();
//         const fs = spec.map(([type, hz, q = 1]) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; return f; });
//         s.buffer = buf; s.loop = true; g.gain.value = gain;
//         [s, ...fs, g, master].reduce((a, b) => (a.connect(b), b));
//         s.start(0, rnd(0, 3));
//         return { gain: g.gain, freq: fs[0].frequency };
//     };
//     const lfo = (hz, depth, param) => {                               // slow wobble added on top of a parameter
//         const o = ctx.createOscillator(), d = ctx.createGain();
//         o.frequency.value = hz; d.gain.value = depth; o.connect(d); d.connect(param); o.start();
//     };
//     const when = d => {                                               // delay in SECONDS -> audio-clock time
//         d = +d || 0;
//         if (d > 30) console.warn('[sound] delay is in SECONDS, got ' + d + ' – milliseconds by mistake?');
//         return ctx.currentTime + Math.max(0, d);
//     };

//     const build = () => {
//         ctx = new AC();
//         if (navigator.audioSession) navigator.audioSession.type = 'playback';   // iPhone: play even with the silent switch on
//         master = ctx.createGain(); master.gain.value = 0;
//         const pre = ctx.createGain(), sat = ctx.createWaveShaper(), curve = new Float32Array(2049);
//         for (let i = 0; i < 2049; i++) curve[i] = Math.tanh((i / 1024 - 1) * 2);   // y = tanh(x) over -2…2: transparent when quiet,
//         pre.gain.value = .5; sat.curve = curve; sat.oversample = '2x';             // soft ceiling so thunder + fireworks + waves can't hard-clip
//         master.connect(pre); pre.connect(sat); sat.connect(ctx.destination);

//         const sr = ctx.sampleRate, pop = ctx.createBuffer(1, sr * .03 | 0, sr), pd = pop.getChannelData(0);
//         for (let i = 0; i < pd.length; i++) pd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * .004));   // one tiny "tick"
//         B = { white: makeBuf(4, white), pink: makeBuf(6, pink), drops: makeBuf(6, drops), pop };

//         const wash = layer(B.pink, [['highpass', 500], ['lowpass', 9000]], .3);       // rain: steady wash on the leaves …
//         layer(B.drops, [['bandpass', 3500, .6]], .2);                                  // … plus individual drops
//         lfo(.12, .08, wash.gain);                                                      // slow swell so it never sounds looped
//         const wind = layer(B.pink, [['bandpass', 420, 1.1]], .4);                      // wind: band-passed noise …
//         lfo(.07, .2, wind.gain); lfo(.13, .12, wind.gain); lfo(.05, 180, wind.freq);   // … gusting, and drifting in pitch
//     };

//     /* ---------- one-shots ---------- */
//     const swell = (buf, type, [f0, f1, f2], peak, up, down) => {      // noise that builds for `up` s, then fades away over about `down` s
//         const t = ctx.currentTime + .05, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
//         s.buffer = buf; s.loop = true; f.type = type;
//         f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + up); f.frequency.exponentialRampToValueAtTime(f2, t + up + down);
//         g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + up); g.gain.setTargetAtTime(0, t + up, down / 3);
//         s.connect(f); f.connect(g); g.connect(master); s.start(t, rnd(0, 3)); s.stop(t + up + down * 1.5);
//     };
//     const wave = () => {                                              // one wave washing up the shore far below the overlook
//         if (!on) return;
//         const up = rnd(2.5, 4), down = rnd(3.5, 5.5);
//         swell(B.pink, 'lowpass', [250, 1400, 450], rnd(.32, .42), up, down);          // the surge
//         swell(B.white, 'highpass', [3500, 5000, 3000], rnd(.15, .2), up + .4, down - .4);   // the foam fizz
//     };
//     // Rolling rumble: pink noise through a sweeping low-pass, with swells and lulls ("rolls") in its volume
//     const rumble = (delay, dur, peak, f0, f1, rolls) => {
//         if (!on) return;
//         const t = when(delay), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
//         s.buffer = B.pink; s.loop = true; f.type = 'lowpass';
//         f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
//         g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(.12, dur * .06));
//         Array.from({ length: rolls }, () => rnd(.12, .85)).sort((a, b) => a - b)
//             .forEach((p, i) => g.gain.linearRampToValueAtTime(peak * (i % 2 ? .7 : .3) * (1 - .6 * p), t + dur * p));
//         g.gain.exponentialRampToValueAtTime(.0001, t + dur);
//         s.connect(f); f.connect(g); g.connect(master); s.start(t, rnd(0, 3)); s.stop(t + dur + .1);
//     };
//     // A scatter of tiny noise ticks: firework crackle, or the sharp crack of a close lightning strike
//     const crackle = (delay, n, span, loud, hz) => {
//         if (!on) return;
//         const t0 = when(delay);
//         for (let i = 0; i < n; i++) {
//             const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
//             s.buffer = B.pop; f.type = 'bandpass'; f.frequency.value = hz * rnd(.5, 1.8); f.Q.value = .8; g.gain.value = loud * rnd(.2, 1);
//             s.connect(f); f.connect(g); g.connect(master); s.start(t0 + span * Math.random() ** 1.6);   // denser at the start, thinning out
//         }
//     };
//     const boom = (d = 0) => { rumble(d, 1.8, .85, 900, 70, 2); crackle(+d + .15, 26, 2, .45, 3200); };
//     const thunder = (d = 0) => {
//         const near = d < 1.5;                                         // < ~500 m: the sharp crack arrives with the rumble
//         if (near) crackle(d, 14, .45, .4, 2000);
//         rumble(d, near ? 6 : 7.5, .8, near ? 1200 : 700, 55, 6);
//     };
//     window.__sound = { boom, thunder, wave, demo: () => { wave(); boom(1.5); thunder(4); } };

//     const every = (fn, a, b) => {                                     // call fn every a–b seconds until stopped
//         let id; const tick = () => { if (ctx.state === 'running') fn(); id = setTimeout(tick, rnd(a, b) * 1000); };
//         id = setTimeout(tick, 600); return () => clearTimeout(id);
//     };

//     /* ---------- the switch ---------- */
//     btn.addEventListener('click', async () => {
//         try {
//             if (!ctx) build();                                        // build FIRST: nothing below can leave the audio un-built
//             on = !on;
//             btn.setAttribute('aria-pressed', on);
//             (btn.lastElementChild || btn).textContent = on ? 'Sound on' : 'Sound off';
//             if (on) {
//                 await ctx.resume();
//                 if (!on) return;                                      // switched off again while resuming
//                 master.gain.setTargetAtTime(LEVEL, ctx.currentTime, .6);
//                 stops = [every(wave, 5, 10)];
//             } else {
//                 stops.forEach(stop => stop()); stops = [];
//                 master.gain.setTargetAtTime(0, ctx.currentTime, .25);
//                 setTimeout(() => { if (!on) ctx.suspend(); }, 1500);
//             }
//         } catch (err) { console.error('[sound]', err); }
//     });
//     document.addEventListener('visibilitychange', () => {             // silent while the tab is in the background
//         if (!ctx || !on) return;
//         document.hidden ? ctx.suspend() : ctx.resume();
//     });
// })();