/* ---- audio: local neural-TTS clips (audio/ja/<kana>.mp3, ja-JP-NanamiNeural),
        with the browser's own Japanese voice as fallback ---- */

const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
let audioWarned = false;

function flash(btn, ms){
  if(!btn) return;
  btn.classList.add('on');
  setTimeout(()=>btn.classList.remove('on'), Math.max(180, ms));
}
function speakFallback(key, btn){
  const kana = ROM2KANA[key];
  if(window.speechSynthesis && kana){
    const u = new SpeechSynthesisUtterance(kana);
    u.lang = 'ja-JP'; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    flash(btn, 500);
    return true;
  }
  return false;
}
function warnAudio(){
  if(audioWarned) return;
  audioWarned = true;
  const n = document.getElementById('audio-warn');
  if(n) n.hidden = false;
}
function playFile(url, btn){
  return new Promise(res=>{
    const a = new Audio(url);
    a.play().then(()=>{ flash(btn, 600); res(true); }).catch(()=>res(false));
  });
}
async function play(key, btn){
  const kana = ROM2KANA[key];
  if(kana && await playFile('audio/ja/' + encodeURIComponent(kana) + '.mp3', btn)) return;
  if(!speakFallback(key, btn)) warnAudio();
}

document.addEventListener('click', e=>{
  const el = e.target;
  const t = el && el.closest ? el.closest('[data-play]') : null;
  if(t) play(t.dataset.play, t.classList.contains('speak') ? t : null);
});

const flat = [];
K.forEach(row => row.c.forEach(c => { if (c) flat.push(c); }));

let mode = 'both', current = flat[0];

/* ---- chart ---- */
const grid = document.getElementById('grid');
function buildGrid(){
  grid.innerHTML = '';
  grid.appendChild(Object.assign(document.createElement('div'),{className:'colhead'}));
  ['a','i','u','e','o'].forEach(v=>{
    const h=document.createElement('div'); h.className='colhead'; h.textContent=v; grid.appendChild(h);
  });
  K.forEach(row=>{
    const lab=document.createElement('div'); lab.className='rowlab'; lab.textContent=row.r; grid.appendChild(lab);
    row.c.forEach(c=>{
      if(!c){ grid.appendChild(Object.assign(document.createElement('div'),{className:'empty'})); return; }
      const b=document.createElement('button');
      b.className='sq k-cell'; b.type='button';
      b.setAttribute('aria-current', c===current ? 'true':'false');
      b.setAttribute('aria-label', c.r);
      let inner='';
      if(mode==='both'||mode==='hira') inner+=`<span class="gh">${c.h}</span>`;
      if(mode==='both'||mode==='kata') inner+=`<span class="gk">${c.k}</span>`;
      inner+=`<span class="gr">${c.r}</span>`;
      b.innerHTML=inner;
      b.addEventListener('click',()=>{current=c;buildGrid();renderDetail();play(c.r);});
      grid.appendChild(b);
    });
  });
}

const detail=document.getElementById('detail');
function renderDetail(){
  const c=current;
  const showH = mode!=='kata', showK = mode!=='hira';
  const glyph = showH ? c.h : c.k;
  const col = showH ? 'var(--hira)' : 'var(--kata)';
  detail.innerHTML = `
    <div class="sq bigcell"><span style="color:${col}">${glyph}</span></div>
    <div>
      <div class="romaji-row">
        <p class="romaji-big">${c.r}</p>
        <button class="speak" type="button" data-play="${c.r}" aria-label="Play ${c.r}">${SPK}</button>
        <a class="human" href="https://forvo.com/word/${encodeURIComponent(c.h)}/#ja" target="_blank" rel="noopener noreferrer">native speakers ↗</a>
      </div>
      <p class="sound">${c.s || 'regular — consonant + vowel, one even beat'}</p>
      <div class="pair">
        <span class="chip h"><em>hira</em><b>${c.h}</b></span>
        <span class="chip k"><em>kata</em><b>${c.k}</b></span>
      </div>
      ${showH?`<div class="mnem"><dt>Hiragana ${c.h}</dt><p>${c.mh}</p></div>`:''}
      ${showK?`<div class="mnem k"><dt>Katakana ${c.k}</dt><p>${c.mk}</p></div>`:''}
    </div>`;
}

