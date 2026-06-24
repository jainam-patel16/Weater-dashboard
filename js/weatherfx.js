// weatherfx.js - lightweight canvas animations that react to the current weather code
// Categories: clear, clouds, rain, thunderstorm, snow, fog

const WeatherFX = (() => {
  let canvas, ctx, w, h;
  let particles = [];
  let mode = 'clear';
  let rafId = null;
  let lightningTimer = 0;
  let flashAlpha = 0;
  let bolts = [];
  let milkyWay = null;
  let mwTwinkle = [];

  function init(){
    canvas = document.getElementById('weatherFx');
    ctx = canvas.getContext('2d');
    resize();
    document.body.classList.add('weather-clear');
    window.addEventListener('resize', resize);
    loop();
  }

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function codeToMode(code, isDay){
    if (code == null) return 'clear';
    if ([95,96,99].includes(code)) return 'thunder';
    if ([71,73,75,77,85,86].includes(code)) return 'snow';
    if ([45,48].includes(code)) return 'fog';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if ([2,3].includes(code)) return 'clouds';
    if ([0,1].includes(code)) return isDay ? 'sun' : 'stars';
    return 'clear';
  }

  function applyBodyClass(newMode){
    const body = document.body;
    [...body.classList].forEach(c => { if (c.startsWith('weather-')) body.classList.remove(c); });
    body.classList.add('weather-' + newMode);
  }

  function setWeather(code, isDay){
    const newMode = codeToMode(code, isDay);
    applyBodyClass(newMode);
    if (newMode === mode) return;
    mode = newMode;
    seedParticles();
  }

  // Live, place-aware Milky Way band data computed in astronomy.js
  // (getMilkyWayData) - we just turn it into a soft scrolling glow band
  // across the night sky when conditions actually allow seeing it.
  function setMilkyWay(data){
    milkyWay = data;
    if (data && data.visible && mwTwinkle.length === 0){
      for (let i = 0; i < 140; i++){
        mwTwinkle.push({ t: Math.random(), drift: Math.random()*Math.PI*2, tw: Math.random()*Math.PI*2 });
      }
    }
  }

  function generateLobes(){
    // randomized puff layout per cloud instance so clouds aren't all identical
    const n = 5 + Math.floor(Math.random()*3);
    const lobes = [{ x: 0, y: 0, r: 26 + Math.random()*8 }];
    for (let i = 1; i < n; i++){
      const ang = Math.random()*Math.PI*2;
      const dist = 14 + Math.random()*32;
      lobes.push({
        x: Math.cos(ang)*dist*1.3,
        y: Math.sin(ang)*dist*0.55 - 4,
        r: 11 + Math.random()*17
      });
    }
    return lobes;
  }

  function seedParticles(){
    particles = [];
    bolts = [];
    const count = {
      rain: 220, snow: 140, thunder: 220, clouds: 6, sun: 18, stars: 90, fog: 5, clear: 0
    }[mode] || 0;

    for (let i = 0; i < count; i++){
      if (mode === 'rain' || mode === 'thunder'){
        particles.push({
          x: Math.random()*w, y: Math.random()*h,
          len: 10 + Math.random()*14,
          speed: 7 + Math.random()*8,
          drift: 1.5 + Math.random()
        });
      } else if (mode === 'snow'){
        particles.push({
          x: Math.random()*w, y: Math.random()*h,
          r: 1.5 + Math.random()*2.8,
          speed: 0.6 + Math.random()*1.6,
          drift: Math.random()*1 - 0.5,
          sway: Math.random()*Math.PI*2
        });
      } else if (mode === 'clouds'){
        const layer = i % 3; // 0 = far/small/slow, 2 = near/big/fast
        particles.push({
          x: Math.random()*w, y: 30 + Math.random()*(h*0.4) + layer*18,
          scale: (0.5 + layer*0.45) + Math.random()*0.5,
          speed: (0.07 + layer*0.12) + Math.random()*0.12,
          puff: 0.85 + Math.random()*0.3,
          layer,
          lobes: generateLobes()
        });
      } else if (mode === 'sun'){
        particles.push({ angle: (i / count) * Math.PI * 2, lenJitter: Math.random()*0.5 + 0.75 });
      } else if (mode === 'stars'){
        particles.push({
          x: Math.random()*w, y: Math.random()*h*0.6,
          r: Math.random()*1.6,
          tw: Math.random()*Math.PI*2
        });
      } else if (mode === 'fog'){
        particles.push({
          x: Math.random()*w, y: h*0.5 + (Math.random()-0.5)*h*0.5,
          speed: 0.1 + Math.random()*0.2, offset: Math.random()*1000
        });
      }
    }
  }

  function draw(){
    ctx.clearRect(0, 0, w, h);

    if (mode === 'rain' || mode === 'thunder'){
      ctx.strokeStyle = 'rgba(150,190,255,0.45)';
      ctx.lineWidth = 1.4;
      particles.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.drift, p.y + p.len);
        ctx.stroke();
        p.y += p.speed; p.x += p.drift*0.3;
        if (p.y > h){ p.y = -p.len; p.x = Math.random()*w; }
      });
      if (mode === 'thunder'){
        lightningTimer -= 1;
        if (lightningTimer <= 0 && Math.random() < 0.012){
          flashAlpha = 0.45;
          lightningTimer = 70 + Math.random()*190;
          bolts.push(makeBolt());
        }
        // draw jagged lightning bolts (with branches) before the ambient flash
        bolts.forEach(b => { drawBolt(b); b.life -= 0.09; });
        bolts = bolts.filter(b => b.life > 0);

        if (flashAlpha > 0){
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
          ctx.fillRect(0,0,w,h);
          flashAlpha -= 0.045;
        }
      }
    } else if (mode === 'snow'){
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      particles.forEach(p => {
        p.sway += 0.02;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(p.sway)*1.2, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
        p.y += p.speed;
        if (p.y > h){ p.y = -p.r; p.x = Math.random()*w; }
      });
    } else if (mode === 'clouds'){
      // draw far layer first so near/bigger clouds overlap them (parallax depth)
      [0,1,2].forEach(layerIdx => {
        particles.filter(p => p.layer === layerIdx).forEach(p => {
          drawCloud(p.x, p.y, p.scale, p.puff, p.layer, p.lobes);
          p.x += p.speed;
          if (p.x > w + 220*p.scale) p.x = -220*p.scale;
        });
      });
    } else if (mode === 'sun'){
      const cx = w - 120, cy = 120;
      const t = performance.now() / 1000;
      const pulse = 1 + Math.sin(t*0.6)*0.05;
      ctx.save();
      ctx.translate(cx, cy);

      // wide atmospheric corona - multi-stop soft falloff
      let halo = ctx.createRadialGradient(0,0,0, 0,0,230*pulse);
      halo.addColorStop(0, 'rgba(255,246,222,0.26)');
      halo.addColorStop(0.22, 'rgba(255,224,150,0.14)');
      halo.addColorStop(0.55, 'rgba(255,200,110,0.06)');
      halo.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0,0,230*pulse,0,Math.PI*2); ctx.fill();

      // broad crossed lens-flare beams (camera-style horizontal/vertical streaks)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      [0, Math.PI/2].forEach(rot => {
        ctx.save();
        ctx.rotate(rot + t*0.015);
        const beam = ctx.createLinearGradient(-280, 0, 280, 0);
        beam.addColorStop(0, 'rgba(255,230,165,0)');
        beam.addColorStop(0.5, 'rgba(255,230,165,0.12)');
        beam.addColorStop(1, 'rgba(255,230,165,0)');
        ctx.fillStyle = beam;
        ctx.fillRect(-280, -2.5, 560, 5);
        ctx.restore();
      });
      ctx.restore();

      // rotating flicker rays, varying length/brightness for a believable shimmer
      ctx.save();
      ctx.rotate(t*0.05);
      ctx.lineCap = 'round';
      particles.forEach(p => {
        const baseLen = 34 * p.lenJitter;
        const flicker = 0.7 + Math.sin(t*2 + p.angle*5)*0.3;
        const x1 = Math.cos(p.angle)*46, y1 = Math.sin(p.angle)*46;
        const x2 = Math.cos(p.angle)*(46+baseLen*flicker), y2 = Math.sin(p.angle)*(46+baseLen*flicker);
        ctx.strokeStyle = `rgba(255,225,140,${0.22*flicker})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      ctx.restore();

      // secondary lens-flare artifacts trailing away from the sun (classic optical ghosting)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dirX = -0.72, dirY = 0.42;
      [[0.35,9,0.13],[0.65,5,0.10],[0.95,13,0.07],[1.4,6,0.06]].forEach(([dist,r,alpha]) => {
        const fx = dirX*dist*95, fy = dirY*dist*95;
        const g = ctx.createRadialGradient(fx,fy,0, fx,fy,r*pulse);
        g.addColorStop(0, `rgba(255,235,180,${alpha})`);
        g.addColorStop(1, 'rgba(255,235,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fx,fy,r*pulse,0,Math.PI*2); ctx.fill();
      });
      ctx.restore();

      // core disc with bright-to-warm gradient
      let core = ctx.createRadialGradient(-10,-10,2, 0,0,44*pulse);
      core.addColorStop(0, 'rgba(255,253,240,1)');
      core.addColorStop(0.5, 'rgba(255,224,140,0.92)');
      core.addColorStop(1, 'rgba(255,178,70,0.6)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0,0,44*pulse,0,Math.PI*2); ctx.fill();

      // crisp bright rim for a defined edge
      ctx.strokeStyle = 'rgba(255,250,225,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,0,44*pulse,0,Math.PI*2); ctx.stroke();

      ctx.restore();
    } else if (mode === 'stars'){
      if (milkyWay && milkyWay.visible) drawMilkyWayBand(milkyWay);
      particles.forEach(p => {
        p.tw += 0.03;
        const a = 0.4 + Math.sin(p.tw)*0.4;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0,a)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      });
    } else if (mode === 'fog'){
      particles.forEach((p,i) => {
        p.offset += p.speed;
        const grad = ctx.createLinearGradient(0, p.y-30, 0, p.y+30);
        grad.addColorStop(0, 'rgba(200,200,210,0)');
        grad.addColorStop(0.5, 'rgba(200,200,210,0.10)');
        grad.addColorStop(1, 'rgba(200,200,210,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, p.y-30, w, 60);
      });
    }

    rafId = requestAnimationFrame(draw);
  }

  function drawCloud(x, y, scale, puff, layer, lobes){
    puff = puff || 1;
    lobes = lobes || [{ x:0, y:0, r:28 }];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // distance fades far-layer clouds slightly and softens contrast
    const depthFade = layer === 0 ? 0.55 : layer === 1 ? 0.8 : 1;
    const bodyAlpha = 0.5 * depthFade * puff;

    // soft drop shadow underneath for grounding/volume
    ctx.save();
    ctx.translate(2, 16);
    ctx.beginPath();
    lobes.forEach(l => ctx.arc(l.x, l.y, l.r*0.92, 0, Math.PI*2));
    ctx.fillStyle = `rgba(10,16,30,${0.16*depthFade*puff})`;
    ctx.fill();
    ctx.restore();

    // solid base silhouette - one cohesive shape rather than competing per-lobe blobs
    ctx.beginPath();
    lobes.forEach(l => ctx.arc(l.x, l.y, l.r, 0, Math.PI*2));
    ctx.fillStyle = `rgba(232,238,248,${bodyAlpha})`;
    ctx.fill();

    // clip a single vertical light-to-shadow gradient to the silhouette for unified 3D shading
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const shade = ctx.createLinearGradient(0, -50, 0, 36);
    shade.addColorStop(0, `rgba(255,255,255,${0.55*depthFade})`);
    shade.addColorStop(0.45, `rgba(225,232,244,${0.12*depthFade})`);
    shade.addColorStop(1, `rgba(130,148,180,${0.38*depthFade})`);
    ctx.fillStyle = shade;
    ctx.fillRect(-130, -90, 260, 180);
    ctx.restore();

    // soft puffy highlight glow on the sunlit side
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hl = ctx.createRadialGradient(-12,-20,2, -12,-20,36);
    hl.addColorStop(0, `rgba(255,255,255,${0.20*depthFade*puff})`);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.arc(-12,-20,36,0,Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // --- Milky Way: faint scrolling band, positioned/oriented from live
  // galactic-plane alt/az data (astronomy.js) so it sits where it would
  // actually be in the sky for this place and time. ---
  function drawMilkyWayBand(mw){
    const pts = mw.points
      .filter(p => p.altitude > -8)
      .map(p => ({
        x: (p.azimuth / 360) * w,
        y: h*0.58 - (Math.max(p.altitude, -8)/90) * h*0.52,
        alt: p.altitude
      }))
      .sort((a,b) => a.x - b.x);

    if (pts.length < 2) return;

    // strength fades in as the core climbs higher / sky gets properly dark
    const strength = Math.max(0.15, Math.min(1, mw.maxAltitude / 45));
    const t = performance.now() / 1000;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // soft wide glow band along the path
    for (let pass = 0; pass < 2; pass++){
      const width = pass === 0 ? 70 : 30;
      const alpha = (pass === 0 ? 0.05 : 0.09) * strength;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(180,195,235,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++){
        const mx = (pts[i-1].x + pts[i].x)/2, my = (pts[i-1].y + pts[i].y)/2;
        ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, mx, my);
      }
      ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      ctx.stroke();
    }

    // scattered dust/star texture along the band for a granular, real feel
    mwTwinkle.forEach(s => {
      const idx = Math.min(pts.length - 1, Math.floor(s.t * (pts.length - 1)));
      const base = pts[idx];
      if (!base) return;
      const ox = Math.cos(s.drift) * 26;
      const oy = Math.sin(s.drift) * 10;
      const tw = 0.3 + Math.sin(t*1.5 + s.tw)*0.25;
      ctx.fillStyle = `rgba(225,232,250,${Math.max(0, 0.18*strength*(0.6+tw))})`;
      ctx.beginPath();
      ctx.arc(base.x + ox, base.y + oy, 0.8, 0, Math.PI*2);
      ctx.fill();
    });

    ctx.restore();
  }

  // --- Lightning: recursive midpoint-displacement bolt with branches ---
  function jaggedPath(x0, y0, x1, y1, displace){
    if (displace < 6) return [[x0,y0],[x1,y1]];
    const mx = (x0+x1)/2 + (Math.random()-0.5)*displace;
    const my = (y0+y1)/2 + (Math.random()-0.5)*displace*0.3;
    const left = jaggedPath(x0,y0,mx,my,displace/2);
    const right = jaggedPath(mx,my,x1,y1,displace/2);
    return left.concat(right.slice(1));
  }

  function makeBolt(){
    const x0 = w*0.15 + Math.random()*w*0.7;
    const y0 = 0;
    const x1 = x0 + (Math.random()-0.5)*w*0.25;
    const y1 = h*(0.45 + Math.random()*0.25);
    const main = jaggedPath(x0, y0, x1, y1, Math.max(40, w*0.05));

    const branches = [];
    const branchCount = 1 + Math.floor(Math.random()*3);
    for (let i = 0; i < branchCount; i++){
      const idx = Math.floor(main.length * (0.25 + Math.random()*0.55));
      const [bx, by] = main[idx];
      const bx1 = bx + (Math.random()-0.5)*140;
      const by1 = by + 35 + Math.random()*90;
      branches.push(jaggedPath(bx, by, bx1, by1, 30));
    }
    return { main, branches, life: 1 };
  }

  function strokePath(points){
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }

  function drawBolt(b){
    const a = Math.max(0, b.life);
    ctx.save();
    ctx.shadowColor = 'rgba(200,220,255,0.9)';
    ctx.shadowBlur = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 2.4*a + 0.6;
    strokePath(b.main);

    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(220,230,255,${a*0.8})`;
    ctx.lineWidth = 1.2*a + 0.3;
    b.branches.forEach(strokePath);

    ctx.restore();
  }

  function loop(){
    if (!rafId) draw();
  }

  return { init, setWeather, setMilkyWay };
})();

document.addEventListener('DOMContentLoaded', WeatherFX.init);
