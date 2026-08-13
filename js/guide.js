/* ---- audio: local neural-TTS clips (audio/ja/<kana>.mp3, ja-JP-NanamiNeural),
        with the browser's own Japanese voice as fallback ---- */

const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
let audioWarned = false;

/* global slow-audio toggle (0.75× files, slower TTS) */
const AUDIO_KEY = 'kanaGuideAudio.v1';
let slowAudio = false;
try{ slowAudio = !!(JSON.parse(localStorage.getItem(AUDIO_KEY)) || {}).slow; }catch{}
const slowBtn = document.getElementById('slow-audio');
slowBtn.setAttribute('aria-pressed', String(slowAudio));
slowBtn.addEventListener('click', ()=>{
  slowAudio = !slowAudio;
  slowBtn.setAttribute('aria-pressed', String(slowAudio));
  try{ localStorage.setItem(AUDIO_KEY, JSON.stringify({slow: slowAudio})); }catch{}
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
async function play(key, btn){
  const kana = ROM2KANA[key];
  if(kana && await playFile('audio/ja/' + encodeURIComponent(kana) + '.mp3', btn)) return;
  if(!speakFallback(key, btn)) warnAudio();
}
async function playWord(text, btn){
  if(await playFile('audio/ja/' + encodeURIComponent(text) + '.mp3', btn)) return;
  if(!speakText(text, btn)) warnAudio();
}

document.addEventListener('click', e=>{
  const el = e.target;
  const w = el && el.closest ? el.closest('[data-play-word]') : null;
  if(w){ playWord(w.dataset.playWord, w); return; }
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
      ${(WORDS[c.r]||[]).length?`<div class="words"><dt>In the wild</dt>${WORDS[c.r].map(w=>
        `<button type="button" class="word" data-play-word="${w[0]}"><b>${w[0]}</b> ${w[1]} <em>${w[2]}</em></button>`).join('')}</div>`:''}
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
    seen=saved.seen||0, right=saved.right||0, streak=saved.streak||0, best=saved.best||0;
function saveDrill(){
  try{ localStorage.setItem(DRILL_KEY, JSON.stringify({scope, dir, seen, right, streak, best})); }catch{}
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
    const p = TRICKY_POOL[Math.floor(Math.random()*TRICKY_POOL.length)];
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
  choicesEl.innerHTML = shuffleArr(opts).map(g=>`<button type="button" data-choice="${g}">${g}</button>`).join('');
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
  saveDrill();
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

/* deep link from the trainer: guide.html#c=<romaji> opens that character */
function applyCharHash(){
  const m = location.hash.match(/^#c=([a-z]+)/);
  if(!m) return;
  const f = flat.find(x => x.r === m[1]);
  if(!f) return;
  current = f;
  buildGrid(); renderDetail();
  document.getElementById('chart').scrollIntoView();
}
window.addEventListener('hashchange', applyCharHash);

buildGrid(); renderDetail(); nextQ(false); applyCharHash();
