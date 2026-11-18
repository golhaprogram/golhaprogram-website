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

export function initializeSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  // If elements don't exist, return early
  if (!searchInput || !searchResults) {
    return;
  }

  let searchData = [];
  let fuse;

  fetch('/index.json')
    .then(response => response.json())
    .then(data => {
      searchData = data;
      fuse = new Fuse(data.map(normalizeRecord), {
        keys: SEARCH_KEYS,
        includeScore: true,
        includeMatches: true,
        // Token search: each word of the query is matched separately, in any
        // field, and every word must match (tokenMatch: 'all'). So
        // "حمیرا شور" finds Homeyra's programs in Shur, and
        // "گلهای رنگارنگ ۴۶۵" finds program 465.
        useTokenSearch: true,
        tokenMatch: 'all',
        threshold: 0.15,
        minMatchCharLength: 2,
      });
      // If the visitor typed before the index loaded, run their query now.
      if (searchInput.value.trim()) runSearch();
    })
    .catch(err => {
      console.error('Error fetching search index:', err);
    });

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

    if (results.length > 0) {
      searchResults.innerHTML = results.map(r => renderResult(r, query)).join('');
    } else {
      searchResults.innerHTML = '<div class="no-results">نتیجه‌ای یافت نشد</div>';
    }
    searchResults.style.display = 'block';
  }

  let timer;
  searchInput.addEventListener('input', function () {
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
