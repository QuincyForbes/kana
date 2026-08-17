/* ---- audio: local neural-TTS clips (audio/ja/<kana>.mp3, ja-JP-NanamiNeural),
        with the browser's own Japanese voice as fallback ---- */

const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
let audioWarned = false;

/* global audio prefs: slow (0.75× files, slower TTS) and voice (f = Nanami,
   m = Keita). The voice key is shared with the trainer. */
const AUDIO_KEY = 'kanaGuideAudio.v1', VOICE_KEY = 'kanaVoice.v1';
let slowAudio = false;
try{ slowAudio = !!(JSON.parse(localStorage.getItem(AUDIO_KEY)) || {}).slow; }catch{}
const voicePref = () => { try{ return localStorage.getItem(VOICE_KEY) === 'm' ? 'm' : 'f'; }catch{ return 'f'; } };
const voiceDirs = () => voicePref() === 'm' ? ['audio/ja-m/', 'audio/ja/'] : ['audio/ja/', 'audio/ja-m/'];

const slowBtn = document.getElementById('slow-audio');
slowBtn.setAttribute('aria-pressed', String(slowAudio));
slowBtn.addEventListener('click', ()=>{
  slowAudio = !slowAudio;
  slowBtn.setAttribute('aria-pressed', String(slowAudio));
  try{ localStorage.setItem(AUDIO_KEY, JSON.stringify({slow: slowAudio})); }catch{}
});
const voiceBtn = document.getElementById('voice-audio');
voiceBtn.setAttribute('aria-pressed', String(voicePref() === 'm'));
voiceBtn.addEventListener('click', ()=>{
  const m = voicePref() !== 'm';
  try{ localStorage.setItem(VOICE_KEY, m ? 'm' : 'f'); }catch{}
  voiceBtn.setAttribute('aria-pressed', String(m));
});

function flash(btn, ms){
  if(!btn) return;
  btn.classList.add('on');
  setTimeout(()=>btn.classList.remove('on'), Math.max(180, ms));
}
function speakText(text, btn){
  if(!window.speechSynthesis || !text) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = slowAudio ? 0.6 : 0.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  flash(btn, 500);
  return true;
}
function speakFallback(key, btn){
  return speakText(ROM2KANA[key], btn);
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
    a.playbackRate = slowAudio ? 0.75 : 1;
    a.play().then(()=>{ flash(btn, 600); res(true); }).catch(()=>res(false));
  });
}
async function playDirs(text, btn){
  for(const dir of voiceDirs())
    if(await playFile(dir + encodeURIComponent(text) + '.mp3', btn)) return true;
  return false;
}
async function play(key, btn){
  const kana = ROM2KANA[key];
  if(kana && await playDirs(kana, btn)) return;
  if(!speakFallback(key, btn)) warnAudio();
}
async function playWord(text, btn){
  if(await playDirs(text, btn)) return;
  if(!speakText(text, btn)) warnAudio();
}

document.addEventListener('click', e=>{
  const el = e.target;
  const w = el && el.closest ? el.closest('[data-play-word]') : null;
  if(w){ playWord(w.dataset.playWord, w); return; }
  const r = el && el.closest ? el.closest('[data-rec]') : null;
  if(r){ Rec.toggle(r); return; }
  const rp = el && el.closest ? el.closest('[data-rec-play]') : null;
  if(rp){ Rec.compare(rp.dataset.recPlay, rp); return; }
  const t = el && el.closest ? el.closest('[data-play]') : null;
  if(t) play(t.dataset.play, t.classList.contains('speak') ? t : null);
});

