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