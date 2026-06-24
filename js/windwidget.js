// windwidget.js - animated flowing wind streaks + compass dial + active conditions badge

const WindWidget = (() => {
  let canvas, ctx, w, h;
  let streaks = [];
  let speedKmh = 0, dirDeg = 0;
  let rafId = null;

  function init(){
    canvas = document.getElementById('windFlowCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    seed();
    loop();
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    w = canvas.width = rect.width || 160;
    h = canvas.height = rect.height || 160;
  }

  function seed(){
    streaks = [];
    for (let i = 0; i < 22; i++){
      streaks.push({
        x: Math.random()*w, y: Math.random()*h,
        len: 6 + Math.random()*10,
        prog: Math.random()
      });
    }
  }

  function beaufort(kmh){
    const scale = [
      [1,"0 - Calm"],[5,"1 - Light air"],[11,"2 - Light breeze"],[19,"3 - Gentle breeze"],
      [28,"4 - Moderate breeze"],[38,"5 - Fresh breeze"],[49,"6 - Strong breeze"],
      [61,"7 - Near gale"],[74,"8 - Gale"],[88,"9 - Strong gale"],[102,"10 - Storm"],
      [117,"11 - Violent storm"],[Infinity,"12 - Hurricane"]
    ];
    for (const [max,label] of scale){ if (kmh < max) return label; }
    return "--";
  }

  function draw(){
    if (!ctx) return;
    ctx.clearRect(0,0,w,h);
    if (speedKmh > 0.5){
      // wind blows TOWARD (dirDeg + 180) since dirDeg is the "from" compass bearing
      const towardRad = ((dirDeg + 180) % 360) * Math.PI / 180;
      const vx = Math.sin(towardRad), vy = -Math.cos(towardRad);
      const speedFactor = Math.min(3, 0.4 + speedKmh / 25);

      ctx.strokeStyle = 'rgba(91,140,255,0.55)';
      ctx.lineWidth = 1.6;
      streaks.forEach(s => {
        s.prog += 0.012 * speedFactor;
        if (s.prog > 1){ s.prog = 0; s.x = Math.random()*w; s.y = Math.random()*h; }
        const cx = w/2, cy = h/2, R = Math.min(w,h)/2 - 4;
        const dx = s.x - cx, dy = s.y - cy;
        if (dx*dx + dy*dy > R*R){ s.x = cx + (Math.random()-0.5)*R; s.y = cy + (Math.random()-0.5)*R; }
        const x1 = s.x, y1 = s.y;
        const x2 = s.x + vx*s.len, y2 = s.y + vy*s.len;
        ctx.beginPath();
        ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        s.x += vx * speedFactor; s.y += vy * speedFactor;
      });
    }
    rafId = requestAnimationFrame(draw);
  }

  function loop(){ if (!rafId) draw(); }

  function update({ speed, direction, gust, icon, desc, place }){
    speedKmh = speed || 0;
    dirDeg = direction || 0;

    document.getElementById('windArrow').style.transform = `translateX(-50%) rotate(${dirDeg}deg)`;
    document.getElementById('windSpeedBig').textContent = Math.round(speedKmh);
    document.getElementById('windDirLabel').textContent = `${azToCompass(dirDeg)} (${Math.round(dirDeg)}°)`;
    document.getElementById('windGustLabel').textContent = gust != null ? `${Math.round(gust)} km/h` : '--';
    document.getElementById('beaufort').textContent = beaufort(speedKmh);

    document.getElementById('activeWxIcon').textContent = icon || '⛅';
    document.getElementById('activeWxDesc').textContent = desc || '--';
    document.getElementById('activeWxPlace').textContent = place || '--';
  }

  return { init, update };
})();

document.addEventListener('DOMContentLoaded', WindWidget.init);
