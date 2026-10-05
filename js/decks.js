"use strict";
/* Personal decks — built up while you learn. Shared by the trainer and the
   guide, stored in this browser (KEYS.custom).

   A deck holds two kinds of thing:
     cards  its own cards, {f: front, r: reading, m: meaning} — typed in,
            imported as CSV, or picked up from the guide's example words
     refs   ids of cards that already exist in the trainer (a phrase, a
            kanji, a character). The card isn't copied: it keeps its one
            progress record, and simply shows up in this deck too.          */

/* own-card ids: deck name + front text; a repeated front gets #2, #3… */
function customIds(d) {
  const seen = new Map();
  return d.cards.map((c) => {
    const n = (seen.get(c.f) || 0) + 1;
    seen.set(c.f, n);
    return `c:${d.name}:${c.f}` + (n > 1 ? "#" + n : "");
  });
}

/* Keep only well-formed decks from storage or an imported file. A name that
   collides with a built-in deck (or an earlier deck) gets a numeric suffix
   instead of silently merging into it.                                     */
function cleanDecks(raw, reserved = []) {
  if (!Array.isArray(raw)) return [];
  const taken = new Set(reserved);
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  return raw.flatMap((d) => {
    let name = str(d?.name);
    if (!name || !Array.isArray(d.cards)) return [];
    const cards = d.cards.flatMap((c) => (str(c?.f) ? [{ f: str(c.f), r: str(c.r), m: str(c.m) }] : []));
    const refs = [...new Set((Array.isArray(d.refs) ? d.refs : []).map(str).filter(Boolean))];
    for (let n = 2; taken.has(name); n++) name = `${str(d.name)} (${n})`;
    taken.add(name);
    return [{ name, cards, refs }];
  });
}

const Decks = (() => {
  const listeners = [];
  let list = cleanDecks(store.get(KEYS.custom));
  const get = (name) => list.find((d) => d.name === name);
  function save() {
    store.set(KEYS.custom, list);
    listeners.forEach((fn) => fn());
  }
  return {
    get list() { return list; },
    get, save,
    /* swap in a whole new set (import, or the trainer re-validating names) */
    replace(next) { list = next; },
    onChange(fn) { listeners.push(fn); },
    /* @returns the new deck, or null when the name is empty or taken */
    create(name, reserved = []) {
      name = String(name || "").trim();
      if (!name || get(name) || reserved.includes(name)) return null;
      const d = { name, cards: [], refs: [] };
      list.push(d);
      save();
      return d;
    },
    hasRef: (name, id) => !!get(name)?.refs.includes(id),
    hasCard: (name, front) => !!get(name)?.cards.some((c) => c.f === front),
    /* put an existing trainer card in the deck, or take it back out */
    toggleRef(name, id) {
      const d = get(name);
      if (!d) return;
      d.refs = d.refs.includes(id) ? d.refs.filter((x) => x !== id) : [...d.refs, id];
      save();
    },
    /* add a new card of the deck's own (matched by its front), or remove it */
    toggleCard(name, card) {
      const d = get(name);
      if (!d) return;
      d.cards = d.cards.some((c) => c.f === card.f)
        ? d.cards.filter((c) => c.f !== card.f)
        : [...d.cards, { f: card.f, r: card.r || "", m: card.m || "" }];
      save();
    },
  };
})();

/* The "add to a deck" popover: a checkbox per deck, plus a box to start a
   new one. item is {ref: id} for a card the trainer already has, or
   {card: {f, r, m}} for something new (a word from the guide).             */
const DeckMenu = (() => {
  let el = null, anchor = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const outside = (e) => { if (el && !el.contains(e.target) && !anchor.contains(e.target)) close(); };
  /* Escape closes the menu only — not the modal it may be sitting in */
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); } };

  function close(refocus = false) {
    if (!el) return;
    el.remove();
    el = null;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", onKey, true);
    if (refocus && anchor) anchor.focus();
    anchor = null;
  }

  function open(from, item, { reserved = [], title = "Add to a deck" } = {}) {
    if (el && anchor === from) return close();
    close();
    anchor = from;
    const has = (d) => (item.ref ? d.refs.includes(item.ref) : d.cards.some((c) => c.f === item.card.f));
    const toggle = (name) => (item.ref ? Decks.toggleRef(name, item.ref) : Decks.toggleCard(name, item.card));
    el = document.createElement("div");
    el.className = "deckmenu";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", title);
    const draw = (note = "") => {
      el.innerHTML = `<p class="dm-title">${esc(title)}</p>` +
        (Decks.list.length
          ? Decks.list.map((d, i) => `<label><input type="checkbox" data-deck="${i}"${has(d) ? " checked" : ""}>
              <span>${esc(d.name)}</span><i>${d.cards.length + d.refs.length}</i></label>`).join("")
          : `<p class="dm-empty">No decks yet — name your first one.</p>`) +
        `<form class="dm-new"><input name="deck" placeholder="New deck…" aria-label="New deck name" maxlength="40" autocomplete="off">
           <button type="submit">Create</button></form>` +
        (note ? `<p class="dm-note" role="alert">${esc(note)}</p>` : "");
    };
    draw();
    el.addEventListener("change", (e) => {
      const i = e.target.dataset.deck;
      if (i !== undefined) toggle(Decks.list[+i].name);
    });
    el.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = e.target.elements.deck.value.trim();
      if (!name) return;
      const d = Decks.create(name, reserved);
      if (!d) return draw(`"${name}" is already taken — pick another name.`);
      toggle(d.name);
      draw();
      el.querySelector(".dm-new input").focus();
    });

    /* inside a modal <dialog> the menu has to live in it, or it sits behind */
    (from.closest("dialog") || document.body).appendChild(el);
    const r = from.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
    el.style.top = (r.bottom + h + 8 > innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6) + "px";
    (el.querySelector("input[type=checkbox]") || el.querySelector(".dm-new input")).focus();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey, true);
  }
  return { open, close };
})();
