// «این ماه در گلهای رنگارنگ» (layouts/partials/this-month.html): shows the
// programs whose estimated air month is the reader's current Solar month.

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

export function initializeThisMonth() {
  document.querySelectorAll('.this-month').forEach(section => {
    const data = JSON.parse(section.querySelector('.tm-data').textContent || '[]');
    const now = today();
    const items = data.filter(p => p.m === now.m);
    if (!items.length) return;

    section.querySelector('.tm-month').textContent = MONTHS[now.m - 1];
    const list = section.querySelector('.tm-list');
    const years = [...new Set(items.map(p => p.y))].sort((a, b) => a - b);

    years.forEach(y => {
      const group = el('div', { class: 'tm-year' });
      group.appendChild(el('h3', {}, `${MONTHS[now.m - 1]} ${fa(y)}`));
      group.lastChild.appendChild(el('span', { class: 'tm-ago' }, ` (${fa(now.y - y)} سال پیش)`));
      const ul = el('ul');
      items.filter(p => p.y === y).forEach(p => {
        const li = el('li');
        li.appendChild(el('a', { href: p.url }, p.title));
        if (p.singers) li.appendChild(el('span', { class: 'tm-singers' }, ` · ${p.singers}`));
        if (p.exact && Math.abs(p.exact - now.d) <= 3) {
          li.appendChild(el('span', { class: 'tm-week' }, 'همین هفته'));
        }
        ul.appendChild(li);
      });
      group.appendChild(ul);
      list.appendChild(group);
    });
    section.hidden = false;
  });
}
