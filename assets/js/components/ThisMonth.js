// «این هفته در گلهای رنگارنگ» (layouts/partials/this-month.html).
//
// For each year, picks the program that aired at about this point of the
// current Solar month. Programs aired in number order, so the week of the
// month (days 1-7, 8-14, 15-21, 22-end) picks a program by its position among
// that year's programs for the month: with four programs, one per week; with
// two, the first for weeks 1-2 and the second for weeks 3-4; week 1 is always
// the first and week 4 always the last.
// The whole month is listed under a collapsed «همه‌ی برنامه‌های …».

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

// Today's Solar Hijri year, month and day, from the browser's calendar support.
function today() {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const get = type => parseInt(parts.find(p => p.type === type).value, 10);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}

function programItem(p, now, withYear) {
  const li = el('li');
  if (withYear) {
    li.appendChild(el('span', { class: 'tm-year-label' }, `${fa(p.y)} (${fa(now.y - p.y)} سال پیش): `));
  }
  li.appendChild(el('a', { href: p.url }, p.title));
  if (p.singers) li.appendChild(el('span', { class: 'tm-singers' }, ` · ${p.singers}`));
  return li;
}

// The program for this week among one year's programs (already in order).
function pickForWeek(programs, now) {
  const week = Math.min(4, Math.floor((now.d - 1) / 7) + 1);
  return programs[Math.round(((week - 1) * (programs.length - 1)) / 3)];
}

export function initializeThisMonth() {
  document.querySelectorAll('.this-month').forEach(section => {
    const data = JSON.parse(section.querySelector('.tm-data').textContent || '[]');
    const now = today();
    const items = data.filter(p => p.m === now.m).sort((a, b) => a.k - b.k);
    if (!items.length) return;

    section.querySelectorAll('.tm-month').forEach(s => { s.textContent = MONTHS[now.m - 1]; });
    const years = [...new Set(items.map(p => p.y))].sort((a, b) => b - a); // latest year first

    const weekList = section.querySelector('.tm-week-list');
    years.forEach(y => {
      weekList.appendChild(programItem(pickForWeek(items.filter(p => p.y === y), now), now, true));
    });

    const list = section.querySelector('.tm-list');
    years.forEach(y => {
      const group = el('div', { class: 'tm-year' });
      group.appendChild(el('h3', {}, `${MONTHS[now.m - 1]} ${fa(y)}`));
      group.lastChild.appendChild(el('span', { class: 'tm-ago' }, ` (${fa(now.y - y)} سال پیش)`));
      const ul = el('ul');
      items.filter(p => p.y === y).forEach(p => ul.appendChild(programItem(p, now, false)));
      group.appendChild(ul);
      list.appendChild(group);
    });
    section.hidden = false;
  });
}
