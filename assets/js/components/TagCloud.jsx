/**
 * TagCloud component - Vanilla JS implementation
 * Displays a cloud of tags with filtering by category
 */

// Initialize the tag cloud component
export function initializeTagCloud() {
  // Find all tag cloud containers
  document.querySelectorAll('[data-tag-cloud]').forEach(container => {
    try {
      // Parse the data from the data attribute
      const data = JSON.parse(container.dataset.performers || '{}');
      const programType = container.dataset.programType || '';
      
      renderTagCloud(container, data, programType);
    } catch (err) {
      console.error('Error initializing tag cloud:', err);
      container.innerHTML = `
        <div class="p-4 bg-red-100 rounded">
          <p>Error initializing tag cloud: ${err.message}</p>
        </div>
      `;
    }
  });
}

// Render the tag cloud
function renderTagCloud(container, data, programType) {
  // Clear the container
  container.innerHTML = '';
  
  // Add title if program type is provided
  if (programType) {
    const title = document.createElement('h3');
    title.className = 'text-xl mb-4 text-center text-gray-700';
    title.textContent = programType;
    container.appendChild(title);
  }
  
  // Category titles in Persian
  const categoryTitles = {
    singers: 'خوانندگان',
    players: 'نوازندگان',
    poets: 'شاعران',
    announcers: 'گویندگان',
    composers: 'آهنگسازان',
    arrangers: 'تنظیم کنندگان',
  };
  
  // Get available categories that have data
  const availableCategories = Object.keys(data).filter(cat => 
    data[cat] && Object.keys(data[cat]).length > 0
  );
  
  // Default to singers or first available category
  let selectedCategory = availableCategories.includes('singers') 
    ? 'singers' 
    : (availableCategories.length > 0 ? availableCategories[0] : null);
    
  if (!selectedCategory) {
    container.innerHTML = '<div class="p-4">No categories available</div>';
    return;
  }
  
  // Create category buttons container
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'flex justify-center gap-4 mb-8';
  buttonsDiv.dir = 'rtl';
  container.appendChild(buttonsDiv);
  
  // Add category buttons
  availableCategories.forEach(category => {
    const button = document.createElement('button');
    button.className = `px-4 py-2 rounded-lg ${
      selectedCategory === category 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-200 hover:bg-gray-300'
    }`;
    
    button.innerHTML = `
      ${categoryTitles[category] || category}
      <span class="text-sm mr-2">
        (${Object.keys(data[category]).length})
      </span>
    `;
    
    button.onclick = function() {
      // Update button styles
      buttonsDiv.querySelectorAll('button').forEach(btn => {
        btn.className = 'px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300';
      });
      this.className = 'px-4 py-2 rounded-lg bg-blue-600 text-white';
      
      // Update selected category and refresh tag display
      selectedCategory = category;
      displayTags(selectedCategory);
    };
    
    buttonsDiv.appendChild(button);
  });
  
  // Create tags container
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'flex flex-wrap justify-center gap-4 p-8 bg-white rounded-xl shadow-lg';
  tagsDiv.dir = 'rtl';
  container.appendChild(tagsDiv);
  
  // Function to display tags for selected category
  function displayTags(category) {
    tagsDiv.innerHTML = '';
    
    if (!data[category]) return;
    
    // Get max count for sizing
    const counts = Object.values(data[category]);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    
    // Sort tags by count (descending)
    const sortedTags = Object.entries(data[category])
      .sort(([,a], [,b]) => b - a);
    
    // Calculate tag size
    const calculateSize = (count, maxCount) => {
      const minSize = 14;
      const maxSize = 32;
      return maxCount > 0 
        ? minSize + (count / maxCount) * (maxSize - minSize)
        : minSize;
    };
    
    // Format URL-friendly slug
    const nameToSlug = (name) => {
      return name.toLowerCase()
        .replace(/\u200C/g, '')  // Remove ZWNJ (Nim faseleh)
        .replace(/[\s\.\+]+/g, '-');  // Replace spaces and punctuation with dashes
    };
    
    // Add each tag
    sortedTags.forEach(([name, count]) => {
      const fontSize = calculateSize(count, maxCount);
      const opacity = 0.7 + (count / maxCount) * 0.3;
      
      const tagLink = document.createElement('a');
      tagLink.href = `/${category}/${encodeURIComponent(nameToSlug(name))}/`;
      tagLink.className = 'transition-all duration-200 hover:text-blue-600';
      tagLink.style.fontSize = `${fontSize}px`;
      tagLink.style.opacity = opacity;
      
      tagLink.innerHTML = `
        ${name}
        <span class="text-sm text-gray-500 mx-1">
          (${count})
        </span>
      `;
      
      tagsDiv.appendChild(tagLink);
    });
  }
  
  // Initial display
  displayTags(selectedCategory);
}

export default { initializeTagCloud };
