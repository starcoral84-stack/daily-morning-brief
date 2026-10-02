/* Morning brief dashboard layer - owned by Claude (see LANES.md).
   Loaded by tabs.js on the brief page. It READS the page the daily updater wrote
   (an <article> of <h2> sections with <p> items) and shows it as cards, widgets and a
   pick-and-choose menu. It never edits the updater's files; the original page is only
   hidden after the new layout has been built successfully. If anything goes wrong,
   the plain page stays exactly as it was. */
(function () {
  if (window.__bf) return;
  window.__bf = true;
  var art = document.querySelector('article');
  if (!art || !art.querySelector('h2')) return;

  function build() {
    var main = document.querySelector('main') || art.parentNode;
    var PK = 'bf-prefs-v1';
    var prefs = { hidden: {}, collapsed: {} };
    var raw = null;
    try { raw = localStorage.getItem(PK); if (raw) prefs = Object.assign(prefs, JSON.parse(raw)); } catch (e) {}
    if (!raw) prefs.hidden.strip = 1; /* schedule has its own tab: strip off by default */
    function save() { try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) {} }

    var $ = function (t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
    var txt = function (n) { return (n.textContent || '').replace(/\s+/g, ' ').trim(); };
    var slug = function (s) { return s.toLowerCase().replace(/&amp;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'; };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    /* ---------- read the page ---------- */
    var kicker = txt(main.querySelector('.kicker') || $('i')) || 'Morning handover';
    var h1 = txt(main.querySelector('h1') || $('i')) || document.title;
    var aiBox = main.querySelector('.ai'), foot = main.querySelector('footer');
    var sections = [], cur = null;
    Array.prototype.forEach.call(art.children, function (n) {
      if (n.tagName === 'H2') { cur = { title: txt(n), nodes: [] }; cur.id = slug(cur.title); sections.push(cur); }
      else if (cur) cur.nodes.push(n.cloneNode(true));
    });
    if (!sections.length) return;
    var localIdx = -1;
    sections.forEach(function (s, i) { if (/^local\b|local strip|near me|around you/i.test(s.title)) localIdx = i; });
    var local = localIdx >= 0 ? sections.splice(localIdx, 1)[0] : null;

    /* ---------- section icons ---------- */
    var ICON = [[/tech|^ai\b.*news|^ai$/i, '💻'], [/tools|tips/i, '🧰'], [/world/i, '🌍'], [/thailand/i, '🇹🇭'], [/expat/i, '🛂'],
      [/food|drink/i, '🍜'], [/culture|event/i, '🎭'], [/travel/i, '✈️'], [/competition|giveaway/i, '🎟️'], [/freebie|free/i, '🎁'], [/entertain/i, '🎬']];
    var icon = function (t) { for (var i = 0; i < ICON.length; i++) if (ICON[i][0].test(t)) return ICON[i][1]; return '📰'; };

    /* ---------- turn a <p> into a story card ---------- */
    function isSep(n) { return n.nodeType === 3 && /^[\s·|,;·]*$/.test(n.nodeValue); }
    function item(p) {
      var wrap = $('div', 'bf-item');
      var first = null;
      for (var i = 0; i < p.childNodes.length; i++) {
        var n = p.childNodes[i];
        if (n.nodeType === 3 && !n.nodeValue.trim()) continue;
        first = n; break;
      }
      if (first && first.nodeType === 1 && first.tagName === 'STRONG') {
        var hl = $('div', 'bf-hl'); hl.innerHTML = first.innerHTML;
        var after = first.nextSibling;
        p.removeChild(first);
        if (after && after.nodeType === 3) after.nodeValue = after.nodeValue.replace(/^\s*[—–-]+\s*/, '');
        wrap.appendChild(hl);
      }
      var links = [];
      while (p.lastChild && (isSep(p.lastChild) || (p.lastChild.nodeType === 1 && p.lastChild.tagName === 'A'))) {
        var l = p.lastChild; p.removeChild(l);
        if (l.nodeType === 1) links.unshift(l);
      }
      var body = $('div', 'bf-body'); body.innerHTML = p.innerHTML.trim();
      if (!wrap.firstChild && /^<em>/.test(body.innerHTML)) wrap.className += ' bf-note';
      if (body.innerHTML) wrap.appendChild(body);
      if (links.length) { var src = $('div', 'bf-src'); links.forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; src.appendChild(a); }); wrap.appendChild(src); }
      return wrap;
    }
    function fill(el, nodes) {
      var n = 0;
      nodes.forEach(function (node) {
        if (node.tagName === 'P') { el.appendChild(item(node)); n++; }
        else if (node.tagName === 'UL' || node.tagName === 'OL') {
          Array.prototype.forEach.call(node.children, function (li) { var p = document.createElement('p'); p.innerHTML = li.innerHTML; el.appendChild(item(p)); n++; });
        } else { var w = $('div', 'bf-body'); w.appendChild(node); el.appendChild(w); }
      });
      return n;
    }

    /* ---------- widgets (the Local strip) ---------- */
    var AQI = [[50, 'Good', '#2fbf71'], [100, 'Moderate', '#e8b50b'], [150, 'Unhealthy for sensitive groups', '#f28c28'],
      [200, 'Unhealthy', '#e5484d'], [300, 'Very unhealthy', '#a855f7'], [9999, 'Hazardous', '#9f1d1d']];
    var aqiCat = function (v) { for (var i = 0; i < AQI.length; i++) if (v <= AQI[i][0]) return AQI[i]; return AQI[5]; };
    var widgets = [];
    var localJSON = null;
    try { var js = document.getElementById('local-data'); if (js) localJSON = JSON.parse(js.textContent); } catch (e) {}
    function widgetFrom(el) {
      var label = '', bodyHTML = '';
      var c = el.cloneNode(true);
      var s = c.querySelector('strong');
      if (s) { label = txt(s); var a = s.nextSibling; s.parentNode.removeChild(s); if (a && a.nodeType === 3) a.nodeValue = a.nodeValue.replace(/^\s*[—–:-]+\s*/, ''); }
      bodyHTML = c.innerHTML.trim();
      var plain = txt(c), L = label.toLowerCase();
      var kind = /rain/.test(L) ? 'rain' : /aqi|air|pm ?2/.test(L) ? 'aqi' : /power|water|outage|utilit/.test(L) ? 'power' :
        /soi|sukhumvit|nearby/.test(L) ? 'soi' : /fgc|film|cinema|screen/.test(L) ? 'fgc' : 'misc';
      return { kind: kind, label: label || 'Local', html: bodyHTML, plain: plain, id: 'w-' + (kind === 'misc' ? slug(label || 'local') : kind) };
    }
    if (local) local.nodes.forEach(function (n) {
      if (n.tagName === 'P') widgets.push(widgetFrom(n));
      else if (n.tagName === 'UL' || n.tagName === 'OL') Array.prototype.forEach.call(n.children, function (li) { widgets.push(widgetFrom(li)); });
    });
    function renderWidget(w) {
      var d = $('div', 'bf-w bf-w-' + w.kind), j = localJSON && localJSON[w.kind];
      var h;
      if (w.kind === 'rain') {
        var m = w.plain.match(/(\d{1,3})\s*%/), pct = j && j.chance != null ? +j.chance : (m ? +m[1] : null);
        var rest = w.html.replace(/(\d{1,3})\s*%/, '').replace(/^[\s,;:()–—-]+/, '');
        if (j && j.hours) rest = esc(j.hours) + (j.note ? ' · ' + esc(j.note) : '');
        h = '<div class="bf-wh"><span class="bf-wi">🌧️</span>' + esc(w.label) + '</div>' +
          (pct != null ? '<div class="bf-big">' + pct + '<small>%</small></div><div class="bf-meter"><i style="width:' + Math.min(100, pct) + '%"></i></div>' : '') +
          '<div class="bf-wt">' + (rest || (pct == null ? w.html : '')) + '</div>';
      } else if (w.kind === 'aqi') {
        var mm = w.plain.match(/\b(\d{1,3})\b/), v = j && j.value != null ? +j.value : (mm ? +mm[1] : null);
        if (v != null) {
          var cat = aqiCat(v), rest2 = w.html.replace(/\b\d{1,3}\b/, '').replace(/^[\s,;:–—-]+/, '').replace(/^\(([^)]*)\)[\s;,.]*/, '$1. ');
          h = '<div class="bf-wh"><span class="bf-wi">🌫️</span>' + esc(w.label) + '</div>' +
            '<div class="bf-aqi"><div class="bf-ring" style="--ring:' + cat[2] + '">' + v + '</div><div><b style="color:' + cat[2] + '">' + cat[1] + '</b><div class="bf-wt">' + rest2 + '</div></div></div>';
        } else h = '<div class="bf-wh"><span class="bf-wi">🌫️</span>' + esc(w.label) + '</div><div class="bf-wt">' + w.html + '</div>';
      } else if (w.kind === 'power') {
        var clear = /\b(no|none|nothing)\b[^.]*\b(notice|outage|cut|interrupt|maintenance|planned)|all clear|normal|nil/i.test(w.plain);
        h = '<div class="bf-wh"><span class="bf-wi">⚡</span>' + esc(w.label) + '</div><div class="bf-chip ' + (clear ? 'ok' : 'warn') + '">' + (clear ? 'All clear' : 'Heads up') + '</div><div class="bf-wt">' + w.html + '</div>';
      } else {
        var ic = w.kind === 'fgc' ? '🎬' : w.kind === 'soi' ? '📍' : '📌';
        h = '<div class="bf-wh"><span class="bf-wi">' + ic + '</span>' + esc(w.label) + '</div><div class="bf-wt">' + w.html + '</div>';
        if (w.kind === 'fgc' || w.kind === 'soi' || w.html.length > 140) d.className += ' bf-wide';
      }
      d.innerHTML = h; d.id = w.id; d.setAttribute('data-bf', w.id);
      Array.prototype.forEach.call(d.querySelectorAll('a'), function (a) { a.target = '_blank'; a.rel = 'noopener'; });
      return d;
    }

    /* ---------- assemble ---------- */
    var app = $('div', 'bf');
    var hero = $('header', 'bf-hero');
    hero.appendChild($('div', 'bf-kicker', esc(kicker)));
    hero.appendChild($('h1', 'bf-title', esc(h1)));
    var count = 0;
    var cards = sections.map(function (s) {
      var card = $('section', 'bf-card'); card.id = 'sec-' + s.id; card.setAttribute('data-bf', s.id);
      var btn = $('button', 'bf-ch'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'true');
      var bodyEl = $('div', 'bf-cb');
      var n = fill(bodyEl, s.nodes); count += n; s.count = n;
      btn.innerHTML = '<span class="bf-ci">' + icon(s.title) + '</span><span class="bf-ct">' + s.title + '</span><span class="bf-cn">' + n + '</span><span class="bf-cv" aria-hidden="true"></span>';
      btn.addEventListener('click', function () { toggleCollapse(s.id); });
      card.appendChild(btn); card.appendChild(bodyEl);
      return card;
    });
    hero.appendChild($('p', 'bf-sub', sections.length + ' sections · ' + count + ' items · tap ☰ to pick what you see'));
    app.appendChild(hero);

    /* live Bangkok (Phrom Phong) rain + air quality, used when the brief has no such widget */
    var have = {}; widgets.forEach(function (w) { have[w.kind] = 1; });
    var live = [];
    if (!have.rain) live.push({ kind: 'rain', label: 'Rain today', id: 'w-rain', html: '', plain: '' });
    if (!have.aqi) live.push({ kind: 'aqi', label: 'AQI Phrom Phong', id: 'w-aqi', html: '', plain: '' });
    var wrap = null;
    if (widgets.length || live.length) {
      wrap = $('section', 'bf-widgets'); wrap.setAttribute('aria-label', 'Local');
      live.forEach(function (w) {
        var d = $('div', 'bf-w bf-w-' + w.kind, '<div class="bf-wh"><span class="bf-wi">' + (w.kind === 'rain' ? '🌧️' : '🌫️') + '</span>' + esc(w.label) + '</div><div class="bf-wt">Loading…</div>');
        d.id = w.id; d.setAttribute('data-bf', w.id); wrap.appendChild(d); w.el = d;
        widgets.push(w);
      });
      widgets.forEach(function (w) { if (!w.el) wrap.appendChild(renderWidget(w)); });
      app.appendChild(wrap);
      var fail = function (w) { if (w.el && w.el.parentNode) { w.el.parentNode.removeChild(w.el); } };
      var swap = function (w, html) { var n = renderWidget({ kind: w.kind, label: w.label, id: w.id, html: html, plain: html.replace(/<[^>]*>/g, '') }); w.el.className = n.className; w.el.innerHTML = n.innerHTML; };
      var R = live.filter(function (w) { return w.kind === 'rain'; })[0], A = live.filter(function (w) { return w.kind === 'aqi'; })[0];
      var LL = 'latitude=13.7300&longitude=100.5700&timezone=Asia%2FBangkok';
      if (R) fetch('https://api.open-meteo.com/v1/forecast?' + LL + '&current=temperature_2m&hourly=precipitation_probability&forecast_days=1')
        .then(function (r) { return r.json(); }).then(function (j) {
          var p = j.hourly.precipitation_probability, t = j.hourly.time, mx = 0, wet = [];
          p.forEach(function (v, i) { if (v > mx) mx = v; var h = +t[i].slice(11, 13); if (v >= 50 && h >= 6 && h <= 22) wet.push(h); });
          var f = function (h) { return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); };
          var note = wet.length ? 'Likely wet ' + f(wet[0]) + '–' + f(wet[wet.length - 1] + 1) : 'No rain likely today';
          var temp = j.current && j.current.temperature_2m != null ? ' · ' + Math.round(j.current.temperature_2m) + '°C now' : '';
          swap(R, mx + '% peak chance. ' + note + temp);
        }).catch(function () { fail(R); apply(); });
      if (A) fetch('https://air-quality-api.open-meteo.com/v1/air-quality?' + LL + '&current=us_aqi,pm2_5')
        .then(function (r) { return r.json(); }).then(function (j) {
          var v = Math.round(j.current.us_aqi), pm = Math.round(j.current.pm2_5);
          swap(A, v + ' PM2.5 ' + pm + ' µg/m³ (US AQI)');
        }).catch(function () { fail(A); apply(); });
    }
    var list = $('div', 'bf-list'); cards.forEach(function (c) { list.appendChild(c); }); app.appendChild(list);
    var fo = $('footer', 'bf-foot');
    if (aiBox) fo.appendChild($('div', 'bf-ai', aiBox.innerHTML));
    if (foot) fo.appendChild($('div', 'bf-fl', foot.innerHTML));
    app.appendChild(fo);

    /* ---------- menu (hamburger drawer, tap only) ---------- */
    var fab = $('button', 'bf-fab', '<span>☰</span> Pick &amp; choose'); fab.type = 'button'; fab.setAttribute('aria-controls', 'bf-drawer'); fab.setAttribute('aria-expanded', 'false');
    var scrim = $('div', 'bf-scrim');
    var dr = $('aside', 'bf-drawer'); dr.id = 'bf-drawer'; dr.setAttribute('aria-label', 'Choose what to show');
    var stripKey = 'strip';
    var hasStrip = function () { return document.querySelectorAll('.sd-host').length > 1; };
    function row(id, label, jump) {
      var l = $('label', 'bf-row'); var cb = $('input'); cb.type = 'checkbox'; cb.checked = !prefs.hidden[id];
      cb.addEventListener('change', function () { if (cb.checked) delete prefs.hidden[id]; else prefs.hidden[id] = 1; save(); apply(); });
      l.appendChild(cb); l.appendChild($('span', '', label));
      if (jump) { var a = $('a', 'bf-jump', 'Jump'); a.href = '#' + jump; a.addEventListener('click', function () { setOpen(false); }); l.appendChild(a); }
      return l;
    }
    var dh = $('div', 'bf-dh', '<b>Pick &amp; choose</b>'); var x = $('button', 'bf-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); dh.appendChild(x); dr.appendChild(dh);
    dr.appendChild($('h3', '', 'Widgets'));
    dr.appendChild(row(stripKey, 'Schedule: today & tomorrow'));
    widgets.forEach(function (w) { dr.appendChild(row(w.id, w.label)); });
    dr.appendChild($('h3', '', 'Sections'));
    sections.forEach(function (s) { dr.appendChild(row(s.id, icon(s.title) + ' ' + s.title, 'sec-' + s.id)); });
    var tools = $('div', 'bf-tools');
    [['Collapse all', function () { sections.forEach(function (s) { prefs.collapsed[s.id] = 1; }); save(); apply(); }],
     ['Expand all', function () { prefs.collapsed = {}; save(); apply(); }],
     ['Show everything', function () { prefs.hidden = {}; prefs.collapsed = {}; save(); rebuildChecks(); apply(); }]].forEach(function (b) {
      var e = $('button', '', b[0]); e.type = 'button'; e.addEventListener('click', b[1]); tools.appendChild(e);
    });
    dr.appendChild(tools);
    dr.appendChild($('p', 'bf-hint', 'Your choices are remembered on this device.'));
    function rebuildChecks() { Array.prototype.forEach.call(dr.querySelectorAll('input'), function (c) { c.checked = true; }); }
    function setOpen(o) { app.classList.toggle('bf-open', o); fab.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    fab.addEventListener('click', function () { setOpen(!app.classList.contains('bf-open')); });
    scrim.addEventListener('click', function () { setOpen(false); });
    x.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    app.appendChild(scrim); app.appendChild(dr); app.appendChild(fab);

    function toggleCollapse(id) { if (prefs.collapsed[id]) delete prefs.collapsed[id]; else prefs.collapsed[id] = 1; save(); apply(); }
    function apply() {
      cards.forEach(function (c) {
        var id = c.getAttribute('data-bf');
        c.hidden = !!prefs.hidden[id];
        var col = !!prefs.collapsed[id];
        c.classList.toggle('bf-collapsed', col);
        c.firstChild.setAttribute('aria-expanded', col ? 'false' : 'true');
      });
      var anyW = false;
      Array.prototype.forEach.call(app.querySelectorAll('.bf-w'), function (w) { var h = !!prefs.hidden[w.getAttribute('data-bf')]; w.hidden = h; if (!h) anyW = true; });
      if (wrap) wrap.hidden = !anyW;
      var hosts = document.querySelectorAll('.sd-host');
      if (hosts.length > 1) hosts[1].style.display = prefs.hidden[stripKey] ? 'none' : '';
    }

    /* ---------- styles ---------- */
    var css = document.createElement('style');
    css.textContent = CSS;
    document.head.appendChild(css);
    main.classList.add('bf-orig');
    main.parentNode.insertBefore(app, main);
    apply();
    [500, 1500, 3500].forEach(function (t) { setTimeout(apply, t); });   // the schedule strip arrives a moment later
    if (location.hash && document.querySelector(location.hash)) document.querySelector(location.hash).scrollIntoView();
  }

  var CSS = [
    '.bf-orig{display:none!important}',
    '.bf{--c-card:var(--card,#181b22);--c-text:var(--text,#e8eaef);--c-mute:var(--muted,#9aa3b2);--c-acc:var(--accent,#f5c542);--c-link:var(--link,#7db4ff);',
    '--c-line:color-mix(in srgb,var(--c-mute) 26%,transparent);max-width:44rem;margin:0 auto;padding:1.1rem 1rem 6.5rem;color:var(--c-text);',
    'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}',
    '.bf *{box-sizing:border-box}.bf [hidden]{display:none!important}',
    '.bf-hero{margin:.4rem 0 1.1rem}.bf-kicker{color:var(--c-acc);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem}',
    '.bf-title{font-size:1.9rem;line-height:1.15;margin:.3rem 0 .4rem;letter-spacing:-.01em}.bf-sub{margin:0;color:var(--c-mute);font-size:.88rem}',
    '.bf-widgets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin:0 0 1.2rem}',
    '@media(min-width:40rem){.bf-widgets{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '.bf-w{background:var(--c-card);border:1px solid var(--c-line);border-radius:18px;padding:.85rem .95rem;min-width:0;position:relative;overflow:hidden}',
    '.bf-w:before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:var(--bar,var(--c-acc));opacity:.9}',
    '.bf-w-rain{--bar:#4aa3ff}.bf-w-aqi{--bar:#2fbf71}.bf-w-power{--bar:#f5a524}.bf-w-soi{--bar:#14b8a6}.bf-w-fgc{--bar:#a78bfa}.bf-w-misc{--bar:#94a3b8}',
    '.bf-wide{grid-column:1/-1}',
    '.bf-wh{display:flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--c-mute);margin:.15rem 0 .35rem}',
    '.bf-wi{font-size:1rem}.bf-wt{font-size:.86rem;line-height:1.4;color:var(--c-text);overflow-wrap:anywhere}.bf-wt a{color:var(--c-link)}',
    '.bf-big{font-size:2.3rem;font-weight:750;line-height:1;letter-spacing:-.02em}.bf-big small{font-size:1.1rem;font-weight:650;color:var(--c-mute);margin-left:.1rem}',
    '.bf-meter{height:6px;border-radius:99px;background:color-mix(in srgb,var(--c-mute) 22%,transparent);margin:.55rem 0 .5rem;overflow:hidden}.bf-meter i{display:block;height:100%;background:#4aa3ff;border-radius:99px}',
    '.bf-aqi{display:flex;gap:.7rem;align-items:center}.bf-ring{flex:none;width:3.6rem;height:3.6rem;border-radius:50%;display:grid;place-items:center;font-weight:750;font-size:1.25rem;border:5px solid var(--ring);background:color-mix(in srgb,var(--ring) 14%,transparent)}',
    '.bf-aqi b{font-size:.84rem;line-height:1.2;display:block;margin-bottom:.15rem}',
    '.bf-chip{display:inline-block;font-size:.8rem;font-weight:700;border-radius:99px;padding:.18rem .7rem;margin:.1rem 0 .45rem}',
    '.bf-chip.ok{background:color-mix(in srgb,#2fbf71 22%,transparent);color:#2fbf71}.bf-chip.warn{background:color-mix(in srgb,#f5a524 24%,transparent);color:#d98a00}',
    '.bf-list{display:flex;flex-direction:column;gap:.75rem}',
    '.bf-card{background:var(--c-card);border:1px solid var(--c-line);border-radius:18px;overflow:hidden;scroll-margin-top:4.5rem}',
    '.bf-ch{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:.6rem;width:100%;padding:.9rem 1rem;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.bf-ch:focus-visible{outline:2px solid var(--c-acc);outline-offset:-2px;border-radius:18px}',
    '.bf-ci{font-size:1.25rem}.bf-ct{flex:1;font-size:1.05rem;font-weight:700}',
    '.bf-cn{font-size:.72rem;font-weight:700;color:var(--c-mute);background:color-mix(in srgb,var(--c-mute) 16%,transparent);border-radius:99px;padding:.1rem .55rem}',
    '.bf-cv{width:.55rem;height:.55rem;border-right:2px solid var(--c-mute);border-bottom:2px solid var(--c-mute);transform:rotate(45deg);transition:transform .18s;margin:0 .2rem .25rem .1rem}',
    '.bf-collapsed .bf-cv{transform:rotate(-45deg);margin:0 .2rem 0 .1rem}.bf-collapsed .bf-cb{display:none}',
    '.bf-cb{padding:0 1rem .4rem}',
    '.bf-item{padding:.8rem 0;border-top:1px solid var(--c-line)}.bf-item:first-child{border-top:1px solid var(--c-line)}',
    '.bf-hl{font-weight:700;font-size:.98rem;line-height:1.3;margin-bottom:.25rem}',
    '.bf-body{font-size:.91rem;color:color-mix(in srgb,var(--c-text) 88%,var(--c-mute));overflow-wrap:anywhere}.bf-body a{color:var(--c-link)}.bf-body code{font-size:.88em}',
    '.bf-note .bf-body{font-style:italic;color:var(--c-mute)}',
    '.bf-src{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}',
    '.bf-src a{font-size:.72rem;text-decoration:none;color:var(--c-link);border:1px solid var(--c-line);border-radius:99px;padding:.12rem .6rem}',
    '.bf-foot{margin-top:1.4rem;color:var(--c-mute);font-size:.82rem}.bf-ai{background:var(--c-card);border:1px solid var(--c-line);border-radius:14px;padding:.7rem .9rem;margin-bottom:.8rem}',
    '.bf-foot a{color:var(--c-link)}.bf-foot p{margin:.3rem 0}',
    '.bf-fab{all:unset;box-sizing:border-box;position:fixed;right:1rem;bottom:1rem;z-index:40;display:flex;align-items:center;gap:.5rem;padding:.8rem 1.1rem;border-radius:99px;',
    'background:var(--c-acc);color:#1a1d24;font-weight:700;font-size:.92rem;box-shadow:0 6px 22px rgba(0,0,0,.35);cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}.bf-fab span{font-size:1.1rem}',
    '.bf-scrim{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s}',
    '.bf-open .bf-scrim{opacity:1;pointer-events:auto}',
    '.bf-drawer{position:fixed;z-index:70;top:0;bottom:0;right:0;width:min(21rem,88vw);background:var(--c-card);border-left:1px solid var(--c-line);transform:translateX(104%);transition:transform .22s ease;',
    'padding:1rem 1rem 2rem;overflow:auto;box-shadow:-8px 0 30px rgba(0,0,0,.3)}.bf-open .bf-drawer{transform:none}',
    '.bf-dh{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem;font-size:1.05rem}',
    '.bf-x{all:unset;box-sizing:border-box;width:2.6rem;height:2.6rem;display:grid;place-items:center;border-radius:12px;border:1px solid var(--c-line);cursor:pointer}',
    '.bf-drawer h3{margin:1.1rem 0 .4rem;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;color:var(--c-mute)}',
    '.bf-row{display:flex;align-items:center;gap:.7rem;padding:.55rem .2rem;font-size:.95rem;cursor:pointer;min-height:2.7rem}',
    '.bf-row input{width:1.25rem;height:1.25rem;accent-color:var(--c-acc);flex:none}.bf-row span{flex:1}',
    '.bf-jump{font-size:.78rem;color:var(--c-link);text-decoration:none;border:1px solid var(--c-line);border-radius:99px;padding:.15rem .65rem}',
    '.bf-tools{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:1.1rem}',
    '.bf-tools button{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid var(--c-line);border-radius:12px;padding:.6rem .85rem;font-size:.85rem;font-weight:600}',
    '.bf-hint{color:var(--c-mute);font-size:.78rem;margin:1rem 0 0}',
    '@media(prefers-reduced-motion:reduce){.bf-drawer,.bf-scrim,.bf-cv{transition:none}}'
  ].join('\n');
  try { build(); } catch (e) { if (window.console) console.warn('brief layer skipped:', e); }
})();
