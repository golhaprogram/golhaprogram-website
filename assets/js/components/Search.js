document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let searchData;
  let fuse;

  // Fetch the search index
  fetch('/index.json')
    .then(response => response.json())
    .then(data => {
      searchData = data;
      
      // Initialize Fuse with configuration options
      fuse = new Fuse(searchData, {
        keys: [
          { name: 'title', weight: 1.0 },
          { name: 'program_type', weight: 0.8 },
          { name: 'singers', weight: 0.7 },
          { name: 'players', weight: 0.7 },
          { name: 'composers', weight: 0.7 },
          { name: 'poets', weight: 0.7 },
          { name: 'dastgah', weight: 0.6 },
          { name: 'content', weight: 0.5 }
        ],
        includeScore: true,
        threshold: 0.1, // 0 will make it exact match
        ignoreLocation: true
      });
    });

  // Handle search input
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (!query) {
      searchResults.innerHTML = '';
      searchResults.style.display = 'none';
      return;
    }
    
    if (fuse) {
      const results = fuse.search(query).slice(0, 10); // Limit to 10 results
      
      if (results.length > 0) {
        searchResults.innerHTML = results.map(result => {
          const item = result.item;
          return `
            <div class="search-result-item">
              <a href="${item.permalink}">
                <h3>${item.title|| 'برنامه بدون عنوان'}</h3>
                <div class="search-meta">
                  <span>${item.program_type || ''} ${item.program_number || ''}</span>
                  ${item.dastgah ? `<span>دستگاه: ${item.dastgah}</span>` : ''}
                  ${item.singers && item.singers.length ? `<span>خواننده: ${item.singers.join('، ')}</span>` : ''}
                </div>
              </a>
            </div>
          `;
        }).join('');
        searchResults.style.display = 'block';
      } else {
        searchResults.innerHTML = '<div class="no-results">نتیجه‌ای یافت نشد</div>';
        searchResults.style.display = 'block';
      }
    }
  });

  // Hide search results when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
});
