/* Shared site chrome — one header (brand, page links, light/dark toggle)
   rendered into the #sitebar element each page places at its top, plus the
   toast helper. Styles live in css/site.css; the theme itself is applied
   earlier by js/theme.js.                                                  */
(function () {
  const bar = document.getElementById('sitebar');
  if (bar) {
    const here = location.pathname.split('/').pop() || 'index.html';
    const links = [
      ['guide.html', 'Guide'],
      ['trainer.html', 'Trainer'],
      ['mnemonics.html', 'Sheet'],
    ];
    const SUN = '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
    const MOON = '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z"/></svg>';
    bar.innerHTML =
      `<a class="brand" href="index.html"${here === 'index.html' ? ' aria-current="page"' : ''} aria-label="かな — home" lang="ja">か<span>な</span></a>` +
      '<nav aria-label="Site">' +
      links.map(([href, label]) =>
        `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`).join('') +
      '</nav>' +
      `<button class="themebtn" id="themebtn" type="button">${SUN}${MOON}</button>`;

    const btn = document.getElementById('themebtn');
    const theme = window.KanaTheme;
    if (!theme) btn.hidden = true;
    else {
      const label = (t) => {
        const to = t === 'dark' ? 'light' : 'dark';
        btn.setAttribute('aria-label', `Switch to ${to} theme`);
        btn.title = `Switch to ${to} theme`;
      };
      label(theme.get());
      theme.onChange(label);
      btn.addEventListener('click', () => theme.toggle());
    }
  }

  /* ---- toasts ----
     kanaToast("Saved") shows now; kanaToast.afterReload("Saved") shows it
     once the page comes back, for actions that end in location.reload().   */
  const FLASH = 'kanaFlash';
  let host = null;
  function toast(msg, ms = 2600) {
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  }
  toast.afterReload = (msg) => { try { sessionStorage.setItem(FLASH, msg); } catch {} };
  window.kanaToast = toast;
  try {
    const pending = sessionStorage.getItem(FLASH);
    if (pending) { sessionStorage.removeItem(FLASH); toast(pending); }
  } catch {}
})();
