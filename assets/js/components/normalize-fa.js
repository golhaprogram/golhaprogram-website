// Persian text normalization for search.
//
// Every rule either deletes a character or swaps it for exactly one other
// character, so we can keep a map from each position in the normalized text
// back to the original text. That map is what lets search match on the
// normalized form while highlighting the original, unmodified text.

// Characters removed entirely:
//   U+064B–U+065F  Arabic harakat (fatha, kasra, damma, tanvin, shadda, sukun…)
//   U+0670         superscript alef
//   U+0640         tatweel (kashida)
//   U+200C–U+200F  ZWNJ (nim-fasele), ZWJ, LRM, RLM
const REMOVE = /[ً-ٰٟـ‌-‏]/;

// One-to-one substitutions.
const MAP = {
  'ي': 'ی', 'ى': 'ی', 'ئ': 'ی',     // Arabic yeh / alef maksura / yeh with hamza → Persian yeh
  'ك': 'ک',                           // Arabic kaf → Persian kaf
  'ة': 'ه', 'ۀ': 'ه',                 // teh marbuta / heh with yeh above → heh
  'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا', 'آ': 'ا', // alef variants (incl. madda) → alef
  'ؤ': 'و',                           // waw with hamza → waw
  '-': ' ', '_': ' ',                 // slug separators (e.g. گل‌های-رنگارنگ) → space
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', // Persian digits
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', // Arabic-Indic digits
};

// Ezafe after a silent heh is written «خانهٔ» on the site (U+0654, removed
// above), but most people type «خانه‌ی» (heh, ZWNJ, yeh). So a yeh is also
// removed when it follows heh + ZWNJ and ends the word: «خانه‌ی» → «خانه»,
// the same as «خانهٔ» and «خانۀ». «الهی», «ماهی» (no ZWNJ) are untouched.
const HEH = /[هةۀ]/;
const YEH = /[یيى]/;
const LETTER = /\p{L}/u;
function isEzafeYeh(src, i) {
  return YEH.test(src[i]) && src[i - 1] === '‌' && HEH.test(src[i - 2] ?? '') &&
    !LETTER.test(src[i + 1] ?? '') && src[i + 1] !== '‌';
}

// Returns { text, map } where map[i] is the index in `input` of text[i].
export function normalizeWithMap(input) {
  const src = String(input ?? '');
  let text = '';
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (REMOVE.test(ch) || isEzafeYeh(src, i)) continue;
    const mapped = MAP[ch] ?? ch;
    const lower = mapped.toLowerCase();
    text += lower.length === 1 ? lower : mapped; // keep 1:1 so the map stays valid
    map.push(i);
  }
  return { text, map };
}

export function normalizeFa(input) {
  return normalizeWithMap(input).text;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Wraps every occurrence of any query term in <mark>, matching on the
// normalized form but returning the original text (HTML-escaped).
export function highlight(original, query) {
  const src = String(original ?? '');
  const terms = normalizeFa(query).split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return escapeHtml(src);

  const { text, map } = normalizeWithMap(src);
  const marked = new Array(src.length).fill(false);
  for (const term of terms) {
    let from = 0;
    let pos;
    while ((pos = text.indexOf(term, from)) !== -1) {
      const start = map[pos];
      // Also cover characters normalization dropped right after the match
      // (hamza above, harakat, ZWNJ + ezafe yeh), so a combining mark is never
      // split from its letter by </mark>.
      const next = pos + term.length;
      const end = next < map.length ? map[next] - 1 : src.length - 1;
      for (let k = start; k <= end; k++) marked[k] = true;
      from = pos + term.length;
    }
  }

  let out = '';
  let open = false;
  for (let i = 0; i < src.length; i++) {
    if (marked[i] && !open) { out += '<mark>'; open = true; }
    if (!marked[i] && open) { out += '</mark>'; open = false; }
    out += escapeHtml(src[i]);
  }
  if (open) out += '</mark>';
  return out;
}

// Index of the first occurrence (in the original text) of any query term,
// or -1. Used to centre the content snippet around a match.
export function firstMatchIndex(original, query) {
  const terms = normalizeFa(query).split(/\s+/).filter(t => t.length > 1);
  const { text, map } = normalizeWithMap(original);
  let best = -1;
  for (const term of terms) {
    const pos = text.indexOf(term);
    if (pos !== -1 && (best === -1 || map[pos] < best)) best = map[pos];
  }
  return best;
}
