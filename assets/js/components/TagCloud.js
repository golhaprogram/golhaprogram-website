/**
 * Tag cloud tabs. The cloud itself is rendered by Hugo
 * (layouts/partials/tag-cloud.html); this only switches tabs, with
 * arrow-key support. In RTL, ArrowLeft moves to the next tab.
 */
export function initializeTagCloud() {
  document.querySelectorAll('[data-tag-cloud]').forEach(cloud => {
    const tabs = Array.from(cloud.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function select(tab, focus) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', e => {
        let next = null;
        if (e.key === 'ArrowLeft') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowRight') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });
}

export default { initializeTagCloud };
