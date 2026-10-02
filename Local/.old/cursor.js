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
