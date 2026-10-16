/* Sedm smrků — ukázka (Vladislav Zachariev, Whyte Lynx).
   Hero: four photos of one identical shot (dawn, midday, sunset, night) + one depth map.
   A WebGL shader shifts each pixel by its depth (mouse / sway), crossfades the time of day
   on scroll (sky first, meadow last) and adds the living bits: valley mist, chimney smoke,
   flickering windows, twinkling stars and a shooting star. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;

  /* ---------- seven spruces (logo + loader) ---------- */
  const H = [.58, .8, .66, 1, .72, .88, .54];
  function spruce(cx, base, h, w) {
    const tiers = [[0, .46, .5], [.26, .72, .78], [.5, 1, 1]];
    return tiers.map(([t0, t1, k]) => {
      const y0 = base - h + t0 * h, y1 = base - h + t1 * h, hw = w * k / 2;
      return `<path d="M${cx} ${y0.toFixed(2)}L${(cx + hw).toFixed(2)} ${y1.toFixed(2)}H${(cx - hw).toFixed(2)}Z"/>`;
    }).join('');
  }
  function trees(svg, W, Hh) {
    const step = W / 7, g = svg.querySelector('g');
    g.innerHTML = H.map((k, i) => `<g>${spruce(step * (i + .5), Hh, Hh * k, step * .9)}</g>`).join('');
    return $$(':scope > g', g);
  }
  trees($('.brand__mark'), 70, 24);
  const loadTrees = trees($('.loader__trees'), 140, 40);
  loadTrees.forEach(t => t.querySelectorAll('path').forEach(p => p.style.transformOrigin = '50% 100%'));
  let grown = 0;
  const grow = setInterval(() => {
    if (grown < 7) { loadTrees[grown].querySelectorAll('path').forEach(p => p.classList.add('on')); grown++; }
  }, 110);
  const loadStart = performance.now();
  function loaded() {
    const wait = Math.max(0, 950 - (performance.now() - loadStart));
    setTimeout(() => {
      loadTrees.forEach(t => t.querySelectorAll('path').forEach(p => p.classList.add('on')));
      clearInterval(grow);
      setTimeout(() => $('#loader').classList.add('is-done'), 260);
      document.documentElement.classList.add('ready');
      showLine(0, true);
    }, wait);
  }

  /* ---------- smooth scroll ---------- */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });   // phone bars sliding in/out must not re-measure the page
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? 0 : $(id);
    if (el === null) return;
    e.preventDefault();
    lenis.scrollTo(el, { duration: 1.6 });
  }));

  /* ---------- split words ---------- */
  function splitWords(root) {
    const out = [];
    (function walk(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = p;
            frag.appendChild(s); out.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(root);
    return out;
  }

  /* ---------- hero copy, clock, ticks ---------- */
  const lines = $$('#lines .line');
  lines.forEach(l => splitWords($('.line__big', l)).forEach((w, i) => w.style.transitionDelay = (i * 0.07) + 's'));
  let lineNow = -1;
  function showLine(i, force) {
    if (i === lineNow && !force) return;
    lineNow = i;
    lines.forEach((l, k) => l.classList.toggle('is-on', k === i));
    $$('#ticks button').forEach((b, k) => b.classList.toggle('is-on', k === i));
  }
  const STOPS = [340, 750, 1190, 1390];               // 05:40, 12:30, 19:50, 23:10 (minutes)
  const LABELS = ['rozbřesk', 'poledne', 'západ slunce', 'noc'];
  const arc = $('#arcDone'), orb = $('#orb'), arcLen = 315;
  const sun = $('.clock__sun'), moon = $('.clock__moon'), bite = $('.clock__bite');
  const clockTime = $('#clockTime'), clockLabel = $('#clockLabel');
  function clockAt(u) {
    const i = clamp(Math.floor(u), 0, 2), f = clamp(u - i, 0, 1);
    const m = Math.round(lerp(STOPS[i], STOPS[i + 1], f));
    const hh = Math.floor(m / 60) % 24, mm = m % 60;
    clockTime.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    clockLabel.textContent = LABELS[clamp(Math.round(u), 0, 3)];
    const day = m <= 1260;                              // sun up 05:00–21:00, moon after
    const frac = day ? clamp((m - 300) / 960, 0, 1) : clamp((m - 1260) / 480, 0, 1);
    const pt = arc.getPointAtLength(frac * arc.getTotalLength());
    orb.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    arc.style.strokeDashoffset = (arcLen * (1 - frac)).toFixed(1);
    arc.style.stroke = day ? '' : '#c9d2e6';
    sun.style.opacity = day ? 1 : 0; moon.style.opacity = day ? 0 : 1; bite.style.opacity = day ? 0 : 1;
  }

  const hero = $('#hero');
  const heroRange = () => hero.offsetHeight - innerHeight;
  let heroP = 0, uP = 0;
  function heroProgress() {
    heroP = clamp((lenis.animatedScroll ?? scrollY) / heroRange(), 0, 1);
    const x = heroP * 3, i = Math.min(2, Math.floor(x)), f = x - i;
    const s = clamp((f - 0.18) / 0.64, 0, 1);
    uP = heroP >= 1 ? 3 : i + s * s * (3 - 2 * s);
    showLine(clamp(Math.floor(uP + 0.5), 0, 3));
    clockAt(uP);
    $$('#ticks button').forEach((b, k) => b.style.setProperty('--fill', (clamp(heroP * 4 - k, 0, 1) * 100).toFixed(1) + '%'));
    $('#nav').classList.toggle('is-solid', scrollY > heroRange() + innerHeight * 0.4);
    if (fallbackImgs) fallbackImgs.forEach((im, k) => im.style.opacity = k === 0 ? 1 : clamp(uP - (k - 1), 0, 1));
  }
  $$('#ticks button').forEach(b => b.addEventListener('click', () => {
    lenis.scrollTo(hero.offsetTop + heroRange() * (+b.dataset.i / 3) + 2, { duration: 2.2 });
  }));

  /* ---------- WebGL hero ---------- */
  let fallbackImgs = null;
  const VS = `attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
  const FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D uT0,uT1,uT2,uT3,uD;
uniform vec2 uRes,uM,uC;
uniform float uImgA,uP,uT,uS,uMo;
float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
/* lattice hash in exact integer maths: a corner shared by two cells must hash the same in both,
   or phones that fuse multiply-adds draw seams along the cell edges */
float pm(float x){return mod((x*34.+1.)*x,289.);}
float hv(vec2 i){i=mod(i,289.);return pm(pm(pm(i.x)+i.y))/289.;}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hv(i),hv(i+vec2(1.,0.)),f.x),mix(hv(i+vec2(0.,1.)),hv(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*nz(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
vec2 T(vec2 p){return vec2((p.x-uC.x)/uC.y,p.y);}  /* photo uv -> loaded texture (whole photo or the portrait crop) */
vec3 tx(float k,vec2 p){p=T(p);if(k<.5)return texture2D(uT0,p).rgb;if(k<1.5)return texture2D(uT1,p).rgb;if(k<2.5)return texture2D(uT2,p).rgb;return texture2D(uT3,p).rgb;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  float ra=uRes.x/uRes.y;
  vec2 s=ra>uImgA?vec2(1.,uImgA/ra):vec2(ra/uImgA,1.);
  s/=1.07+.07*uS;
  vec2 c0=vec2(clamp(.62,uC.x+s.x*.5,uC.x+uC.y-s.x*.5),clamp(.5,s.y*.5,1.-s.y*.5));
  vec2 uv=(vUv-.5)*s+c0;
  vec2 dir=uM*vec2(.03,.017);
  float d=texture2D(uD,uv).r;
  vec2 p=uv+dir*(d-.42);
  d=texture2D(uD,p).r; p=uv+dir*(d-.42);
  d=texture2D(uD,p).r; p=clamp(p,vec2(uC.x+.001,.001),vec2(uC.x+uC.y-.001,.999));

  float k=min(2.,floor(uP)),f=uP-k;
  float n=nz(p*vec2(9.,5.));
  float fl=smoothstep(0.,1.,f*1.6-d*.5-.08+n*.16);
  vec3 c=f<.001?tx(k,p):mix(tx(k,p),tx(k+1.,p),fl);

  float w0=clamp(1.-abs(uP),0.,1.),w1=clamp(1.-abs(uP-1.),0.,1.),w2=clamp(1.-abs(uP-2.),0.,1.),w3=clamp(1.-abs(uP-3.),0.,1.);
  float t=uT*uMo;

  /* valley mist: dawn, a little at sunset */
  float valley=smoothstep(.04,.14,d)*(1.-smoothstep(.28,.46,d))*smoothstep(.46,.56,p.y)*(1.-smoothstep(.66,.74,p.y));
  float m1=fbm(vec2(p.x*3.6-t*.016,p.y*15.));
  float m2=fbm(vec2(p.x*8.-t*.028,p.y*26.+3.));
  float mist=valley*smoothstep(.45,.78,m1*.68+m2*.32);
  c=mix(c,mix(vec3(.96,.9,.93),vec3(1.,.8,.62),w2),mist*(w0*.6+w2*.3)*uMo);

  /* chimney smoke, follows the cabin's parallax */
  vec2 ch=vec2(.6915,.603);
  float cd=texture2D(uD,ch-vec2(0.,.04)).r;
  vec2 q=(uv+dir*(cd-.42)-ch)*vec2(uImgA,1.);
  if(q.y>0.&&q.y<.34&&uP>1.2){
    float cx=-q.y*.12+sin(q.y*13.-t*.9)*.05*q.y;
    float wd=.005+q.y*.17;
    float den=exp(-pow((q.x-cx)/wd,2.))*smoothstep(0.,.012,q.y)*(1.-smoothstep(.1,.34,q.y));
    den*=smoothstep(.42,.86,fbm(vec2(q.x*16.,q.y*7.-t*.3)))*smoothstep(.2,.7,fbm(vec2(q.x*5.+3.,q.y*3.-t*.12)));
    vec3 sc=mix(mix(vec3(.82,.82,.86),vec3(.95,.76,.62),w2),vec3(.38,.4,.5),w3);
    c=mix(c,sc,den*(w2*.3+w3*.4)*uMo);
  }

  /* windows: fire flicker in the warm glass (sunset + night) */
  float box=step(.552,p.x)*step(p.x,.725)*step(.31,p.y)*step(p.y,.56);
  float warm=smoothstep(.12,.32,c.r-c.b)*smoothstep(.32,.7,lum(c));
  float flick=.06*sin(t*7.3)+.08*(nz(vec2(t*4.1,1.))-.5)+.05*(nz(vec2(t*11.,4.))-.5);
  c*=1.+box*warm*(w2*.5+w3)*flick*uMo*2.;

  /* stars: twinkle the photo's own stars + one shooting star */
  float sky=1.-smoothstep(.03,.09,d);
  if(w3>.01){
    vec3 nc=tx(3.,p);
    vec2 o=vec2(1.8/2752.,1.8/1536.);
    float mean=(lum(tx(3.,p+vec2(o.x,0.)))+lum(tx(3.,p-vec2(o.x,0.)))+lum(tx(3.,p+vec2(0.,o.y)))+lum(tx(3.,p-vec2(0.,o.y))))*.25;
    float star=smoothstep(.04,.2,lum(nc)-mean);
    float ph=h21(floor(p*vec2(1200.,670.)));
    float tw=.5+.5*sin(t*(2.+ph*3.)+ph*40.);
    c+=vec3(.95,.97,1.)*star*(tw-.4)*1.4*w3*sky*uMo;
    float per=6.5,kk=floor(uT/per),ft=fract(uT/per);
    if(ft<.18){
      vec2 sq=vec2(p.x*uImgA,p.y);
      vec2 st=vec2((.12+.62*h21(vec2(kk,1.)))*uImgA,.8+.14*h21(vec2(kk,2.)));
      vec2 sd=normalize(vec2(1.,-.36));
      vec2 hd=st+sd*(ft/.18)*.3;
      vec2 a=hd-sd*.09,pa=sq-a,ba=hd-a;
      float hh=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
      float dl=length(pa-ba*hh);
      float life=smoothstep(0.,.03,ft)*(1.-smoothstep(.12,.18,ft));
      c+=vec3(.92,.96,1.)*smoothstep(.0028,0.,dl)*hh*hh*life*w3*sky*uMo*1.4;
    }
  }

  /* film: grain + vignette */
  c+=(h21(vUv*uRes+fract(uT*7.)*91.)-.5)*.032;
  c*=mix(.78,1.,smoothstep(1.2,.38,length((vUv-.5)*vec2(1.1,1.))));
  gl_FragColor=vec4(c,1.);
}`;

  const cv = $('#gl');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  /* a portrait screen only ever sees the middle of the photo, so it gets that strip at full
     resolution (x 1060–2353 of the 2752 px photo) instead of a downscaled whole frame */
  const CROP = [1060 / 2752, 1293 / 2752];
  const wantCrop = () => innerWidth / innerHeight < .8;
  const SET = c => ['img/rano', 'img/poledne', 'img/vecer', 'img/noc'].map(s => s + (c ? '-p' : '') + '.webp');
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

  if (!gl) {
    document.documentElement.classList.add('no-gl');
    fallbackImgs = $$('#fallback img');
    fallbackImgs.forEach((im, k) => { im.src = SET(false)[k]; im.style.objectPosition = '64% 50%'; });
    loadImg(SET(false)[0]).then(loaded, loaded);
  } else {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const u = { res: U('uRes'), m: U('uM'), c: U('uC'), a: U('uImgA'), p: U('uP'), t: U('uT'), s: U('uS'), mo: U('uMo') };
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const texs = [0, 1, 2, 3, 4].map(k => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([27, 29, 34, 255]));
      ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T'].forEach(w => gl.texParameteri(gl.TEXTURE_2D, gl[w], gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    });
    ['uT0', 'uT1', 'uT2', 'uT3', 'uD'].forEach((n, k) => gl.uniform1i(U(n), k));
    const upload = (k, img) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, texs[k]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); };
    const imgA = 2752 / 1536;
    let ready = false, crop = wantCrop(), gen = 0, swapping = false;
    const SRC = SET(crop);
    Promise.all([loadImg(SRC[0]), loadImg('img/hloubka.png')]).then(([a, d]) => {
      [0, 1, 2, 3].forEach(k => upload(k, a));        // until the rest arrive, every hour is dawn
      upload(4, d);
      ready = true; loaded();
      SRC.slice(1).forEach((s, i) => loadImg(s).then(im => { if (gen === 0) upload(i + 1, im); }));
    }).catch(loaded);
    function swapSet() {                               // phone turned: load the other set, switch all four at once
      if (swapping || !ready || wantCrop() === crop) return;
      swapping = true; const c = wantCrop();
      Promise.all(SET(c).map(loadImg)).then(ims => { gen++; ims.forEach((im, k) => upload(k, im)); crop = c; })
        .catch(() => {}).then(() => { swapping = false; swapSet(); });
    }
    addEventListener('resize', swapSet);

    let W = 0, Hh = 0, dprCap = small ? 2 : 1.75, slow = 0, lastNow = 0;
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, dprCap);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w === W && h === Hh) return;                 // toolbar show/hide: keep the canvas, no blank frame
      W = w; Hh = h; cv.width = W; cv.height = Hh; gl.viewport(0, 0, W, Hh);
    }
    size(); addEventListener('resize', size);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9 };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = -((e.clientY / innerHeight) * 2 - 1);
      mouse.last = performance.now();
    }, { passive: true });
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      mouse.tx = clamp(e.gamma / 25, -1, 1); mouse.ty = clamp((e.beta - 45) / 30, -1, 1);
      mouse.last = performance.now();
    }, { passive: true });

    let visible = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);
    const t0 = performance.now();
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !ready) { lastNow = 0; return; }
      if (lastNow) {                                     // a phone that can't keep up gets fewer pixels, not a stutter
        slow = now - lastNow > 30 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 45 && dprCap > 1.25) { dprCap -= .5; slow = 0; size(); }
      }
      lastNow = now;
      const t = (now - t0) / 1000;
      if (now - mouse.last > 2500 || reduced) {          // idle: slow sway like a breath
        mouse.tx = reduced ? 0 : Math.sin(t * .23) * .55; mouse.ty = reduced ? 0 : Math.sin(t * .17 + 1) * .3;
      }
      mouse.x = lerp(mouse.x, mouse.tx, .05); mouse.y = lerp(mouse.y, mouse.ty, .05);
      gl.uniform2f(u.res, W, Hh); gl.uniform2f(u.m, mouse.x, mouse.y);
      gl.uniform2f(u.c, crop ? CROP[0] : 0, crop ? CROP[1] : 1);
      gl.uniform1f(u.a, imgA); gl.uniform1f(u.p, uP); gl.uniform1f(u.t, t);
      gl.uniform1f(u.s, heroP); gl.uniform1f(u.mo, reduced ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    })(t0);
  }
  lenis.on('scroll', heroProgress);
  addEventListener('resize', heroProgress);
  heroProgress();

  /* ---------- about: words light up while reading ---------- */
  const words = splitWords($('#aboutText'));
  ScrollTrigger.create({
    trigger: '#aboutText', start: 'top 82%', end: 'bottom 48%', scrub: true,
    onUpdate: st => { const n = Math.round(st.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < n)); }
  });
  gsap.from('.facts li', { y: 40, opacity: 0, stagger: .1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.facts', start: 'top 88%' } });

  /* ---------- lamp: light the room where you point ---------- */
  const fr = $('#lampFrame'), sw = $('#lampSwitch');
  const L = { x: .62, y: .52, tx: .62, ty: .52, r: 0, last: -1e9, on: false, seen: false, vis: false };
  fr.addEventListener('pointermove', e => {
    const b = fr.getBoundingClientRect();
    L.tx = (e.clientX - b.left) / b.width; L.ty = (e.clientY - b.top) / b.height; L.last = performance.now();
  });
  function toggleLamp() {
    L.on = !L.on; sw.setAttribute('aria-pressed', L.on); sw.lastChild.textContent = L.on ? 'Zhasnout' : 'Rozsvítit';
    $('.lamp__copy').style.opacity = L.on ? .0 : 1;
  }
  fr.addEventListener('click', e => { if (!e.target.closest('.lamp__switch')) toggleLamp(); });
  sw.addEventListener('click', toggleLamp);
  new IntersectionObserver(([en]) => { L.vis = en.isIntersecting; if (L.vis) L.seen = true; }, { threshold: .25 }).observe(fr);
  (function lampFrame(now) {
    requestAnimationFrame(lampFrame);
    if (!L.vis) return;
    const t = now / 1000, b = fr.getBoundingClientRect();
    if (now - L.last > 2200) { L.tx = .58 + .24 * Math.sin(t * .42); L.ty = .5 + .16 * Math.sin(t * .31 + 1.3); }
    L.x = lerp(L.x, L.tx, .09); L.y = lerp(L.y, L.ty, .09);
    const base = Math.min(b.width, b.height) * (small ? .42 : .34);
    const target = L.on ? Math.hypot(b.width, b.height) * 1.1 : (L.seen ? base : 0);
    L.r = lerp(L.r, target, L.on ? .045 : .07);
    const flick = reduced ? 1 : 1 + .025 * Math.sin(t * 9.1) + .018 * Math.sin(t * 23.7);
    fr.style.setProperty('--x', (L.x * 100).toFixed(2) + '%');
    fr.style.setProperty('--y', (L.y * 100).toFixed(2) + '%');
    fr.style.setProperty('--r', (L.r * flick).toFixed(1) + 'px');
  })(0);

  /* ---------- rooms: sideways on desktop ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1025px)', () => {
    const track = $('#roomsTrack'), pin = $('.rooms__pin'), head = $('.rooms__head');
    const dist = () => Math.max(0, track.scrollWidth - (pin.clientWidth - head.offsetWidth));
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist() * 1.15, pin: true, scrub: .7, invalidateOnRefresh: true,
        onUpdate: st => { $('#roomNow').textContent = '0' + (1 + clamp(Math.round(st.progress * 2), 0, 2)); }
      }
    });
    $$('.room__img img', track).forEach(img => gsap.fromTo(img, { scale: 1.28, xPercent: -6 }, {
      scale: 1.04, xPercent: 0, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true }
    }));
  });
  mm.add('(max-width: 1024px)', () => {
    $$('.room').forEach(r => gsap.from(r, { y: 60, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: r, start: 'top 85%' } }));
  });

  /* ---------- seasons ---------- */
  $$('.season').forEach((s, i) => gsap.from($('h3', s), { xPercent: i % 2 ? 8 : -8, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%' } }));
  gsap.from('.book__intro > *', { y: 36, opacity: 0, stagger: .08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.book', start: 'top 70%' } });
  gsap.from('.cal', { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.book', start: 'top 65%' } });
  gsap.fromTo('.foot__word', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  ScrollTrigger.create({ trigger: '#rezervace', start: 'top 64px', end: 'bottom 64px', toggleClass: { targets: '#nav', className: 'on-light' } });

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 4200);
  }

  /* ---------- calendar ---------- */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const DOW = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
  const monthFmt = new Intl.DateTimeFormat('cs', { month: 'long', year: 'numeric' });
  const key = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const hash = n => { let x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const busy = new Set();
  for (let i = 3; i < 400; i++) {                       // pretend bookings: 2–5 night blocks
    const d = new Date(today); d.setDate(d.getDate() + i);
    if (hash(key(d)) < .11) {
      const len = 2 + Math.floor(hash(key(d) + 7) * 4);
      for (let k = 0; k < len; k++) { const e = new Date(d); e.setDate(e.getDate() + k); busy.add(key(e)); }
      i += len + 2;
    }
  }
  const sel = { a: null, b: null };
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmtDay = d => `${DOW[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`;
  const nightsWord = n => n === 1 ? 'noc' : n < 5 ? 'noci' : 'nocí';
  function rangeFree(a, b) { const d = new Date(a); d.setDate(d.getDate() + 1); for (; d < b; d.setDate(d.getDate() + 1)) if (busy.has(key(d))) return false; return true; }
  function renderCal() {
    $('#calMonth').textContent = monthFmt.format(view);
    $('#calPrev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    const g = $('#calGrid'); g.innerHTML = '';
    const first = (view.getDay() + 6) % 7, days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) g.appendChild(document.createElement('span'));
    for (let n = 1; n <= days; n++) {
      const d = new Date(view.getFullYear(), view.getMonth(), n);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'd'; b.textContent = n;
      b.setAttribute('aria-label', fmtDay(d));
      const k = key(d), isBusy = busy.has(k);
      if (d < today) b.disabled = true;
      if (isBusy) { b.classList.add('busy'); b.disabled = true; }
      if (k === key(today)) b.classList.add('today');
      if (sel.a && k === key(sel.a)) { b.classList.add('start'); if (sel.b) b.classList.add('has-end'); }
      if (sel.b && k === key(sel.b)) b.classList.add('end');
      if (sel.a && sel.b && d > sel.a && d < sel.b) b.classList.add('in');
      b.addEventListener('click', () => pick(d));
      g.appendChild(b);
    }
    $('#sumIn').textContent = sel.a ? fmtDay(sel.a) : '—';
    $('#sumOut').textContent = sel.b ? fmtDay(sel.b) : '—';
    const n = sel.a && sel.b ? Math.round((sel.b - sel.a) / 864e5) : 0;
    $('#sumN').textContent = n ? `${n} ${nightsWord(n)}` : '—';
  }
  function pick(d) {
    if (!sel.a || sel.b || d <= sel.a) { sel.a = d; sel.b = null; }
    else if (!rangeFree(sel.a, d)) { toast('Mezi těmi dny je chata obsazená. Zkuste jiný termín.'); sel.a = d; sel.b = null; }
    else if ((d - sel.a) / 864e5 < 2) { toast('Chatu pronajímáme nejméně na dvě noci.'); return; }
    else sel.b = d;
    renderCal();
  }
  $('#calPrev').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  $('#calNext').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
  let guests = 2;
  const gOut = $('#gOut');
  $('#gMinus').addEventListener('click', () => { guests = Math.max(1, guests - 1); gOut.textContent = guests; });
  $('#gPlus').addEventListener('click', () => { if (guests >= 4) toast('Chata má čtyři lůžka.'); guests = Math.min(4, guests + 1); gOut.textContent = guests; });
  $('#cal').addEventListener('submit', e => {
    e.preventDefault();
    if (!sel.a || !sel.b) { toast('Vyberte v kalendáři příjezd i odjezd.'); return; }
    if (!/^\S+@\S+\.\S+$/.test($('#mail').value.trim())) { toast('Doplňte e-mail, ať se Vám máme kam ozvat.'); $('#mail').focus(); return; }
    toast('Děkujeme. Tohle je jen ukázka, poptávka se nikam neodeslala.');
  });
  renderCal();

  addEventListener('load', () => ScrollTrigger.refresh());
  window.__state = () => ({ uP: +uP.toFixed(3), heroP: +heroP.toFixed(3), gl: !!gl, line: lineNow, scroll: Math.round(scrollY) });
  window.__go = y => lenis.scrollTo(y, { immediate: true, force: true });
})();
