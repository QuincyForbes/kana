/* Theme — loaded in <head> ahead of the stylesheets so a page never flashes
   the wrong palette. The choice ("light" | "dark") is stored per browser;
   with nothing stored the page follows the system setting, live.
   Stylesheets key their dark palette off :root[data-theme="dark"].         */
(function () {
  var KEY = 'kanaTheme.v1';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var listeners = [];
  function stored() {
    try { var t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; } catch (e) { return null; }
  }
  function current() { return stored() || (mq && mq.matches ? 'dark' : 'light'); }
  function apply() {
    var t = current();
    document.documentElement.setAttribute('data-theme', t);
    /* browser / installed-app chrome follows the page (the meta tag sits above this script) */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', meta.getAttribute(t === 'dark' ? 'data-dark' : 'data-light') || meta.getAttribute('content'));
    listeners.forEach(function (fn) { fn(t); });
  }
  apply();
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  /* a toggle in another tab applies here too */
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

  window.KanaTheme = {
    get: current,
    set: function (t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(); },
    toggle: function () { this.set(current() === 'dark' ? 'light' : 'dark'); },
    onChange: function (fn) { listeners.push(fn); },
  };
})();
