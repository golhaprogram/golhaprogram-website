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
// While following is on: the current line is highlighted and kept in view.
// If the reader scrolls by hand, following waits 5 seconds, then brings the
// current line back, but only if the lyrics still fill a good part of the
// screen (not if they've gone off to the credits or comments). Once the
// comments reach the middle of the screen, nothing pulls the reader back, not
// even a new line starting, and never while they're typing (a comment in the remark42 iframe, the search box).
// Seeking always jumps to the line, even while paused. And
// tapping a line plays from it. Between lines, while only the music plays,
// a thin bar sits where the text is waiting (before the next line, or after
// the last one) and fills up as the gap goes by. The choice is remembered in
// localStorage.

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

  // Matched cues in time order, for finding the gap the music is in.
  const timeline = [...pairs]
    .map(([cue, line]) => ({ start: cue.startTime, end: cue.endTime, line }))
    .sort((a, b) => a.start - b.start);

  const gap = document.createElement('span');
  gap.className = 'music-gap';
  gap.setAttribute('aria-hidden', 'true');
  gap.innerHTML = '<span class="music-gap-bar"><span class="music-gap-fill"></span></span>';
  const gapFill = gap.querySelector('.music-gap-fill');

  let follow = true;
  try { follow = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch {}
  let active = null;
  let started = false;
  let manualScrollAt = 0;

  const setFollow = (on) => {
    follow = on;
    toggle.setAttribute('aria-pressed', String(on));
    content.classList.toggle('lyrics-following', on);
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
    if (!on) {
      setActive(null);
      gap.remove();
    } else update();
  };

  const setActive = (line) => {
    if (line === active) return;
    active?.classList.remove('is-active');
    active = line;
    if (!line) return;
    line.classList.add('is-active');
    autoScroll(line);
  };

  const handsOff = () => Date.now() - manualScrollAt > MANUAL_SCROLL_PAUSE_MS;

  const autoScroll = (el) => {
    if (!audio.paused && handsOff() && !typing() && !inComments()) scrollToLine(el);
  };

  // The line being sung, or the music bar while the text waits.
  const target = () => active || (gap.isConnected ? gap : null);

  // Do the lyrics fill at least 40% of the screen below the player? If the
  // reader went off to the credits or the comments, don't pull them back.
  const lyricsOnScreen = () => {
    const r = content.getBoundingClientRect();
    const top = Math.max(0, player.getBoundingClientRect().bottom);
    const bottom = window.innerHeight;
    const shown = Math.min(r.bottom, bottom) - Math.max(r.top, top);
    return shown >= (bottom - top) * 0.4;
  };

  // Did the reader scroll down to the comments themselves (the comments reach
  // above the middle of the screen when their scrolling stops)? Then nothing,
  // not even a new line starting, pulls them back up until they scroll back,
  // seek or tap a line. Only the reader's own scrolling counts: following the
  // last lines can bring the comments up too.
  const comments = document.querySelector('.comments-section');
  const commentsUp = () => {
    if (!comments) return false;
    const top = Math.max(0, player.getBoundingClientRect().bottom);
    return comments.getBoundingClientRect().top < (top + window.innerHeight) / 2;
  };
  let parked = false;
  window.addEventListener('scroll', () => {
    if (Date.now() - manualScrollAt < 1500) parked = commentsUp();
  }, { passive: true });
  const inComments = () => parked;

  // Focus in a text field, or in an iframe (the remark42 comment box lives in
  // one, so its keystrokes never reach this page): the reader is typing.
  const typing = () => {
    const el = document.activeElement;
    return !!el && (el.tagName === 'IFRAME' || el.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  };

  // Music only: put the bar where the text is waiting and fill it by how far
  // through the gap we are.
  const showGap = (t) => {
    if (!started) return gap.remove();
    const i = timeline.findIndex((c) => c.start > t);
    const next = i === -1 ? null : timeline[i];
    const prev = i === -1 ? timeline[timeline.length - 1] : timeline[i - 1];
    const from = prev ? Math.min(prev.end, t) : 0;
    const to = next ? next.start : (isFinite(audio.duration) ? audio.duration : t);
    const frac = to > from ? (t - from) / (to - from) : 1;
    gapFill.style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
    const moved = next ? gap.nextElementSibling !== next.line : gap.previousElementSibling !== prev.line;
    if (moved) {
      if (next) next.line.before(gap);
      else prev.line.after(gap);
      autoScroll(gap);
    }
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
    const t = audio.currentTime;
    const cue = [...track.activeCues].find((c) => pairs.has(c));
    setActive(cue ? pairs.get(cue) : null);
    if (cue) gap.remove();
    else showGap(t);
    // Bring the current line back after a manual scroll (scrollToLine does
    // nothing if it's already comfortably in view).
    const el = target();
    if (el && !audio.paused && handsOff() && !typing() && !inComments() && lyricsOnScreen()) scrollToLine(el);
  };

  track.addEventListener('cuechange', update);
  audio.addEventListener('timeupdate', update);
  audio.addEventListener('play', () => {
    started = true;
    content.classList.add('is-playing');
    update();
  });
  audio.addEventListener('pause', () => content.classList.remove('is-playing'));
  // Seeking (the progress bar, or tapping a line) always shows where you are.
  audio.addEventListener('seeked', () => {
    if (!follow) return;
    started = true;
    manualScrollAt = 0;
    parked = false;
    update();
    const el = target();
    if (el) scrollToLine(el);
  });

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