document.querySelectorAll('[data-mode]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    mode=btn.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    buildGrid(); renderDetail();
  });
});

/* ---- tricky ---- */
document.getElementById('tricky').innerHTML = TRICKY.map(t=>`
  <div class="tcard">
    <div class="glyphs">${t.g.map((g,i)=>`<span>${g}<i> ${t.l[i]}</i></span>`).join('')}</div>
    <p>${t.p}</p>
  </div>`).join('');

/* ---- drill ---- */
/* score and settings survive reloads (per-browser, like the trainer) */
const DRILL_KEY = 'kanaGuideDrill.v1';
let saved = {};
try{ saved = JSON.parse(localStorage.getItem(DRILL_KEY)) || {}; }catch{}
let scope=saved.scope||'both', dir=saved.dir||'read', q=null,
    seen=saved.seen||0, right=saved.right||0, streak=saved.streak||0;
function saveDrill(){
  try{ localStorage.setItem(DRILL_KEY, JSON.stringify({scope, dir, seen, right, streak})); }catch{}
}
const gl=document.getElementById('drill-glyph'), inp=document.getElementById('drill-input'),
      verdict=document.getElementById('verdict'), replay=document.getElementById('drill-replay');
replay.innerHTML = SPK;

function nextQ(auto){
  const c = flat[Math.floor(Math.random()*flat.length)];
  const useH = scope==='hira' ? true : scope==='kata' ? false : Math.random()<0.5;
  q = {c, script: useH?'hiragana':'katakana', glyph: useH?c.h:c.k};
  gl.textContent = q.glyph;
  gl.classList.toggle('hidden-glyph', dir==='listen');
  inp.value='';
  if(dir==='listen' && auto!==false) setTimeout(()=>play(c.r, replay), 180);
  inp.focus();
}
replay.addEventListener('click',()=>{ if(q) play(q.c.r, replay); });
function check(){
  if(!q || !inp.value.trim()) return;
  const given = inp.value.trim().toLowerCase().replace(/[^a-z]/g,'');
  const alts = {shi:['shi','si'],chi:['chi','ti'],tsu:['tsu','tu'],fu:['fu','hu'],ji:['ji','zi'],wo:['wo','o'],n:['n','nn']};
  const ok = (alts[q.c.r]||[q.c.r]).includes(given);
  seen++; if(ok){right++;streak++;} else streak=0;
  saveDrill();
  gl.classList.remove('hidden-glyph');
  if(dir==='read') play(q.c.r, replay);
  verdict.innerHTML = ok
    ? `<span class="ok">正解 — ${q.glyph} is <b>${q.c.r}</b></span><small>${q.script}</small>`
    : `<span class="no">${q.glyph} is <b>${q.c.r}</b>, not ${given}</span><small>${(q.script==='hiragana'?q.c.mh:q.c.mk).replace(/<\/?strong>/g,'')}</small>`;
  document.getElementById('s-seen').textContent=seen;
  document.getElementById('s-right').textContent=right;
  document.getElementById('s-streak').textContent=streak;
  setTimeout(nextQ, ok?550:2200);
}
document.getElementById('drill-check').addEventListener('click',check);
inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
document.querySelectorAll('[data-scope]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    scope=btn.dataset.scope; saveDrill();
    document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    verdict.innerHTML=''; nextQ();
  });
});
document.querySelectorAll('[data-dir]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    dir=btn.dataset.dir; saveDrill();
    document.querySelectorAll('[data-dir]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    verdict.innerHTML=''; nextQ();
  });
});

/* restore saved drill state into the UI */
document.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));
document.querySelectorAll('[data-dir]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dir===dir)));
document.getElementById('s-seen').textContent=seen;
document.getElementById('s-right').textContent=right;
document.getElementById('s-streak').textContent=streak;

buildGrid(); renderDetail(); nextQ(false);
