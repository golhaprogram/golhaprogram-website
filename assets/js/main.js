import React from 'react';
import ReactDOM from 'react-dom';
import TagCloud from './components/TagCloud';

// Initialize tag clouds when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Find all tag cloud containers
  document.querySelectorAll('[data-tag-cloud]').forEach(container => {
    // Get data and program type from data attributes
    const data = JSON.parse(container.dataset.performers || '{}');
    const programType = container.dataset.programType || '';
    
    ReactDOM.render(
      React.createElement(TagCloud, { data, programType }),
      container
    );
  });
});
