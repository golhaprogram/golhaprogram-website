import Fuse from 'fuse.js';
import { normalizeFa, highlight, firstMatchIndex } from './normalize-fa.js';

// Fields that are searched. Each is normalized (see normalize-fa.js) into a
// parallel copy of the index, so "حبیب‌الله" matches "حبیبالله", "ياحقي"
// matches "یاحقی", "465" matches "۴۶۵", and so on. Results are mapped back to
// the original records for display.
const SEARCH_KEYS = [
  { name: 'program_number', weight: 1.0 },
  { name: 'title', weight: 1.0 },
  { name: 'program_type', weight: 0.8 },
  { name: 'singers', weight: 0.7 },
  { name: 'players', weight: 0.7 },
  { name: 'composers', weight: 0.7 },
  { name: 'poets', weight: 0.7 },
  { name: 'announcers', weight: 0.7 },
  { name: 'dastgah', weight: 0.6 },
  { name: 'content', weight: 0.5 },
];

const FIELD_LABELS = {
  title: 'عنوان',
  program_type: 'نوع برنامه',
  program_number: 'شماره برنامه',
  dastgah: 'دستگاه',
  singers: 'خواننده',
  players: 'نوازنده',
  announcers: 'گوینده',
  composers: 'آهنگساز',
  poets: 'شاعر',
  content: 'محتوا',
};

const MAX_RESULTS = 10;
const MAX_ARTISTS = 3;
const MAX_SNIPPETS = 3;
const DEBOUNCE_MS = 150;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function normalizeRecord(rec) {
  const out = {};
  for (const { name } of SEARCH_KEYS) {
    const v = rec[name];
    out[name] = Array.isArray(v) ? v.map(normalizeFa) : (v == null ? v : normalizeFa(v));
  }
  return out;
}

function renderSnippet(item, match, query) {
  const key = match.key;
  const label = FIELD_LABELS[key] || key;
  const original = item[key];
  if (original == null) return null;

  // Array fields (singers, poets, …): show the full list, highlight the hit.
  if (Array.isArray(original)) {
    return `<div class="match-snippet"><strong>${label}:</strong> ${highlight(original.join('، '), query)}</div>`;
  }

  let text = String(original);
  if (key === 'content' && text.length > 150) {
    const pos = Math.max(0, firstMatchIndex(text, query));
    const start = Math.max(0, pos - 40);
    const end = Math.min(text.length, pos + 100);
    text = text.substring(start, end);
    return `<div class="match-snippet"><strong>${label}:</strong> ${start > 0 ? '...' : ''}${highlight(text, query).replace(/\n/g, '<br>')}${end < String(original).length ? '...' : ''}</div>`;
  }
  return `<div class="match-snippet"><strong>${label}:</strong> ${highlight(text, query).replace(/\n/g, '<br>')}</div>`;
}

