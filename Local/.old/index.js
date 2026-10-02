/* ============================================================
   1. RAIN, SNOW AND FIREWORKS  (canvas 2D layer, #fx)
   ============================================================ */
(() => {
    const cv = document.getElementById('fx'), ctx = cv.getContext('2d');
    const AR = 1586 / 992;                       // wallpaper aspect ratio
    const rnd = (a, b) => a + Math.random() * (b - a);
    const drops = [], rockets = [], sparks = [], flakes = [];
    let W, H, dpr = 1, iw, ih, ox, oy, k, wind = 0, mx = .5, my = .5, next = 0, last = 0;
    let lx = 0, ly = 0, pz = 1, px = 0, py = 0;                    // smoothed cursor lean + camera (zoom, pan as fractions of the screen)
    let strike = -1e9, nextStrike = 11000, bolt = null, bu = .5;   // lightning

    // Camera: the wallpaper slowly pans and zooms (see frame). Fireworks and lightning live in
    // "world" space (the un-zoomed wallpaper), so they ride along instead of sliding off the skyline.
    const toWorld = (x, y) => [W / 2 + (x - W / 2) / pz + px * W, H / 2 + (y - H / 2) / pz + py * H];

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
        const t = now / 1000, age = window.__camOn ? (now - window.__camOn) / 1000 : -1, ease = age < 0 ? 0 : 1 - Math.exp(-age / 2.5);
        lx += ((mx - .5) * 2 - lx) * .03; ly += ((my - .5) * 2 - ly) * .03;
        pz = 1 + ease * (.08 + Math.sin(t * .09) * .01);
        const lim = (1 - 1 / pz) / 2 * .9, clamp = v => Math.max(-lim, Math.min(lim, v));   // never pan past the image edge
        px = clamp(ease * (Math.sin(t * .21) * .011 + Math.sin(t * .13 + 2) * .007 + lx * .008));
        py = clamp(ease * (Math.sin(t * .17 + 1) * .008 + Math.sin(t * .11 + 4) * .005 + ly * .005));
        window.__cam = [px, py, pz];

        // lightning: rare and soft - at most two pulses, never a strobe
        if (age >= 0 && now > nextStrike) {
            const [bx, by] = P(rnd(.25, .9), rnd(.04, .14));
            strike = now; nextStrike = now + rnd(22000, 55000); bu = (bx - ox) / iw;
            bolt = Math.random() < .6 ? zig(bx, by, bx + rnd(-.05, .05) * iw, P(0, rnd(.43, .5))[1], 60 * k) : null;   // otherwise: sheet lightning behind the clouds
            if (bolt) { const [qx, qy] = bolt[9]; bolt.br = zig(qx, qy, qx + rnd(-.06, .06) * iw, qy + rnd(60, 140) * k, 24 * k); }
            window.__sound?.thunder(rnd(1.2, 3.8));
        }
        const pulse = a => a < 0 ? 0 : a < .04 ? a / .04 : Math.exp(-(a - .04) * 7), a0 = (now - strike) / 1000;
        const fl = Math.min(1, pulse(a0) + .55 * pulse(a0 - .24));
        window.__flash = [fl * .85, bu];

        ctx.setTransform(dpr * pz, 0, 0, dpr * pz, dpr * (W / 2 - pz * (W / 2 + px * W)), dpr * (H / 2 - pz * (H / 2 + py * H)));   // world space
        ctx.globalCompositeOperation = 'lighter';
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

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // rain and snow stay in screen space
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
        if (e.target.closest && e.target.closest('#home')) burst(...toWorld(e.clientX, e.clientY), 2.2);
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
uniform sampler2D T; uniform vec2 R; uniform vec3 C, F; uniform float A, t, w;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x), mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x), f.y);
}
float el(vec2 uv, vec2 c, vec2 r){ return 1.-smoothstep(1.,1.5,length((uv-c)/r)); }  // 1 inside an ellipse
void main(){
  vec2 p=vec2(gl_FragCoord.x, R.y-gl_FragCoord.y);
  p=(p-R*.5)/C.z+R*.5+C.xy*R;                             // camera: zoom about the centre, then pan
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
  float sk=1.-smoothstep(.4,.52,uv.y), l=dot(c.rgb,vec3(.3,.59,.11)), dx=(uv.x-F.y)*2.2;   // lightning lights the clouds most
  c.rgb+=F.x*(.45+.55*exp(-dx*dx))*vec3(.5,.62,.95)*(sk*(.12+.9*smoothstep(.03,.3,l))+.05);
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
        const uR = U('R'), ut = U('t'), uw = U('w'), uC = U('C'), uF = U('F');
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
            const c = window.__cam || [0, 0, 1], f = window.__flash || [0, .5];
            gl.uniform3f(uC, c[0], c[1], c[2]);
            gl.uniform3f(uF, f[0], f[1], 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        addEventListener('resize', size);
        window.__ar = img.naturalWidth / img.naturalHeight;   // lets index.js line the fireworks up exactly
        size(); draw(0);
        dispatchEvent(new Event('resize'));
        cv.classList.add('ready');
        window.__camOn = performance.now();   // tells index.js the camera can start
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
