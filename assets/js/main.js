// Import our component modules
import { initializeTagCloud } from './components/TagCloud.js';
import { initializeSearch } from './components/Search.js';

// Main initialization function
document.addEventListener('DOMContentLoaded', function() {
  // Initialize tag cloud
  try {
    initializeTagCloud();
  } catch (err) {
    console.error('Error initializing tag cloud:', err);
  }
  
  // Header menus (<details>): one open at a time; close on outside tap/Esc.
  try {
    const menus = document.querySelectorAll('.nav-menu');
    menus.forEach(m => m.addEventListener('toggle', () => {
      if (m.open) menus.forEach(o => { if (o !== m) o.open = false; });
    }));
    document.addEventListener('click', e => {
      menus.forEach(m => { if (m.open && !m.contains(e.target)) m.open = false; });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') menus.forEach(m => { m.open = false; });
    });
  } catch (err) {
    console.error('Error initializing header menus:', err);
  }

  // Initialize search
  try {
    initializeSearch();
  } catch (err) {
    console.error('Error initializing search:', err);
  }
});

// Global error handler to catch uncaught exceptions
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', {
    message,
    source,
    lineno,
    colno,
    stack: error?.stack
  });
  return false;
};