function renderResult(result, query) {
  const item = result.item;
  const seen = new Set();
  const snippets = [];
  for (const match of result.matches || []) {
    if (seen.has(match.key)) continue; // one snippet per field
    seen.add(match.key);
    const html = renderSnippet(item, match, query);
    if (html) snippets.push(html);
    if (snippets.length >= MAX_SNIPPETS) break;
  }

  const programType = String(item.program_type || '').replace(/-/g, ' ');
  return `
                  <div class="search-result-item">
                  <a href="${escapeHtml(item.permalink)}">
                  <h3>${escapeHtml(programType)} ${escapeHtml(item.program_number || '')}</h3>
                  <div class="search-meta">
                  ${item.dastgah ? `<span>دستگاه: ${escapeHtml(item.dastgah)}</span>` : ''}
                  ${item.singers && item.singers.length ? `<span>خواننده: ${escapeHtml(item.singers.join('، '))}</span>` : ''}
                  </div>
                  ${snippets.length
                    ? `<div class="match-highlights">${snippets.join('')}</div>`
                    : '<div class="match-highlights">محل تطابق جستجو نشان داده نشد</div>'}
                  </a>
                  </div>
`;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const faNum = n => String(n).replace(/\d/g, d => FA_DIGITS[d]);

// Artist (and dastgah) pages whose name matches the query, shown as links
// above the program results. A name matches when the whole query is the
// start of the name or of one of its words ("هاید" → هایده, "یاحقی" →
// پرویز یاحقی), or, for a multi-word query, when one of its words is a whole
// name ("حمیرا یاحقی" → حمیرا). Exact names come first, then the most
// programs.
function findArtists(terms, query) {
  const q = normalizeFa(query).trim().replace(/\s+/g, ' ');
  if (q.length < 3) return [];
  const words = new Set(q.split(' ').filter(w => w.length > 1));
  const hits = [];
  for (const t of terms) {
    const exact = t.norm === q;
    if (exact || t.norm.startsWith(q) || t.norm.includes(' ' + q) ||
        (words.size > 1 && words.has(t.norm))) {
      hits.push({ t, exact });
    }
  }
  hits.sort((a, b) => (b.exact - a.exact) || (b.t.c - a.t.c));
  return hits.slice(0, MAX_ARTISTS).map(h => h.t);
}

function renderArtists(artists) {
  if (!artists.length) return '';
  return `<div class="search-artists">${artists.map(t => `
    <a class="search-artist" href="${escapeHtml(t.u)}">
      <span class="search-artist-role">${escapeHtml(t.r)}</span>
      <span class="search-artist-name">${escapeHtml(t.n)}</span>
      <span class="search-artist-count">${faNum(t.c)} برنامه</span>
    </a>`).join('')}</div>`;
}

// Optional dismissible tip above the search box (see params.searchTip).
function setupSearchTip(searchInput) {
  const tip = document.querySelector('.search-tip');
  if (!tip) return;
  const key = 'searchTipDismissed:' + tip.dataset.tipId;
  const expires = Date.parse(tip.dataset.expires);
  let dismissed = false;
  try { dismissed = localStorage.getItem(key) === '1'; } catch (e) { /* storage unavailable */ }
  if (dismissed || (expires && Date.now() > expires)) return;
  tip.hidden = false;

  tip.querySelector('.search-tip-close')?.addEventListener('click', () => {
    tip.hidden = true;
    try { localStorage.setItem(key, '1'); } catch (e) { /* storage unavailable */ }
  });
  tip.querySelector('.search-tip-example')?.addEventListener('click', (e) => {
    searchInput.value = e.currentTarget.textContent.trim();
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
  });
}

export function initializeSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  // If elements don't exist, return early
  if (!searchInput || !searchResults) {
    return;
  }

  setupSearchTip(searchInput);

  let searchData = [];
  let terms = [];
  let fuse;

  // The index (~1.1 MB, ~260 KB compressed) is only downloaded once the
  // visitor shows interest in searching, not on every page view.
  let loading = null;
  function loadIndex() {
    if (loading) return loading;
    // Artist links are a bonus: if this small file fails, search still works.
    fetch('/search-terms.json')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        terms = data.map(t => ({ ...t, norm: normalizeFa(t.n) }));
        if (fuse && searchInput.value.trim()) runSearch();
      })
      .catch(() => {});
    loading = fetch('/index.json')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(data => {
        searchData = data;
        fuse = new Fuse(data.map(normalizeRecord), {
          keys: SEARCH_KEYS,
          includeScore: true,
          includeMatches: true,
          // Token search: each word of the query is matched separately, in
          // any field, and every word must match (tokenMatch: 'all'). So
          // "حمیرا شور" finds Homeyra's programs in Shur, and
          // "گلهای رنگارنگ ۴۶۵" finds program 465.
          useTokenSearch: true,
          tokenMatch: 'all',
          threshold: 0.15,
          minMatchCharLength: 2,
        });
        // If the visitor typed while the index was loading, run it now.
        if (searchInput.value.trim()) runSearch();
      })
      .catch(err => {
        console.error('Error fetching search index:', err);
        loading = null; // allow a retry on the next interaction
      });
    return loading;
  }

  // Start loading as early as possible in the interaction: on touch/click
  // or keyboard focus, before the first character is typed.
  searchInput.addEventListener('pointerdown', loadIndex, { passive: true });
  searchInput.addEventListener('focus', loadIndex);
  // A browser may restore the box's text on back/forward navigation.
  if (searchInput.value.trim()) loadIndex();

  function runSearch() {
    const query = searchInput.value.trim();

    if (!query) {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }
    if (!fuse) return;

    const results = fuse
      .search(normalizeFa(query), { limit: MAX_RESULTS })
      .map(r => ({ ...r, item: searchData[r.refIndex] }));

    const artists = renderArtists(findArtists(terms, query));
    if (results.length > 0) {
      searchResults.innerHTML = artists + results.map(r => renderResult(r, query)).join('');
    } else {
      searchResults.innerHTML = artists + '<div class="no-results">نتیجه‌ای یافت نشد</div>';
    }
    searchResults.style.display = 'block';
  }

  let timer;
  searchInput.addEventListener('input', function () {
    loadIndex();
    clearTimeout(timer);
    timer = setTimeout(runSearch, DEBOUNCE_MS);
  });

  // Hide search results when clicking outside
  document.addEventListener('click', function (e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}
