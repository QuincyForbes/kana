/* Shared site navigation — one component, injected into the #sitenav-slot
   each page places in its own header. Styles ride the page's palette vars
   with neutral fallbacks, so no page needs its own copy. */
(function () {
  const slot = document.getElementById('sitenav-slot');
  if (!slot) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  const links = [
    ['index.html', 'Home'],
    ['guide.html', 'Guide'],
    ['trainer.html', 'Trainer'],
    ['mnemonics.html', 'Sheet'],
  ];
  slot.outerHTML =
    '<nav class="sitenav" aria-label="Site">' +
    links.map(([href, label]) =>
      `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('') +
    '</nav>';
  const css = document.createElement('style');
  css.textContent = `
    .sitenav{display:flex;gap:2px;align-items:center;margin-left:auto}
    .sitenav a{font-size:11px;letter-spacing:.09em;text-transform:uppercase;text-decoration:none;
      padding:6px 9px;border-radius:2px;color:var(--ink-soft,var(--muted,#67766d));
      transition:color .12s ease,background .12s ease}
    .sitenav a:hover{color:var(--ink,#1B221E);background:var(--rule-faint,var(--unseen,rgba(120,140,128,.15)))}
    .sitenav a[aria-current="page"]{color:var(--ink,#1B221E);font-weight:700;pointer-events:none}
    @media (max-width:480px){.sitenav a{padding:6px 6px}}
  `;
  document.head.appendChild(css);
})();
