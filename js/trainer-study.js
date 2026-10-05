"use strict";
/* Kana Trainer — Study view: phrases one kana per box, the kanji cards and
   the kana charts, with the section picker, search and play-all.           */

/* ---------------------------- Study view --------------------------------- */
const StudyView = (() => {
  const modLabel = (k) => (k === "ー" ? "(long)" : "(stop)");
  const sections = []; /* {id, label, group} in reading order */
  let sec = "all";
  const seenSec = store.get(KEYS.seenSec) || {};

  const phraseRow = (c) => {
    const cells = c.kana.map((k, i) => {
      let r = c.rom[i] || "", cls = "";
      if (r.startsWith("*")) { cls = " p"; r = r.slice(1); }
      else if (r === "~") { cls = " m"; r = modLabel(k); }
      if (k.length > 1) cls += " wide"; /* personalized fill-in boxes */
      const inner = `<div class="k" lang="ja">${esc(k)}</div><div class="r">${esc(r)}</div>`;
      /* base-46 boxes link to that character's guide entry */
      return BASE_LINK[k]
        ? `<a class="c${cls}" href="guide.html#c=${BASE_LINK[k]}" title="${esc(k)} in the guide">${inner}</a>`
        : `<div class="c${cls}">${inner}</div>`;
    }).join("");
    const key = `${c.kana.join("")} ${spokenRom(c)} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}">
      <div class="rmain"><div class="cells">${cells}</div><p class="meaning">${esc(c.mean)}</p></div>
      <button class="spk" data-say="${esc(c.kana.join(""))}"${hasClip(c) ? "" : " data-tts"} title="Listen" aria-label="Listen">🔊</button>
    </div>`;
  };

  const kanjiCard = (c) => {
    const key = `${c.kanji} ${c.furi} ${c.rom} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}" style="display:block"><div class="kjcard">
      <ruby lang="ja">${esc(c.kanji)}<rt>${esc(c.furi)}</rt></ruby>
      <span class="en">${esc(c.mean)}</span><span class="whr">${esc(c.where)}</span>
    </div></div>`;
  };

  /* script: "both" = hiragana·katakana pairs, "h"/"k" = one script, larger glyphs */
  const chartTable = (rows, heads, script = "both") => {
    const head = heads.map((h) => `<th>${h}</th>`).join("");
    const body = rows.map(([label, cells]) => {
      const tds = cells.map((c) => {
        if (!c) return `<td class="nil"></td>`;
        const glyphs = script === "both" ? `${c[0]} ${c[1]}` : script === "h" ? c[0] : c[1];
        return `<td class="${c[3] ? "odd" : ""}"><div class="pair" lang="ja">${glyphs}</div><div class="rom">${c[2]}</div></td>`;
      }).join("");
      return `<tr><th>${label}</th>${tds}</tr>`;
    }).join("");
    return `<div class="chartwrap"><table class="chart${script === "both" ? "" : " solo"}"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const section = (id, n, jp, en, body, filterable = false) => {
    const playall = filterable && id !== "kanji"
      ? `<button class="playall" data-playall="${id}" title="Play the whole section" aria-label="Play section">▶</button>` : "";
    return `<section id="${id}"${filterable ? " data-filterable" : ""}>
      <div class="shead"><span class="n">${n}</span><h2 lang="ja">${jp}</h2>${playall}<span class="en">${en}</span></div>${body}
    </section>`;
  };

  function render() {
    let out = "", charts = "", nav = "", n = 0;
    const num = () => String(++n).padStart(2, "0");

    DATA.forEach(([title, jp]) => {
      const rows = CARDS.filter((c) => c.deck === title);
      const nn = num(), id = "s" + n;
      sections.push({ id, label: title, group: "Phrases" });
      nav += `<a href="#${id}">${nn} ${esc(title)}</a>`;
      const youForm = title === "Introducing yourself" ? `
        <div class="youform">
          <p>Make these phrases yours — the ○○ boxes fill in with your details:</p>
          <label>name (katakana) <input id="you-name" value="${esc(YOU.name || "")}" placeholder="サム"></label>
          <label>country <input id="you-country" value="${esc(YOU.country || "")}" placeholder="カナダ"></label>
          <label>occupation <input id="you-job" value="${esc(YOU.job || "")}" placeholder="エンジニア"></label>
          <button id="you-save">Save</button>
        </div>` : "";
      const numDrill = title === "Numbers and time" ? `
        <div class="youform numdrill">
          <p>Random number practice — type the reading in romaji (use yon / nana / kyuu):</p>
          <span class="numq" id="num-q">247</span>
          <label style="flex:1;min-width:150px"><input id="num-in" autocomplete="off" spellcheck="false" placeholder="nihyaku yonjuu nana"></label>
          <button id="num-check">Check</button>
          <span id="num-verdict"></span>
        </div>` : "";
      out += section(id, nn, jp, `${esc(title)} · ${rows.length}`, youForm + rows.map(phraseRow).join("") + numDrill, true);
    });

    {
      const nn = num();
      sections.push({ id: "kanji", label: "Survival kanji", group: "Kanji" });
      nav += `<a href="#kanji">${nn} Survival kanji</a>`;
      const cards = CARDS.filter((c) => c.type === "kanji");
      out += section("kanji", nn, "漢字",
        `Survival kanji — signs you'll actually meet · ${cards.length}`,
        `<div class="kj">${cards.map(kanjiCard).join("")}</div>
         <p class="legend">The red furigana above each kanji is its reading — hide it with the <b>Romaji</b>
         toggle. These thirty cover most doors, tills, platforms and warning signs; phrases stay kana-only
         on purpose.</p>`, true);
    }

    const V = ["a", "i", "u", "e", "o"], Y = ["ya", "yu", "yo"];
    const sub = (t) => `<h3 class="subhead">${t}</h3>`;
    const extraTable =
      `<div class="chartwrap"><table class="chart solo"><tbody><tr>${EXTRA.map(([k, r], i) =>
        `<td><div class="pair">${k}</div><div class="rom">${r}</div></td>` + ((i + 1) % 8 === 0 ? "</tr><tr>" : "")
      ).join("")}</tr></tbody></table></div>`;
    [
      ["hira", "Kana", "ひらがな", "Hiragana — the full syllabary",
        sub("Base — 46 characters") + chartTable(GOJU, V, "h")
        + sub("Voiced — add ゛or ゜") + chartTable(DAKU, V, "h")
        + sub("Combos — kana + small ゃゅょ") + chartTable(YOON, Y, "h"),
        "Hiragana only — native words and all the grammar. Red romaji breaks the row pattern — say it as written."],
      ["kata", "Kana", "カタカナ", "Katakana — the full syllabary",
        sub("Base — 46 characters") + chartTable(GOJU, V, "k")
        + sub("Voiced — add ゛or ゜") + chartTable(DAKU, V, "k")
        + sub("Combos — kana + small ャュョ") + chartTable(YOON, Y, "k")
        + sub("Foreign sounds — katakana only") + extraTable,
        "Katakana only — loanwords, menus, brand names. The foreign-sound rows exist only in this script."],
      ["c1", "Kana charts — both scripts", "ごじゅうおん", "Base chart — hiragana / katakana", chartTable(GOJU, V),
        "Each cell reads <b>hiragana · katakana · romaji</b>. Red values break the row pattern — say them as written."],
      ["c2", "Kana charts — both scripts", "だくおん", "Voiced — add ゛or ゜", chartTable(DAKU, V),
        "Two ticks turn か into が. A small circle turns は into ぱ. Same shape, new sound."],
      ["c3", "Kana charts — both scripts", "ようおん", "Combos — kana + small ゃゅょ", chartTable(YOON, Y),
        "The small kana rides on the <b>i</b>-row character before it. き + ゃ is one beat, not two."],
      ["c4", "Kana charts — both scripts", "がいらいおん", "Katakana-only — foreign sounds", extraTable,
        "Built for sounds Japanese didn't originally have. Constant in menus, brand names and tech."],
    ].forEach(([id, group, jp, en, table, legend]) => {
      const nn = num();
      sections.push({ id, label: en.split(" — ")[0], group });
      nav += `<a href="#${id}">${nn} ${en.split(" — ")[0]}</a>`;
      charts += section(id, nn, jp, en, `${table}<p class="legend">${legend}</p>`);
    });

    $("out").innerHTML = out;
    $("charts").innerHTML = charts;
    $("idx").innerHTML = nav;
  }

  function wire() {
    const total = document.querySelectorAll("#out .row, #kanji .row").length;
    $("count").textContent = total + " items";

    document.addEventListener("click", (e) => {
      const b = e.target.closest(".spk");
      if (b) { Player.stop(); Speech.say(b.dataset.say, !("tts" in b.dataset)); } /* a tapped row takes over from play-all */
    });

    const toggle = (id, cls) => on(id, "click", () => {
      const btn = $(id), off = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!off));
      document.body.classList.toggle(cls, off);
    });
    toggle("tR", "no-r");
    toggle("tM", "no-m");

    /* ---- section picker ----
       One section at a time with prev/next, "all" restores the full scroll.
       A non-empty search always searches everything — a filter that silently
       ignored other sections would read as "no results". */
    function apply() {
      const t = $("q").value.trim().toLowerCase();
      const focus = !t && sec !== "all";
      document.querySelectorAll(".mast, .rules, .howto").forEach((el) => (el.hidden = focus));
      let shown = 0;
      document.querySelectorAll("section[data-filterable]").forEach((s) => {
        let any = 0;
        s.querySelectorAll(".row").forEach((r) => {
          const hit = !t || r.dataset.k.includes(t);
          r.hidden = !hit;
          if (hit) any++;
        });
        s.hidden = t ? !any : (focus && s.id !== sec);
        if (!s.hidden) shown += any;
      });
      document.querySelectorAll("#charts section").forEach((s) => {
        s.classList.toggle("dim", !!t);
        s.hidden = focus && s.id !== sec;
      });
      const cur = sections.find((x) => x.id === sec);
      $("count").textContent = t ? `${shown} of ${total}` : focus ? cur.label : `${total} items`;
      $("empty").hidden = !t || shown > 0;
      $("qsec").disabled = !!t;
      /* search mode: the input takes the row, other controls step aside */
      document.body.classList.toggle("searching", !!t);
      $("q-clear").hidden = !t;

      const nav = $("secnav");
      nav.hidden = !focus;
      if (focus) {
        const i = sections.indexOf(cur), prev = sections[i - 1], next = sections[i + 1];
        const deckBtn = DECK_ORDER.includes(cur.label)
          ? `<button class="sn quizsec" data-quizdeck="${esc(cur.label)}">Quiz this section →</button>` : "";
        nav.innerHTML =
          (prev ? `<button class="sn" data-sec="${prev.id}">← ${esc(prev.label)}</button>` : "<span></span>") +
          `<span class="snmid"><span class="sni">${i + 1} / ${sections.length}</span>${deckBtn}</span>` +
          (next ? `<button class="sn" data-sec="${next.id}">${esc(next.label)} →</button>` : "<span></span>");
      }
    }

    function tickLabels() {
      [...$("qsec").options].forEach((o) => {
        if (o.value !== "all") {
          const s = sections.find((x) => x.id === o.value);
          if (s) o.textContent = (seenSec[o.value] ? "✓ " : "") + s.label;
        }
      });
    }

    function setSec(id) {
      sec = sections.some((s) => s.id === id) ? id : "all";
      store.set(KEYS.studySec, sec);
      if (sec !== "all" && !seenSec[sec]) { seenSec[sec] = 1; store.set(KEYS.seenSec, seenSec); }
      tickLabels();
      $("qsec").value = sec;
      apply();
      window.scrollTo({ top: 0 });
      syncHash(); /* hoisted from the tabs section */
    }
    api.go = setSec;

    /* build the dropdown: All, then optgroups in reading order */
    const groups = [...new Set(sections.map((s) => s.group))];
    $("qsec").innerHTML =
      `<option value="all">All sections</option>` +
      groups.map((g) =>
        `<optgroup label="${g}">` +
        sections.filter((s) => s.group === g)
          .map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("") +
        `</optgroup>`).join("");
    on("qsec", "change", () => setSec($("qsec").value));

    /* header index links focus a section instead of anchor-scrolling */
    on("idx", "click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      setSec(a.getAttribute("href").slice(1));
    });

    on("secnav", "click", (e) => {
      const qd = e.target.closest("[data-quizdeck]");
      if (qd) { Quiz.setDeck(qd.dataset.quizdeck); setMode("quiz"); return; }
      const b = e.target.closest("[data-sec]");
      if (b) setSec(b.dataset.sec);
    });

    on("q", "input", apply);
    on("q-clear", "click", () => { $("q").value = ""; apply(); $("q").focus(); });
    on("q", "keydown", (e) => {
      if (e.key === "Escape") { $("q").value = ""; apply(); $("q").blur(); }
    });
    /* press / anywhere in Study to jump into search */
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.body.classList.contains("mode-study")
          && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
        e.preventDefault();
        $("q").focus();
      }
    });

    /* number sprint: random number → typed reading */
    let numCur = 247;
    function numNext() {
      /* weighted small: plenty of 2-3 digit numbers, occasional big ones */
      const r = Math.random();
      numCur = r < 0.4 ? 1 + Math.floor(Math.random() * 99)
        : r < 0.75 ? 100 + Math.floor(Math.random() * 900)
        : r < 0.92 ? 1000 + Math.floor(Math.random() * 9000)
        : 10000 + Math.floor(Math.random() * 89999);
      $("num-q").textContent = numCur.toLocaleString();
      $("num-in").value = "";
    }
    if ($("num-check")) {
      let pending = 0; /* a second Enter while the verdict shows must not skip a number */
      const check = () => {
        if (pending) return;
        const want = numToRomaji(numCur);
        const ok = numNorm($("num-in").value) === numNorm(want);
        $("num-verdict").innerHTML = ok
          ? `<b style="color:var(--rule)">正解</b>`
          : `<b style="color:var(--shu)">${esc(want)}</b>`;
        pending = setTimeout(() => { pending = 0; numNext(); }, ok ? 600 : 2400);
      };
      on("num-check", "click", check);
      on("num-in", "keydown", (e) => { if (e.key === "Enter") check(); });
      numNext();
    }

    /* personalization form */
    const save = $("you-save");
    if (save) save.onclick = () => {
      store.set(KEYS.you, {
        name: $("you-name").value.trim(),
        country: $("you-country").value.trim(),
        job: $("you-job").value.trim(),
      });
      toast.afterReload("Saved — your phrases are updated");
      location.reload(); /* cards and rows rebuild from the new values */
    };

    /* play a whole section in sequence */
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-playall]");
      if (!b) return;
      const items = [...document.querySelectorAll(`#${b.dataset.playall} .row:not([hidden]) .spk`)]
        .map((s) => [s.dataset.say, !("tts" in s.dataset)]);
      Player.toggle(items, b);
    });

    setSec(store.get(KEYS.studySec) || "all"); /* returning users land where they left off */
  }

  const api = { render, wire, current: () => sec };
  return api;
})();
