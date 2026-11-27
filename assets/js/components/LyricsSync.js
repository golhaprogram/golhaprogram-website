// «همراهی با شعر»: highlights the line being sung while the program plays.
//
// A program with timed lyrics has a WebVTT file next to its Markdown file
// (e.g. 100.vtt for 100.md, made with https://github.com/golhaprogram/hamahang).
// layouts/partials/audio-player.html adds it to the <audio> as a metadata
// <track>, so the browser parses it and fires cuechange as the audio plays.
//
// Here each rendered lyric line (a <p>, split at its <br>s) is wrapped in a
// <span class="lyric-line">, and the cues are matched to those lines by text,
// in order. Labels such as «(مولوی)» simply match no cue.
//
// While following is on: the current line is highlighted and scrolled into
// view (unless the reader scrolled by hand in the last few seconds), and
// tapping a line plays from it. The choice is remembered in localStorage.

const STORAGE_KEY = 'golha:lyricsFollow';
const MANUAL_SCROLL_PAUSE_MS = 5000;

// Compare lines ignoring spacing, nim-fasele, punctuation, diacritics and
// Arabic ي/ك, so small spelling fixes in the .md don't break the match.
function norm(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Wrap each line of the lyrics in a span; returns the spans in order.
function wrapLines(container) {
  const lines = [];
  container.querySelectorAll(':scope > p').forEach((p) => {
    const groups = [[]];
    [...p.childNodes].forEach((node) => {
      if (node.nodeName === 'BR') groups.push([]);
      else groups[groups.length - 1].push(node);
    });
    groups.forEach((nodes) => {
      if (!nodes.some((n) => n.textContent.trim())) return;
      const span = document.createElement('span');
      span.className = 'lyric-line';
      nodes[0].before(span);
      nodes.forEach((n) => span.append(n));
      lines.push(span);
    });
  });
  return lines;
}

// Pair each cue with a line, in order, looking a few lines ahead for a match.
function matchCues(cues, lines) {
  const keys = lines.map((l) => norm(l.textContent));
  const pairs = new Map(); // cue -> line
  let from = 0;
  for (const cue of cues) {
    const k = norm(cue.text);
    if (!k) continue;
    for (let i = from; i < Math.min(lines.length, from + 8); i++) {
      if (keys[i] === k) {
        pairs.set(cue, lines[i]);
        lines[i].dataset.start = cue.startTime;
        from = i + 1;
        break;
      }
    }
  }
  return pairs;
}

function whenCuesReady(trackEl) {
  const track = trackEl.track;
  track.mode = 'hidden'; // load and fire cuechange, but draw nothing
  if (track.cues && track.cues.length) return Promise.resolve(track);
  return new Promise((resolve, reject) => {
    trackEl.addEventListener('load', () => resolve(track), { once: true });
    trackEl.addEventListener('error', () => reject(new Error('Could not load ' + trackEl.src)), { once: true });
  });
}

export async function initializeLyricsSync() {
  const player = document.querySelector('.audio-player[data-lyrics-sync]');
  const content = document.querySelector('.program .content');
  if (!player || !content) return;
  const audio = player.querySelector('audio');
  const trackEl = audio.querySelector('track');
  const toggle = player.querySelector('.lyrics-follow');

  const track = await whenCuesReady(trackEl);
  const lines = wrapLines(content);
  const pairs = matchCues([...track.cues], lines);
  if (pairs.size === 0) return;

  let follow = true;
  try { follow = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch {}
  let active = null;
  let manualScrollAt = 0;

  const setFollow = (on) => {
    follow = on;
    toggle.setAttribute('aria-pressed', String(on));
    content.classList.toggle('lyrics-following', on);
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
    if (!on) setActive(null);
    else update();
  };

  const setActive = (line) => {
    if (line === active) return;
    active?.classList.remove('is-active');
    active = line;
    if (!line) return;
    line.classList.add('is-active');
    if (!audio.paused && Date.now() - manualScrollAt > MANUAL_SCROLL_PAUSE_MS) scrollToLine(line);
  };

  // Put the line about a third of the way down the space under the sticky player.
  const scrollToLine = (line) => {
    const playerBottom = Math.max(0, player.getBoundingClientRect().bottom);
    const free = window.innerHeight - playerBottom;
    const r = line.getBoundingClientRect();
    if (r.top > playerBottom + free * 0.15 && r.bottom < window.innerHeight - free * 0.25) return;
    const target = window.scrollY + r.top - playerBottom - free / 3;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  };

  const update = () => {
    if (!follow) return;
    const cue = [...track.activeCues].find((c) => pairs.has(c));
    setActive(cue ? pairs.get(cue) : null);
  };

  track.addEventListener('cuechange', update);

  ['wheel', 'touchmove', 'keydown'].forEach((type) =>
    window.addEventListener(type, (e) => {
      if (type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
      manualScrollAt = Date.now();
    }, { passive: true })
  );

  content.addEventListener('click', (e) => {
    if (!follow) return;
    const line = e.target.closest('.lyric-line[data-start]');
    if (!line || e.target.closest('a')) return;
    audio.currentTime = parseFloat(line.dataset.start);
    manualScrollAt = 0;
    audio.play().catch(() => {});
  });

  toggle.addEventListener('click', () => setFollow(!follow));
  toggle.hidden = false;
  setFollow(follow);
}