/* ---- record & compare: your voice, then the native clip ---- */
const Rec = {
  mr: null, url: null,
  async toggle(btn){
    if(this.mr && this.mr.state === 'recording'){ this.mr.stop(); return; }
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
      btn.disabled = true; btn.title = 'Recording is not supported in this browser'; return;
    }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const chunks = [];
      this.mr = new MediaRecorder(stream);
      this.mr.ondataavailable = e => chunks.push(e.data);
      this.mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if(this.url) URL.revokeObjectURL(this.url);
        this.url = URL.createObjectURL(new Blob(chunks, {type: this.mr.mimeType || 'audio/webm'}));
        btn.classList.remove('rec');
        const p = document.querySelector('[data-rec-play]');
        if(p) p.hidden = false;
      };
      this.mr.start();
      btn.classList.add('rec');
    }catch{
      btn.disabled = true; btn.title = 'Microphone permission was denied';
    }
  },
  compare(key, btn){
    if(!this.url) return;
    const mine = new Audio(this.url);
    mine.onended = () => play(key, btn);
    mine.play().catch(()=>{});
    flash(btn, 400);
  },
};

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
      if(mode==='both'||mode==='hira') inner+=`<span class="gh" lang="ja">${c.h}</span>`;
      if(mode==='both'||mode==='kata') inner+=`<span class="gk" lang="ja">${c.k}</span>`;
      inner+=`<span class="gr">${c.r}</span>`;
      b.innerHTML=inner;
      b.addEventListener('click',()=>{current=c;buildGrid();renderDetail();play(c.r);});
      grid.appendChild(b);
    });
  });
}

const detail=document.getElementById('detail');

/* ---- stroke order (KanjiVG data, js/strokes.js) ---- */
function strokeSVG(glyph, colorVar){
  const paths = typeof STROKES !== 'undefined' && STROKES[glyph];
  if(!paths) return '';
  /* every stroke light; numbered dots mark each stroke's start point */
  const marks = paths.map((d, i) => {
    const m = d.match(/^M\s*([\d.]+)[,\s]+([\d.]+)/i);
    if(!m) return '';
    return `<circle cx="${m[1]}" cy="${m[2]}" r="7" fill="var(--shu)" opacity=".85"/>
      <text x="${m[1]}" y="${+m[2] + 3.5}" text-anchor="middle" font-size="9" fill="#fff" font-family="var(--body)">${i + 1}</text>`;
  }).join('');
  return `<svg class="strokes" viewBox="0 0 109 109" aria-label="Stroke order for ${glyph}">
    <g fill="none" stroke="${colorVar}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      ${paths.map(d => `<path class="st" d="${d}"/>`).join('')}
    </g>${marks}
  </svg>`;
}

/* animate: strokes draw themselves in order */
function animateStrokes(svg){
  const paths = svg.querySelectorAll('.st');
  let delay = 0;
  paths.forEach(p => {
    const len = p.getTotalLength();
    p.style.transition = 'none';
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.getBoundingClientRect(); /* flush */
    const dur = Math.max(0.35, len / 120);
    p.style.transition = `stroke-dashoffset ${dur}s ease ${delay}s`;
    p.style.strokeDashoffset = 0;
    delay += dur + 0.15;
  });
}
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-anim]');
  if(!b) return;
  const svg = b.closest('.strokebox')?.querySelector('.strokes');
  if(svg) animateStrokes(svg);
});

