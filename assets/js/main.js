// Import our component modules
import { initializeTagCloud } from './components/TagCloud.js';
import { initializeSearch } from './components/Search.js';

// Main initialization function
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing components');
  
  // Initialize tag cloud
  try {
    initializeTagCloud();
  } catch (err) {
    console.error('Error initializing tag cloud:', err);
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
