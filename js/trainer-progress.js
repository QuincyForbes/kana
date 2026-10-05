"use strict";
/* Kana Trainer — Progress view: totals, the due forecast, the review
   heatmap, per-deck bars and the learned / keeps-tripping lists.           */

/* --------------------------- Progress view ------------------------------- */
const Progress = (() => {
  const li = (c, extra = "") =>
    `<li><span class="jp2" lang="ja">${esc(cardJp(c))}</span><span class="mn">${esc(cardGloss(c))}${extra}</span></li>`;

  function stats() {
    const days = Srs.days();
    const streak = streakOf(days);
    /* due forecast */
    const now = Date.now(), eod = new Date(); eod.setHours(23, 59, 59, 999);
    let dueNow = 0, dueTom = 0, dueWeek = 0;
    CARDS.forEach((c) => {
      const p = Srs.record(c.id);
      if (!p) return;
      if (p.d <= now) dueNow++;
      else if (p.d <= eod.getTime() + 864e5) dueTom++;
      else if (p.d <= eod.getTime() + 7 * 864e5) dueWeek++;
    });
    /* heatmap: last 12 weeks, one column per week */
    const start = new Date(); start.setDate(start.getDate() - 83);
    let heat = "";
    for (let w = 0; w < 12; w++) {
      heat += '<div class="hw">';
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
        if (dt > new Date()) { heat += "<i></i>"; continue; }
        const n = days[ymd(dt)] || 0;
        heat += `<i class="l${n ? Math.min(4, Math.ceil(n / 10)) : 0}" title="${ymd(dt)}: ${n} reviews"></i>`;
      }
      heat += "</div>";
    }
    let known = 0, learning = 0;
    CARDS.forEach((c) => { const p = Srs.record(c.id); if (p) Srs.isKnown(p) ? known++ : learning++; });
    $("pfirst").hidden = known + learning > 0;
    $("pstats").innerHTML = `
      <div class="ptotals">
        <div class="kn"><b>${known}</b><span>known</span></div>
        <div class="ln"><b>${learning}</b><span>learning</span></div>
        <div class="nw"><b>${CARDS.length - known - learning}</b><span>unseen</span></div>
        <div class="st"><b>${streak}</b><span>day streak</span></div>
      </div>
      <p class="pdue"><b class="now">${dueNow}</b> due now · <b>${dueTom}</b> more by tomorrow · <b>${dueWeek}</b> later this week${
        dueNow ? ' <button type="button" class="minibtn" id="pgo">review now →</button>' : ""}</p>
      <h2 class="phead">Last 12 weeks</h2>
      <div class="heat" role="img" aria-label="Reviews per day over the last 12 weeks">${heat}</div>`;
    if (dueNow) $("pgo").onclick = () => setMode("quiz");
  }

  function render() {
    stats();
    $("pbars").innerHTML = DECK_ORDER.map((deck) => {
      const cards = deckMembers(deck);
      let known = 0, learning = 0, unseen = 0;
      cards.forEach((c) => {
        const p = Srs.record(c.id);
        if (!p) unseen++; else if (Srs.isKnown(p)) known++; else learning++;
      });
      const w = (x) => (100 * x / (cards.length || 1)).toFixed(1) + "%";
      const split = `${known} known · ${learning} learning · ${unseen} unseen`;
      return `<div class="pdeck">
        <h3><button type="button" class="pname" data-quizdeck="${esc(deck)}" title="Quiz this deck">${esc(deck)}<i>quiz →</i></button>
          <span class="pcount">${known || learning ? `${known} known${learning ? ` · ${learning} learning` : ""} / ` : "0 / "}${cards.length}</span></h3>
        <div class="pbar" role="img" aria-label="${split}" title="${split}"><i class="kn" style="width:${w(known)}"></i><i class="ln" style="width:${w(learning)}"></i><i class="nw" style="width:${w(unseen)}"></i></div>
      </div>`;
    }).join("");

    const known = CARDS.filter((c) => Srs.isKnown(Srs.record(c.id)));
    const lapsed = CARDS
      .filter((c) => { const p = Srs.record(c.id); return p && p.l >= 3 && !Srs.isKnown(p); })
      .sort((a, b) => Srs.record(b.id).l - Srs.record(a.id).l);

    $("pknown").innerHTML = known.length
      ? known.map((c) => li(c)).join("")
      : `<li class="pempty">Nothing yet — a card counts as learned once its next review is three weeks or more away.</li>`;
    $("plapse").innerHTML = lapsed.length
      ? lapsed.map((c) => li(c, ` · missed ×${Srs.record(c.id).l}`)).join("")
      : `<li class="pempty">No repeat offenders. Cards land here after three misses.</li>`;

    /* the pairs you actually confuse, from the pick-the-kana questions */
    const pairs = Confuse.pairs().slice(0, 8);
    $("pmix").innerHTML = pairs.length
      ? pairs.map((p) => `<li><span class="jp2" lang="ja">${esc(p.a)} ↔ ${esc(p.b)}</span><span class="mn">mixed up ×${p.n}</span></li>`).join("")
      : `<li class="pempty">None recorded yet. Wrong picks in <b>Match</b>, <b>Listen &amp; pick</b> and <b>Mixed</b> questions land here.</li>`;
    const mix = $("pmixDrill");
    mix.hidden = !pairs.length;
    mix.onclick = () => {
      const g = Confuse.glyphs();
      const cards = CARDS.filter((c) => c.type === "char" && Srs.record(c.id) && (g.has(c.char) || g.has(H2K[c.char] || K2H[c.char] || "")));
      if (cards.length) { Quiz.drillCards(shuffle(cards), { mode: "match" }); setMode("quiz"); }
    };

    /* keep the troublemakers as a deck of their own to come back to */
    const keep = $("plapseSave");
    keep.hidden = !lapsed.length;
    keep.onclick = () => {
      const name = "Tricky cards";
      const d = Decks.get(name) || Decks.create(name, RESERVED_DECKS);
      if (!d) return;
      d.refs = [...new Set([...d.refs, ...lapsed.map((c) => c.id)])];
      Decks.save();
      toast(`${lapsed.length} card${lapsed.length === 1 ? "" : "s"} saved to "${name}"`);
      render();
    };
    const btn = $("plapseDrill");
    btn.hidden = !lapsed.length;
    btn.onclick = () => { Quiz.drillCards(lapsed); setMode("quiz"); };
  }

  on("pstart", "click", () => setMode("quiz"));
  on("pbars", "click", (e) => {
    const b = e.target.closest("[data-quizdeck]");
    if (b) { Quiz.setDeck(b.dataset.quizdeck); setMode("quiz"); }
  });

  return { render };
})();