/* ---- tracing canvas: draw over a faint template ---- */
const Trace = {
  open(glyph){
    const host = document.getElementById('trace-host');
    if(!host) return;
    host.innerHTML = `<div class="tracebox">
      <canvas id="trace-cv" width="240" height="240"></canvas>
      <div class="tracebtns">
        <button type="button" id="trace-clear">clear</button>
        <button type="button" id="trace-close">done</button>
      </div></div>`;
    const cv = document.getElementById('trace-cv'), ctx = cv.getContext('2d');
    const paint = () => {
      ctx.clearRect(0, 0, 240, 240);
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--rule');
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.moveTo(120, 12); ctx.lineTo(120, 228); ctx.moveTo(12, 120); ctx.lineTo(228, 120); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = .18;
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink');
      ctx.font = `190px ${getComputedStyle(document.body).getPropertyValue('--kana') || 'sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 120, 132);
      ctx.restore();
    };
    paint();
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--shu');
    let drawing = false;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * 240 / r.width, (e.clientY - r.top) * 240 / r.height];
    };
    cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if(drawing){ ctx.lineTo(...pos(e)); ctx.stroke(); } });
    cv.addEventListener('pointerup', () => drawing = false);
    cv.style.touchAction = 'none';
    document.getElementById('trace-clear').onclick = () => {
      paint();
      ctx.lineWidth = 7; ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--shu');
    };
    document.getElementById('trace-close').onclick = () => { host.innerHTML = ''; };
  },
};
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-trace]');
  if(b) Trace.open(b.dataset.trace);
});

/* one aligned card per script: strokes · shape drawing · mnemonic text */
function scriptCard(c, s){
  const glyph = s === 'h' ? c.h : c.k;
  return `<div class="mnem scriptcard${s === 'k' ? ' k' : ''}">
    <dt>${s === 'h' ? 'Hiragana' : 'Katakana'} <span lang="ja">${glyph}</span></dt>
    <div class="scriptrow">
      <div class="strokebox">${strokeSVG(glyph, s === 'h' ? 'var(--hira)' : 'var(--kata)')}
        <div class="strokebtns"><button type="button" data-anim>▶ draw</button><button type="button" data-trace="${glyph}">✎ trace</button></div>
      </div>
      ${shapeSVG(c, s)}
      <p class="mnemtext">${s === 'h' ? c.mh : c.mk}</p>
    </div>
  </div>`;
}

/* drawn mnemonic: the glyph with the memory image sketched over it */
function shapeSVG(c, script){
  const s = typeof SHAPES !== 'undefined' && SHAPES[c.r]?.[script];
  if(!s) return '';
  const glyph = script==='h' ? c.h : c.k;
  const col = script==='h' ? 'var(--hira)' : 'var(--kata)';
  return `<svg class="shape" viewBox="0 0 120 120" aria-hidden="true">
    <text x="60" y="63" text-anchor="middle" dominant-baseline="central" font-size="86"
      font-family="var(--kana)" fill="${col}">${glyph}</text>
    <g fill="none" stroke="var(--shu)" stroke-width="3" stroke-linecap="round"
      stroke-linejoin="round" opacity=".85">${s}</g>
  </svg>`;
}
function renderDetail(){
  const c=current;
  const showH = mode!=='kata', showK = mode!=='hira';
  const glyph = showH ? c.h : c.k;
  const col = showH ? 'var(--hira)' : 'var(--kata)';
  detail.innerHTML = `
    <div class="sq bigcell"><span lang="ja" style="color:${col}">${glyph}</span></div>
    <div>
      <div class="romaji-row">
        <p class="romaji-big">${c.r}</p>
        <button class="speak" type="button" data-play="${c.r}" aria-label="Play ${c.r}">${SPK}</button>
        <button class="speak mic" type="button" data-rec="${c.r}" title="Record yourself, then compare" aria-label="Record yourself">●</button>
        <button class="speak" type="button" data-rec-play="${c.r}" title="Your take, then the native clip" aria-label="Play your recording then the native clip" hidden>you→native</button>
        <a class="human" href="https://forvo.com/word/${encodeURIComponent(c.h)}/#ja" target="_blank" rel="noopener noreferrer">native speakers ↗</a>
      </div>
      <p class="sound">${c.s || 'regular — consonant + vowel, one even beat'}</p>
      <div class="pair">
        <span class="chip h"><em>hiragana</em><b lang="ja">${c.h}</b></span>
        <span class="chip k"><em>katakana</em><b lang="ja">${c.k}</b></span>
      </div>
      ${showH?scriptCard(c,'h'):''}
      ${showK?scriptCard(c,'k'):''}
      <div id="trace-host"></div>
      ${(WORDS[c.r]||[]).length?`<div class="words"><dt>In the wild</dt>${WORDS[c.r].map(w=>
        `<button type="button" class="word" data-play-word="${w[0]}"><b lang="ja">${w[0]}</b> ${w[1]} <em>${w[2]}</em></button>`).join('')}</div>`:''}
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
document.getElementById('tricky-cards').innerHTML = TRICKY.map(t=>`
  <div class="tcard">
    <div class="glyphs">${t.g.map((g,i)=>`<span lang="ja">${g}<i lang="en"> ${t.l[i]}</i></span>`).join('')}</div>
    <p>${t.p}</p>
  </div>`).join('');

/* ---- drill ---- */
/* score and settings survive reloads (per-browser, like the trainer) */
const DRILL_KEY = 'kanaGuideDrill.v1';
let saved = {};
try{ saved = JSON.parse(localStorage.getItem(DRILL_KEY)) || {}; }catch{}
let scope=saved.scope||'both', dir=saved.dir||'read', q=null,
    seen=saved.seen||0, right=saved.right||0, streak=saved.streak||0, best=saved.best||0;
const misses = saved.misses || {}; /* per-romaji miss counts drive the look-alike drill */
function saveDrill(){
  try{ localStorage.setItem(DRILL_KEY, JSON.stringify({scope, dir, seen, right, streak, best, misses})); }catch{}
}
const gl=document.getElementById('drill-glyph'), inp=document.getElementById('drill-input'),
      verdict=document.getElementById('verdict'), replay=document.getElementById('drill-replay'),
      choicesEl=document.getElementById('drill-choices'), answerEl=document.getElementById('drill-answer');
replay.innerHTML = SPK;

const shuffleArr = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* pool of confusable glyphs for the Look-alikes scope */
const TRICKY_POOL = [];
TRICKY.forEach(t => t.g.forEach((g, i) => {
  const c = flat.find(x => x.h === g || x.k === g);
  if(c) TRICKY_POOL.push({c, glyph: g, script: c.h === g ? 'hiragana' : 'katakana'});
}));

function nextQ(auto){
  if(scope==='tricky'){
    /* weighted pick: characters you have missed come up more often */
    const weighted = [];
    TRICKY_POOL.forEach(p => {
      const w = 1 + Math.min(4, (misses[p.c.r] || 0) * 2);
      for(let i = 0; i < w; i++) weighted.push(p);
    });
    const p = weighted[Math.floor(Math.random()*weighted.length)];
    q = {c: p.c, script: p.script, glyph: p.glyph};
  }else{
    const c = flat[Math.floor(Math.random()*flat.length)];
    const useH = scope==='hira' ? true : scope==='kata' ? false : Math.random()<0.5;
    q = {c, script: useH?'hiragana':'katakana', glyph: useH?c.h:c.k};
  }
  gl.textContent = q.glyph;
  gl.classList.toggle('hidden-glyph', dir==='listen');
  inp.value='';
  buildChoices();
  if(dir==='listen' && auto!==false) setTimeout(()=>play(q.c.r, replay), 180);
  if(dir!=='match') inp.focus();
}
replay.addEventListener('click',()=>{ if(q) play(q.c.r, replay); });

/* Match mode: same character, other script, 4 options — look-alikes preferred */
function buildChoices(){
  const on = dir==='match';
  choicesEl.hidden = !on;
  answerEl.style.display = on ? 'none' : '';
  if(!on || !q) return;
  const other = q.script==='hiragana' ? 'k' : 'h';
  const opts = [q.c[other]];
  const looks = [];
  TRICKY.forEach(t => {
    if(t.g.some(g => g===q.c.h || g===q.c.k))
      t.g.forEach(g => { const f = flat.find(x => x.h===g || x.k===g); if(f && f!==q.c) looks.push(f); });
  });
  shuffleArr(looks).forEach(f => { if(opts.length<4 && !opts.includes(f[other])) opts.push(f[other]); });
  while(opts.length<4){
    const f = flat[Math.floor(Math.random()*flat.length)];
    if(f!==q.c && !opts.includes(f[other])) opts.push(f[other]);
  }
  choicesEl.innerHTML = shuffleArr(opts).map(g=>`<button type="button" lang="ja" data-choice="${g}">${g}</button>`).join('');
}
choicesEl.addEventListener('click', e=>{
  const b = e.target.closest('[data-choice]');
  if(!b || !q) return;
  const other = q.script==='hiragana' ? 'k' : 'h';
  finish(b.dataset.choice === q.c[other], b.dataset.choice);
});

function updateScore(){
  document.getElementById('s-seen').textContent=seen;
  document.getElementById('s-right').textContent=right;
  document.getElementById('s-streak').textContent=streak;
  document.getElementById('s-best').textContent=best||'—';
}

function finish(ok, given){
  seen++; if(ok){right++;streak++; if(sprint) sprint.count++;} else streak=0;
  if(!ok) misses[q.c.r] = (misses[q.c.r] || 0) + 1;
  else if(misses[q.c.r]) misses[q.c.r] = Math.max(0, misses[q.c.r] - 0.5);
  saveDrill();
  /* feed the shared SRS record — drilling here counts in the trainer too */
  if(typeof SrsBridge !== 'undefined')
    SrsBridge.grade(q.script === 'hiragana' ? 'hg-' + q.c.h : 'kt-' + q.c.k, ok);
  gl.classList.remove('hidden-glyph');
  if(dir!=='listen') play(q.c.r, replay);
  const answer = dir==='match' ? (q.script==='hiragana'?q.c.k:q.c.h) : q.c.r;
  verdict.innerHTML = ok
    ? `<span class="ok">正解 — ${q.glyph} is <b>${answer}</b></span><small>${q.script}</small>`
    : `<span class="no">${q.glyph} is <b>${answer}</b>, not ${given}</span><small>${(q.script==='hiragana'?q.c.mh:q.c.mk).replace(/<\/?strong>/g,'')}</small>`;
  updateScore();
  setTimeout(nextQ, ok ? (sprint?350:550) : (sprint?1100:2200));
}

function check(){
  if(!q || !inp.value.trim()) return;
  const given = inp.value.trim().toLowerCase().replace(/[^a-z]/g,'');
  const alts = {shi:['shi','si'],chi:['chi','ti'],tsu:['tsu','tu'],fu:['fu','hu'],ji:['ji','zi'],wo:['wo','o'],n:['n','nn']};
  finish((alts[q.c.r]||[q.c.r]).includes(given), given);
}
document.getElementById('drill-check').addEventListener('click',check);
inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});

/* ---- 60s sprint ---- */
let sprint = null;
const sprintBtn=document.getElementById('sprint-btn'), sprintBox=document.getElementById('sprint-box'),
      sLeft=document.getElementById('s-sprint');
function endSprint(aborted){
  clearInterval(sprint.timer);
  const n = sprint.count; sprint = null;
  sprintBtn.textContent = '60s sprint';
  sprintBox.hidden = true;
  if(!aborted){
    const isBest = n > best;
    if(isBest){ best = n; saveDrill(); }
    verdict.innerHTML = `<span class="ok">Sprint over — <b>${n}</b> correct in 60 seconds${isBest&&n>0?' · new best!':''}</span><small>best: ${best}</small>`;
  }
  updateScore();
}
sprintBtn.addEventListener('click', ()=>{
  if(sprint) return endSprint(true);
  sprint = {left:60, count:0};
  sprintBtn.textContent = 'Stop';
  sprintBox.hidden = false; sLeft.textContent = '60';
  verdict.innerHTML = '';
  sprint.timer = setInterval(()=>{
    if(--sprint.left <= 0) return endSprint();
    sLeft.textContent = sprint.left;
  }, 1000);
  nextQ();
});

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
updateScore();

/* ---- minimal-pair listening drill: length is the only difference ---- */
const PAIRS = [
  [['きて','kite','come'],['きって','kitte','stamp']],
  [['おばさん','obasan','aunt'],['おばあさん','obaasan','grandmother']],
  [['おじさん','ojisan','uncle'],['おじいさん','ojiisan','grandfather']],
  [['ここ','koko','here'],['こうこう','koukou','high school']],
  [['さか','saka','slope'],['さっか','sakka','writer']],
  [['かた','kata','shoulder'],['かった','katta','bought']],
  [['くろ','kuro','black'],['くろう','kurou','hardship']],
  [['とる','toru','to take'],['とおる','tooru','to pass through']],
];
const Pairs = {
  pair: null, answer: null, right: 0, seen: 0,
  els: { choices: document.getElementById('pair-choices'),
         verdict: document.getElementById('pair-verdict'),
         play: document.getElementById('pair-play'),
         score: document.getElementById('pair-score') },
  next(){
    this.pair = PAIRS[Math.floor(Math.random()*PAIRS.length)];
    this.answer = this.pair[Math.floor(Math.random()*2)];
    this.els.choices.innerHTML = this.pair.map((w,i) =>
      `<button type="button" data-pair="${i}"><b lang="ja">${w[0]}</b> ${w[1]} <em>${w[2]}</em></button>`).join('');
    this.els.verdict.textContent = '';
    playWord(this.answer[0], this.els.play);
  },
  guess(i){
    if(!this.pair) return;
    const ok = this.pair[i] === this.answer;
    this.seen++; if(ok) this.right++;
    this.els.verdict.innerHTML = ok
      ? `<span class="ok">正解 — it was <b lang="ja">${this.answer[0]}</b> (${this.answer[1]})</span>`
      : `<span class="no">It was <b lang="ja">${this.answer[0]}</b> (${this.answer[1]}) — listen for the extra beat</span>`;
    this.els.score.textContent = `${this.right} / ${this.seen}`;
    const p = this.pair; this.pair = null;
    setTimeout(()=>this.next(), ok ? 1100 : 2400);
  },
};
if(Pairs.els.play){
  Pairs.els.play.addEventListener('click', ()=>{
    if(Pairs.pair) playWord(Pairs.answer[0], Pairs.els.play);
    else Pairs.next();
  });
  Pairs.els.choices.addEventListener('click', e=>{
    const b = e.target.closest('[data-pair]');
    if(b) Pairs.guess(+b.dataset.pair);
  });
}

/* ---- panels: one section at a time instead of a 9,000px scroll ---- */
const PANELS = ['chart','tricky','rules','pron','drill-sec','plan'];
const PANEL_KEY = 'kanaGuidePanel.v1';
let panel = 'chart';
try{ const s = localStorage.getItem(PANEL_KEY); if(PANELS.includes(s)) panel = s; }catch{}

function setPanel(id, updateHash = true){
  if(!PANELS.includes(id)) return;
  panel = id;
  try{ localStorage.setItem(PANEL_KEY, id); }catch{}
  PANELS.forEach(p => { document.getElementById(p).hidden = p !== id; });
  document.body.dataset.panel = id;
  document.querySelectorAll('.jumpnav a[href^="#"]').forEach(a => {
    const t = a.getAttribute('href').slice(1);
    if(PANELS.includes(t)) a.setAttribute('aria-current', String(t === id));
  });
  if(updateHash) history.replaceState(null, '', '#' + id);
  window.scrollTo({top: 0, behavior: 'instant'});
}

document.querySelector('.jumpnav').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if(!a) return;
  const id = a.getAttribute('href').slice(1);
  if(PANELS.includes(id)){ e.preventDefault(); setPanel(id); }
});

/* deep link from the trainer: guide.html#c=<romaji> opens that character */
function applyCharHash(){
  const m = location.hash.match(/^#c=([a-z]+)/);
  if(!m) return false;
  const f = flat.find(x => x.r === m[1]);
  if(!f) return false;
  current = f;
  setPanel('chart', false);
  buildGrid(); renderDetail();
  return true;
}
window.addEventListener('hashchange', () => {
  if(applyCharHash()) return;
  const id = location.hash.slice(1);
  if(PANELS.includes(id) && id !== panel) setPanel(id, false);
});

document.querySelectorAll('.jp,.ex,.beat,.mini td:first-child,h1 .jp,#drill-glyph').forEach(e=>e.setAttribute('lang','ja'));

buildGrid(); renderDetail(); nextQ(false);
{
  const initial = location.hash.slice(1);
  if(!applyCharHash()) setPanel(PANELS.includes(initial) ? initial : panel, PANELS.includes(initial));
}
