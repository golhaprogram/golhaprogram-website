// The program page's audio player sticks to the top while the lyrics scroll
// (position: sticky in _audio-player.scss). Once it's stuck, it gets
// .is-stuck: a compact layout with a one-line title («گل‌های رنگارنگ ۱۰۰ ·
// مرضیه · ماهور») so you can still see what's playing.

export function initializeStickyPlayer() {
  const player = document.querySelector('.program .audio-player');
  const sentinel = document.querySelector('.program .audio-player-sentinel');
  if (!player || !sentinel || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    // The sentinel sits just above the player: once it has scrolled out of
    // the top of the viewport, the player is stuck.
    player.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(sentinel);
}
