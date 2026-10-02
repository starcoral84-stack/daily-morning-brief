let SD = { days: [] }, DAYS = [], BY = {};
function setData(o) { SD = o; DAYS = o.days || []; BY = {}; DAYS.forEach(d => { BY[d.date] = d; }); }
const TYPES = {
  home:   { label: 'Student home',  short: 'Home',    cls: 't-home' },
  onsite: { label: 'Group on-site', short: 'On-site', cls: 't-onsite' },
  online: { label: 'Group online',  short: 'Online',  cls: 't-online' },
  office: { label: 'Office day',    short: 'Office',  cls: 't-office' },
  event:  { label: 'Event',         short: 'Event',   cls: 't-event' },
  other:  { label: 'Class',         short: 'Class',   cls: 't-other' }
};
const THAI = { Mon:'#FFD966', Tue:'#F4B6C2', Wed:'#93C47D', Thu:'#F6B26B', Fri:'#6FA8DC', Sat:'#B4A7D6', Sun:'#E06666' };
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function todayBkk() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()); }
function addDays(ds, n) { const p = ds.split('-').map(Number); return new Date(Date.UTC(p[0], p[1]-1, p[2]+n)).toISOString().slice(0,10); }
function parts(ds) { const p = ds.split('-').map(Number); const dt = new Date(Date.UTC(p[0], p[1]-1, p[2])); return { d: p[2], dow: DOW[dt.getUTCDay()], mon: MON[p[1]-1] }; }
function mins(t) { const p = t.split(':').map(Number); return p[0]*60 + p[1]; }
function f12(min) { min = ((min % 1440) + 1440) % 1440; let h = Math.floor(min/60); const m = min % 60; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2,'0') + ' ' + ap; }
let EVENTS = {};
function setEvents(list) {
  EVENTS = {};
  (Array.isArray(list) ? list : []).forEach(e => {
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || !e.name) return;
    (EVENTS[e.date] = EVENTS[e.date] || []).push(e);
  });
  Object.keys(EVENTS).forEach(k => EVENTS[k].sort((x, y) => (x.start || '').localeCompare(y.start || '')));
}
function loadEvents() {
  return fetch('/events.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []).then(l => { setEvents(l); return Object.keys(EVENTS).length > 0; });
}
function eventsFor(ds) { return EVENTS[ds] || []; }
function isWeekday(ds) { const d = parts(ds).dow; return d !== 'Sat' && d !== 'Sun'; }
function summary(day) {
  const c = (day && day.classes) || [];
  if (!c.length) {
    if (day && isWeekday(day.date)) return { office: true, first: 540, fin: 1080, start: 540, hrs: 0 };
    return null;
  }
  const first = Math.min.apply(null, c.map(x => mins(x.start)));
  const fin = Math.max.apply(null, c.map(x => mins(x.end)));
  const hrs = c.reduce((a, x) => a + mins(x.end) - mins(x.start), 0) / 60;
  return { first: first, fin: fin, start: fin - 540, hrs: hrs };
}
// What fills the day: real classes, or the office block on a no-class weekday.
function dayItems(day) {
  const s = summary(day);
  if (!s) return [];
  if (s.office) return [{ start: '09:00', end: '18:00', type: 'office', name: 'At the office' }];
  return day.classes;
}
function hrsLabel(h) { return (Math.round(h * 100) / 100) + ' h'; }
function chip(ds) { const p = parts(ds); return '<span class="sd-chip" style="background:' + THAI[p.dow] + '">' + p.dow + '</span>'; }
function dateLabel(ds) { const p = parts(ds); return p.dow + ' ' + p.d + ' ' + p.mon; }
function shortDate(ds) { const p = parts(ds); return p.d + ' ' + p.mon; }
function rng(a, b) { const x = f12(a), y = f12(b); return (x.slice(-2) === y.slice(-2) ? x.slice(0, -3) : x) + '–' + y; }
function evWhen(e) { return e.start && e.end ? rng(mins(e.start), mins(e.end)) : e.start ? f12(mins(e.start)) : 'All day'; }
function evWhere(e) { return [e.place, e.note].filter(Boolean).map(esc).join(' · '); }
function classLine(c) {
  const t = TYPES[c.type] || TYPES.other;
  return '<li class="sd-cl"><span class="sd-tm">' + f12(mins(c.start)) + ' – ' + f12(mins(c.end)) +
    '</span><span class="sd-pill ' + t.cls + '">' + t.label + '</span><span class="sd-nm">' + esc(c.name) + '</span></li>';
}
function eventLine(e) {
  const w = evWhere(e);
  return '<li class="sd-cl"><span class="sd-tm">' + (e.start && e.end ? f12(mins(e.start)) + ' – ' + f12(mins(e.end)) : evWhen(e)) +
    '</span><span class="sd-pill t-event">Event</span><span class="sd-nm">' + esc(e.name) + (w ? ' <span class="sd-foot">· ' + w + '</span>' : '') + '</span></li>';
}
function miniItem(c) { const t = TYPES[c.type] || TYPES.other;
  return '<li><span class="sd-mtm">' + rng(mins(c.start), mins(c.end)) + '</span><span class="sd-pill ' + t.cls + '">' + t.short + '</span><span class="sd-nm">' + esc(c.name) + '</span></li>'; }
function miniEvent(e) { const w = evWhere(e);
  return '<li><span class="sd-mtm">' + evWhen(e) + '</span><span class="sd-pill t-event">Event</span><span class="sd-nm">' + esc(e.name) + (w ? ' <span class="sd-foot">· ' + w + '</span>' : '') + '</span></li>'; }
function dayCard(ds, rel, today) {
  const day = BY[ds], s = summary(day), ev = eventsFor(ds);
  let h = '<section class="sd-day' + (ds === today ? ' is-today' : '') + '"><div class="sd-head">' + chip(ds) +
    '<span class="sd-date">' + shortDate(ds) + '</span>' + (rel ? '<span class="sd-rel">' + rel + '</span>' : '') + '</div>';
  if (s) {
    h += '<div class="sd-tiles"><div class="sd-tile alarm"><span>⏰ Start</span><b>' + f12(s.start) + '</b></div>' +
      '<div class="sd-tile"><span>' + (s.office ? 'Where' : 'First class') + '</span><b>' + (s.office ? 'Office' : f12(s.first)) + '</b></div>' +
      '<div class="sd-tile alarm"><span>⏰ Finish</span><b>' + f12(s.fin) + '</b></div></div>';
  } else if (!ev.length) {
    return h + '<p class="sd-rest">' + (day ? 'Free day – no classes.' : 'Not in the schedule yet.') + '</p></section>';
  } else {
    h += '<p class="sd-rest">' + (day ? 'Free day – no classes.' : 'Not in the schedule yet.') + '</p>';
  }
  h += '<ul class="sd-list">' + dayItems(day).map(classLine).join('') + ev.map(eventLine).join('') + '</ul></section>';
  return h;
}
function miniRow(ds, today) {
  const day = BY[ds], s = summary(day), ev = eventsFor(ds);
  const cls = ds === today ? ' is-today' : '';
  if (!s && !ev.length) {
    return '<div class="sd-row is-rest' + cls + '">' + chip(ds) + '<div class="sd-main"><span class="sd-date">' + shortDate(ds) + '</span> <span class="sd-foot">· free</span></div></div>';
  }
  const items = dayItems(day).map(miniItem).join('') + ev.map(miniEvent).join('');
  const side = s ? '<div class="sd-side"><div><small>Start</small> <b>' + f12(s.start) + '</b></div><div><small>Finish</small> <b>' + f12(s.fin) + '</b></div></div>' : '';
  return '<div class="sd-row' + cls + '">' + chip(ds) + '<div class="sd-main"><span class="sd-date">' + shortDate(ds) +
    '</span><ul class="sd-mini">' + items + '</ul></div>' + side + '</div>';
}
function mondayOf(ds) { const p = parts(ds); const back = (DOW.indexOf(p.dow) + 6) % 7; return addDays(ds, -back); }
function updatedLabel() {
  if (!SD.updated) return '';
  const p = SD.updated.slice(0, 10);
  return 'Schedule last changed ' + dateLabel(p);
}

const TABS = /*__TABS__*/[];
function visibleTabs() {
  return Promise.all(TABS.map(t => t.optional
    ? fetch(t.href, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok ? t : null).catch(() => null)
    : Promise.resolve(t))).then(a => a.filter(Boolean));
}
function tabsHTML(tabs, here, cls) {
  return tabs.map(t => '<a class="' + cls + '" href="' + t.href + '"' + (t.href === here ? ' aria-current="page"' : '') + '>' + esc(t.label) + '</a>').join('');
}
